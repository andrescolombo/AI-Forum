import { OllamaClient, OllamaError } from '@/synth/ollama';
import { buildSynthesisPrompt } from '@/synth/prompt';
import { awaitAnswer, newRequestId, postToFrame } from '@/lib/messaging';
import type { SiteId, SiteResponse } from '@/types';
import type { SynthesisView } from './components/SynthesisView';
import type { FrameRef } from './components/IframesGrid';

/**
 * Orchestrates a single synthesis run:
 *   1. Ask each iframe (via its content-script) for whatever answer text is
 *      currently on screen — this is the "instant" path the user prefers.
 *   2. Show progress pills as answers arrive.
 *   3. Pick / load a model.
 *   4. Stream the synthesis from Ollama and render it as markdown.
 */

const EXTRACT_GRACE_MS = 4500;

export class Synthesizer {
  private client = new OllamaClient();
  private currentAbort: AbortController | null = null;

  constructor(
    private view: SynthesisView,
    private getPreferredModel: () => string | undefined,
    private setPreferredModel: (model: string) => Promise<void>
  ) {
    this.view.onModelChange(async (m) => {
      await this.setPreferredModel(m);
    });
  }

  /** Cancel any in-flight synthesis. */
  cancel(): void {
    this.currentAbort?.abort();
    this.currentAbort = null;
  }

  async run(
    query: string,
    frames: readonly FrameRef[],
    extraResponses: readonly SiteResponse[] = []
  ): Promise<void> {
    this.cancel();
    const ctrl = new AbortController();
    this.currentAbort = ctrl;

    if (frames.length === 0 && extraResponses.length === 0) {
      this.view.show(query, []);
      this.view.showError('No hay AIs activos para sintetizar.');
      return;
    }

    const siteIds = uniqueSiteIds([...frames.map((f) => f.siteId), ...extraResponses.map((r) => r.siteId)]);
    this.view.show(query, siteIds);

    // Kick off model list refresh in parallel — show what we have ASAP.
    void this.refreshModelList().catch((e) => {
      console.warn('[multiai] model list refresh failed:', e);
    });

    // 1. Ask each iframe for its current answer text.
    const responses = [...extraResponses];
    for (const response of extraResponses) {
      this.view.setProgress(response.siteId, 'ok');
    }
    responses.push(...(await this.collectAnswers(frames, ctrl.signal)));

    if (ctrl.signal.aborted) return;

    if (responses.length === 0) {
      this.view.showError(
        'No se pudo capturar ninguna respuesta de los AIs. ¿Esperaste a que arranquen?'
      );
      return;
    }

    // 2. Pick a model.
    this.view.setStatus('Seleccionando modelo de Ollama...');
    let model: string | null;
    try {
      model = this.getPreferredModel() ?? (await this.client.pickDefaultModel());
    } catch (e) {
      this.view.showError(this.formatOllamaError(e));
      return;
    }
    if (!model) {
      this.view.showError(
        'Ollama no tiene modelos disponibles. Probá con `ollama pull llama3` o usá un modelo cloud.'
      );
      return;
    }
    this.view.setActiveModel(model);

    // 3. Build prompt and stream.
    const prompt = buildSynthesisPrompt(query, responses);
    this.view.setPrompt(prompt);
    this.view.setStatus(`Enviando prompt a Ollama (${model})...`);
    console.info('[multiai] Ollama prompt chars:', prompt.length, 'model:', model);
    let accumulated = '';
    try {
      for await (const chunk of this.client.streamGenerate(model, prompt, ctrl.signal)) {
        if (ctrl.signal.aborted) return;
        accumulated += chunk;
        this.view.setStatus('Recibiendo respuesta de Ollama...');
        this.view.setContent(accumulated);
      }
      if (!accumulated.trim()) {
        this.view.showError('Ollama termino la generacion pero no devolvio texto.');
      } else {
        this.view.setStatus('Sintesis completa.');
      }
    } catch (e) {
      if (ctrl.signal.aborted) return;
      this.view.showError(this.formatOllamaError(e));
    }
  }

  private async collectAnswers(
    frames: readonly FrameRef[],
    signal: AbortSignal
  ): Promise<SiteResponse[]> {
    const promises = frames.map(async (frame): Promise<SiteResponse | null> => {
      const reqId = newRequestId();
      try {
        if (!frame.iframe.contentWindow) {
          this.view.setProgress(frame.siteId, 'fail');
          return null;
        }
        postToFrame(frame.iframe, frame.origin, {
          type: 'MULTIAI_EXTRACT_ANSWER',
          siteId: frame.siteId,
          requestId: reqId
        });
        const reply = await awaitAnswer({
          siteId: frame.siteId,
          requestId: reqId,
          expectedSource: frame.iframe.contentWindow,
          expectedOrigin: frame.origin,
          timeoutMs: EXTRACT_GRACE_MS
        });
        if (signal.aborted) return null;
        if (reply.text.length === 0) {
          this.view.setProgress(frame.siteId, 'fail');
          return null;
        }
        this.view.setProgress(frame.siteId, 'ok');
        return { siteId: frame.siteId, text: reply.text };
      } catch (err) {
        if (signal.aborted) return null;
        console.warn('[multiai] extract failed for', frame.siteId, err);
        this.view.setProgress(frame.siteId, 'fail');
        return null;
      }
    });

    const results = await Promise.all(promises);
    return results.filter((r): r is SiteResponse => r !== null);
  }

  async refreshModelList(): Promise<void> {
    try {
      const models = await this.client.listModels();
      const current = this.getPreferredModel() ?? (await this.client.pickDefaultModel());
      this.view.setModels(models, current);
    } catch (e) {
      console.warn('[multiai] could not list ollama models:', e);
      this.view.setModels([], null);
    }
  }

  private formatOllamaError(e: unknown): string {
    if (e instanceof OllamaError) return `❌ ${e.message}`;
    if (e instanceof Error) return `❌ ${e.message}`;
    return '❌ Error desconocido al hablar con Ollama.';
  }
}

function uniqueSiteIds(ids: SiteId[]): SiteId[] {
  return ids.filter((id, index) => ids.indexOf(id) === index);
}

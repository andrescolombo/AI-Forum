import { OllamaClient, OllamaError } from '@/synth/ollama';
import { SITES } from '@/sites/registry';
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
    this.view.onModelRefresh(() => {
      void this.refreshModelList();
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

    // 2. Try to pick a local Ollama model; fall back gracefully if unavailable.
    this.view.setStatus('Seleccionando modelo de Ollama...');
    let model: string | null = null;
    try {
      const preferred = this.getPreferredModel();
      model = preferred ?? (await this.client.pickDefaultModel());
    } catch {
      // Ollama not running — will fall back to plain formatting below
    }

    if (!model) {
      // ── Fallback: no Ollama available ──────────────────────────────────────
      this.view.setStatus('Ollama no disponible — mostrando respuestas sin síntesis.');
      this.view.setContent(this.formatFallback(query, responses));
      return;
    }

    this.view.setModels([{ name: model }], model);
    this.view.setActiveModel(model);

    // 3. Build prompt and send exactly one non-streaming generation request.
    const prompt = buildSynthesisPrompt(query, responses);
    this.view.setPrompt(prompt);
    this.view.setStatus(`Enviando 1 prompt a Ollama (${model})...`);
    console.info('[multiai] Ollama generate request:', {
      model,
      promptChars: prompt.length,
      stream: false
    });
    try {
      const response = await this.client.generate(model, prompt, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (!response.trim()) {
        // Empty response — also fall back to plain formatting
        this.view.setContent(this.formatFallback(query, responses));
        this.view.setStatus('Ollama no devolvió texto — mostrando respuestas sin síntesis.');
      } else {
        this.view.setContent(response);
        this.view.setStatus('Sintesis completa.');
      }
    } catch (e) {
      if (ctrl.signal.aborted) return;
      // Generation failed — fall back instead of showing an error
      console.warn('[multiai] Ollama generate failed, using fallback:', e);
      this.view.setContent(this.formatFallback(query, responses));
      this.view.setStatus('Ollama falló — mostrando respuestas sin síntesis.');
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
      this.view.setStatus('Consultando modelos de Ollama local...');
      const models = await this.client.listModels();
      const preferred = this.getPreferredModel();
      const current =
        preferred && models.some((model) => model.name === preferred)
          ? preferred
          : models[0]?.name ?? null;
      this.view.setModels(models, current);
      if (current && current !== preferred) {
        await this.setPreferredModel(current);
      }
      this.view.setStatus(
        models.length > 0
          ? `Modelos actualizados (${models.length}).`
          : 'Ollama local no devolvio modelos.'
      );
    } catch (e) {
      console.warn('[multiai] could not list ollama models:', e);
      this.view.setModels([], null);
      this.view.setStatus('No se pudieron consultar modelos de Ollama local.');
    }
  }

  /**
   * When Ollama is unavailable or fails, format all collected AI responses
   * as readable markdown so the user still gets value from the synthesis view.
   */
  private formatFallback(query: string, responses: SiteResponse[]): string {
    const sections = responses
      .map(({ siteId, text }) => {
        const name = SITES[siteId]?.displayName ?? siteId;
        return `## ${name}\n\n${text.trim()}`;
      })
      .join('\n\n---\n\n');
    return [
      `> ⚠️ **Ollama no disponible** — se muestran las respuestas individuales sin síntesis.`,
      `> Instalá Ollama en [ollama.com](https://ollama.com) y ejecutá \`ollama pull nemotro-3-super:cloud\` para habilitar la síntesis.`,
      '',
      sections
    ].join('\n');
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

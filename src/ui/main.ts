/**
 * Entry point for the Multi-AI extension page.
 */

import { loadPrefs, patchPrefs } from '@/lib/storage';
import { SITE_IDS, SITES } from '@/sites/registry';
import { OllamaClient } from '@/synth/ollama';
import { buildPromptImprovementPrompt } from '@/synth/prompt';
import type {
  BackgroundRequest,
  BackgroundResponse,
  DisplayMode,
  SiteId,
  SiteResponse,
  SyncedPrefs
} from '@/types';
import { IframesGrid } from './components/IframesGrid';
import { SearchBar } from './components/SearchBar';
import { SynthesisModalView, SynthesisPanelView } from './components/SynthesisView';
import { Synthesizer } from './Synthesizer';

class App {
  private prefs!: SyncedPrefs;
  private searchBar!: SearchBar;
  private grid!: IframesGrid;
  private modalView = new SynthesisModalView();
  private panelView = new SynthesisPanelView();
  private synthesizer!: Synthesizer;
  private ollamaClient = new OllamaClient();
  private submitTimersBySite = new Map<SiteId, number[]>();
  private mountedKey = '';
  private perplexityResponse: SiteResponse | null = null;

  async init(): Promise<void> {
    this.prefs = await loadPrefs();

    this.searchBar = new SearchBar({
      onSubmit: (q) => { void this.onSubmit(q); },
      onSynth: () => this.onSynth(),
      onToggleSite: (id, on) => this.onToggleSite(id, on),
      onToggleMode: () => this.onToggleMode()
    });

    this.grid = new IframesGrid({
      onOpenPerplexity: () => {
        void this.openPerplexity(true);
      }
    });

    const root = document.getElementById('app')!;
    root.append(this.searchBar.el, this.grid.el);

    this.synthesizer = this.createSynthesizer(this.activeView());
    this.panelView.onClose(() => this.grid.detachPanel(this.panelView.el));

    // "Usar en prompt" — fills the search bar with the synthesis text
    const reuseHandler = (text: string) => {
      this.searchBar.setQuery(text);
      this.searchBar.focus();
    };
    this.modalView.onReuseContent(reuseHandler);
    this.panelView.onReuseContent(reuseHandler);

    // Re-synthesize with a subset of AIs (user toggled pills)
    const resynthHandler = (selected: SiteId[]) => { void this.synthesizer.rerun(selected); };
    this.modalView.onResynth(resynthHandler);
    this.panelView.onResynth(resynthHandler);
    window.addEventListener('message', (ev) => this.onFrameMessage(ev));

    this.searchBar.setPrefs(this.prefs);
    this.mountGrid();

    // Always focus the textarea on load
    this.searchBar.focus();
  }

  private createSynthesizer(view: SynthesisModalView | SynthesisPanelView): Synthesizer {
    return new Synthesizer(
      view,
      () => this.prefs.preferredModel,
      async (m) => {
        this.prefs = await patchPrefs({ preferredModel: m });
      }
    );
  }

  private activeView() {
    return this.prefs.displayMode === 'panel' ? this.panelView : this.modalView;
  }

  private enabledSiteIds(): SiteId[] {
    return SITE_IDS.filter((id) => this.prefs.enabledSites[id]);
  }

  private mountGrid(): void {
    const enabled = this.enabledSiteIds();
    const key = enabled.join('|');
    if (key === this.mountedKey) return;
    this.grid.mount(enabled);
    this.mountedKey = key;
  }

  /**
   * Submit flow:
   *   1. If "Mejorar prompt" is checked, send the raw query to the local Ollama
   *      "judge" model to rewrite it using prompt-engineering best practices.
   *   2. Show the improved prompt back in the search bar so the user sees it.
   *   3. Send the (possibly improved) prompt to every AI chat.
   * If Ollama is unavailable or the checkbox is unchecked, the original query
   * is sent as-is.
   */
  private async onSubmit(query: string): Promise<void> {
    let improvedQuery = query;

    // ── Step 1: optionally improve the query with the judge AI ───────────────
    if (this.searchBar.improvePrompt) {
      this.searchBar.setSubmitting(true);
      try {
        const model =
          this.prefs.preferredModel ?? (await this.ollamaClient.pickDefaultModel());
        if (model) {
          const prompt = buildPromptImprovementPrompt(query);
          const result = await this.ollamaClient.generate(model, prompt);
          if (result.trim()) improvedQuery = result.trim();
        }
      } catch (e) {
        console.warn('[multiai] prompt improvement failed — using original query:', e);
      } finally {
        this.searchBar.setSubmitting(false);
      }

      // Show the improved query in the search bar
      if (improvedQuery !== query) {
        this.searchBar.setQuery(improvedQuery);
      }
    }

    // ── Step 2: send to all AI chats ──────────────────────────────────────────
    this.mountGrid();
    this.clearSubmitTimers();
    this.perplexityResponse = null;

    this.grid.submitViaUrl(improvedQuery);
    this.scheduleDomSubmissions(improvedQuery);

    if (this.prefs.enabledSites.perplexity) {
      void this.submitPerplexity(improvedQuery);
    }
  }

  private scheduleDomSubmissions(query: string): void {
    for (const frame of this.grid.list()) {
      const site = SITES[frame.siteId];
      if (site.queryUrlTemplate) continue;
      this.retrySubmitToFrame(frame.siteId, frame.origin, frame.iframe, query);
    }
  }

  private retrySubmitToFrame(
    siteId: SiteId,
    origin: string,
    iframe: HTMLIFrameElement,
    query: string
  ): void {
    const delays =
      siteId === 'claude' ? [700, 3000, 7000] : [250, 900, 1800, 3200, 5200, 8000, 12000];
    const requestId = `submit-${siteId}-${Date.now()}`;
    const timers: number[] = [];
    this.submitTimersBySite.set(siteId, timers);
    for (const delay of delays) {
      const timer = window.setTimeout(() => {
        iframe.contentWindow?.postMessage(
          {
            type: 'MULTIAI_SUBMIT_QUERY',
            siteId,
            query,
            requestId
          },
          origin
        );
      }, delay);
      timers.push(timer);
    }
  }

  private clearSubmitTimers(): void {
    for (const timers of this.submitTimersBySite.values()) {
      for (const timer of timers) window.clearTimeout(timer);
    }
    this.submitTimersBySite.clear();
  }

  private clearSubmitTimersFor(siteId: SiteId): void {
    const timers = this.submitTimersBySite.get(siteId);
    if (!timers) return;
    for (const timer of timers) window.clearTimeout(timer);
    this.submitTimersBySite.delete(siteId);
  }

  private onFrameMessage(ev: MessageEvent): void {
    const msg = ev.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type !== 'MULTIAI_SUBMIT_ACK') return;
    if (msg.ok !== true) return;
    this.clearSubmitTimersFor(msg.siteId);
  }

  private async onSynth(): Promise<void> {
    const query = this.lastQuery() ?? '(sin consulta - pedi algo primero)';
    const view = this.activeView();
    this.synthesizer = this.createSynthesizer(view);

    if (view === this.panelView) {
      this.grid.attachPanel(this.panelView.el);
    }

    this.searchBar.setSynthRunning(true);
    try {
      const extraResponses = await this.perplexityResponseForSynthesis();
      await this.synthesizer.run(query, this.grid.list(), extraResponses);
    } finally {
      this.searchBar.setSynthRunning(false);
    }
  }

  private async onToggleSite(siteId: SiteId, enabled: boolean): Promise<void> {
    this.prefs = await patchPrefs({
      enabledSites: { ...this.prefs.enabledSites, [siteId]: enabled }
    });
    this.mountedKey = '';
    this.mountGrid();
  }

  private async onToggleMode(): Promise<void> {
    const next: DisplayMode = this.prefs.displayMode === 'modal' ? 'panel' : 'modal';
    this.prefs = await patchPrefs({ displayMode: next });
    this.searchBar.setPrefs(this.prefs);
  }

  private async submitPerplexity(query: string): Promise<void> {
    this.grid.setMirrorStatus(
      'perplexity',
      'Abriendo Perplexity en una pestana en segundo plano...',
      'busy'
    );
    this.grid.setMirrorContent('perplexity', 'Esperando respuesta de Perplexity...');

    const submit = await this.sendBackground({
      type: 'MULTIAI_PERPLEXITY_SUBMIT',
      query
    });

    if (!submit.ok) {
      this.showPerplexityError(submit);
      return;
    }

    this.grid.setMirrorStatus('perplexity', 'Pregunta enviada. Capturando respuesta visible...', 'busy');
    await this.pollPerplexityAnswer(query);
  }

  private async pollPerplexityAnswer(query: string): Promise<SiteResponse | null> {
    const started = Date.now();
    let lastText = '';
    let stableCount = 0;
    const minCaptureMs = 12000;
    const stablePollsNeeded = 3;

    while (Date.now() - started < 90000) {
      await sleep(2500);
      const extracted = await this.sendBackground({ type: 'MULTIAI_PERPLEXITY_EXTRACT', query });

      if (!extracted.ok) {
        if (extracted.needsUserAction) {
          this.showPerplexityError(extracted);
          return null;
        }
        this.grid.setMirrorStatus(
          'perplexity',
          extracted.error ?? 'Esperando respuesta de Perplexity...',
          'busy'
        );
        continue;
      }

      const text = extracted.text?.trim() ?? '';
      if (!text) continue;

      const elapsed = Date.now() - started;
      const changed = text !== lastText;
      if (changed) stableCount = 0;
      else stableCount += 1;
      lastText = text;

      this.grid.setMirrorContent('perplexity', text);
      const ready = elapsed >= minCaptureMs && stableCount >= stablePollsNeeded;
      this.grid.setMirrorStatus(
        'perplexity',
        ready
          ? 'Respuesta lista para sintetizar.'
          : `Capturando Perplexity... ${text.length.toLocaleString()} caracteres`,
        ready ? 'ok' : 'busy'
      );

      if (ready) {
        this.perplexityResponse = { siteId: 'perplexity', text };
        return this.perplexityResponse;
      }
    }

    if (lastText) {
      this.perplexityResponse = { siteId: 'perplexity', text: lastText };
      this.grid.setMirrorStatus('perplexity', 'Tiempo agotado; se usara la respuesta parcial.', 'ok');
      return this.perplexityResponse;
    }

    this.grid.setMirrorStatus('perplexity', 'No se pudo capturar respuesta de Perplexity.', 'fail');
    return null;
  }

  private async perplexityResponseForSynthesis(): Promise<SiteResponse[]> {
    if (!this.prefs.enabledSites.perplexity) return [];
    if (this.perplexityResponse?.text) return [this.perplexityResponse];

    const extracted = await this.sendBackground({
      type: 'MULTIAI_PERPLEXITY_EXTRACT',
      query: this.lastQuery() ?? undefined
    });
    if (extracted.ok && extracted.text?.trim()) {
      this.perplexityResponse = { siteId: 'perplexity', text: extracted.text.trim() };
      this.grid.setMirrorContent('perplexity', this.perplexityResponse.text);
      this.grid.setMirrorStatus('perplexity', 'Respuesta capturada para sintetizar.', 'ok');
      return [this.perplexityResponse];
    }
    return [];
  }

  private async openPerplexity(active: boolean): Promise<void> {
    const response = await this.sendBackground({ type: 'MULTIAI_PERPLEXITY_OPEN', active });
    if (!response.ok) this.showPerplexityError(response);
  }

  private showPerplexityError(response: BackgroundResponse): void {
    const message = response.needsUserAction
      ? 'Perplexity necesita verificacion humana. Usa "Abrir", resolvelo una vez y vuelve a la extension.'
      : response.error ?? 'No se pudo usar Perplexity.';
    this.grid.setMirrorStatus('perplexity', message, 'fail');
    this.grid.setMirrorContent('perplexity', message);
  }

  private async sendBackground(message: BackgroundRequest): Promise<BackgroundResponse> {
    try {
      return (await chrome.runtime.sendMessage(message)) as BackgroundResponse;
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        needsUserAction: false
      };
    }
  }

  private lastQuery(): string | null {
    const ta = document.querySelector<HTMLTextAreaElement>('.search-bar textarea');
    return ta?.value.trim() || null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

document.addEventListener('DOMContentLoaded', () => {
  new App().init().catch((e) => {
    console.error('[multiai] init failed:', e);
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML =
        '<div class="error-box" style="margin: 24px;">No se pudo iniciar la extension: ' +
        String((e as Error).message) +
        '</div>';
    }
  });
});

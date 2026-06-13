/**
 * Entry point for the Multi-AI extension page.
 *
 * `App` is a thin orchestrator: it builds the UI components and wires them to
 * three focused managers — PreferencesManager (state), OffscreenBridge
 * (background-tab messaging) and IframeSubmitController (DOM submit retries).
 */

import { OllamaClient } from '@/synth/ollama';
import { buildPromptImprovementPrompt } from '@/synth/prompt';
import type { SiteId } from '@/types';
import { IframesGrid } from './components/IframesGrid';
import { SearchBar } from './components/SearchBar';
import { SynthesisModalView, SynthesisPanelView } from './components/SynthesisView';
import { IframeSubmitController } from './IframeSubmitController';
import { OffscreenBridge } from './OffscreenBridge';
import { PreferencesManager } from './state/PreferencesManager';
import { Synthesizer } from './Synthesizer';

class App {
  private prefs = new PreferencesManager();
  private searchBar!: SearchBar;
  private grid!: IframesGrid;
  private modalView = new SynthesisModalView();
  private panelView = new SynthesisPanelView();
  private synthesizer!: Synthesizer;
  private ollamaClient = new OllamaClient();
  private perplexity!: OffscreenBridge;
  private submitter = new IframeSubmitController();
  private mountedKey = '';

  async init(): Promise<void> {
    await this.prefs.load();

    this.searchBar = new SearchBar({
      onSubmit: (q) => { void this.onSubmit(q); },
      onSynth: () => this.onSynth(),
      onToggleSite: (id, on) => this.onToggleSite(id, on),
      onToggleMode: () => this.onToggleMode()
    });

    this.grid = new IframesGrid({
      onOpenPerplexity: () => {
        void this.perplexity.open(true);
      }
    });
    this.perplexity = new OffscreenBridge(this.grid, 'perplexity');

    const root = document.getElementById('app')!;
    root.append(this.searchBar.el, this.grid.el);

    this.synthesizer = this.createSynthesizer(this.activeView());
    this.panelView.onClose(() => this.grid.detachPanel(this.panelView.el));

    // "Use in prompt" — fills the search bar with the synthesis text
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
    window.addEventListener('message', (ev) => this.submitter.handleAck(ev));

    this.searchBar.setPrefs(this.prefs.snapshot);
    this.mountGrid();

    // Always focus the textarea on load
    this.searchBar.focus();
  }

  private createSynthesizer(view: SynthesisModalView | SynthesisPanelView): Synthesizer {
    return new Synthesizer(
      view,
      () => this.prefs.preferredModel,
      (m) => this.prefs.setPreferredModel(m)
    );
  }

  private activeView() {
    return this.prefs.displayMode === 'panel' ? this.panelView : this.modalView;
  }

  private mountGrid(): void {
    const enabled = this.prefs.enabledSiteIds();
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
    this.submitter.clearAll();
    this.perplexity.reset();

    this.grid.submitViaUrl(improvedQuery);
    this.submitter.scheduleSubmissions(this.grid.list(), improvedQuery);

    if (this.prefs.isEnabled('perplexity')) {
      void this.perplexity.submit(improvedQuery);
    }
  }

  private async onSynth(): Promise<void> {
    const query = this.lastQuery() ?? '(no query - ask something first)';
    const view = this.activeView();
    this.synthesizer = this.createSynthesizer(view);

    if (view === this.panelView) {
      this.grid.attachPanel(this.panelView.el);
    }

    this.searchBar.setSynthRunning(true);
    try {
      const extraResponses = this.prefs.isEnabled('perplexity')
        ? await this.perplexity.responseForSynthesis(this.lastQuery() ?? undefined)
        : [];
      await this.synthesizer.run(query, this.grid.list(), extraResponses);
    } finally {
      this.searchBar.setSynthRunning(false);
    }
  }

  private async onToggleSite(siteId: SiteId, enabled: boolean): Promise<void> {
    await this.prefs.setSiteEnabled(siteId, enabled);
    this.mountedKey = '';
    this.mountGrid();
  }

  private async onToggleMode(): Promise<void> {
    await this.prefs.toggleDisplayMode();
    this.searchBar.setPrefs(this.prefs.snapshot);
  }

  private lastQuery(): string | null {
    const ta = document.querySelector<HTMLTextAreaElement>('.search-bar textarea');
    return ta?.value.trim() || null;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new App().init().catch((e) => {
    console.error('[multiai] init failed:', e);
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML =
        '<div class="error-box" style="margin: 24px;">Could not start the extension: ' +
        String((e as Error).message) +
        '</div>';
    }
  });
});

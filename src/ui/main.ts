/**
 * Entry point for the Multi-AI extension page.
 * Wires SearchBar + IframesGrid + SynthesisView + Synthesizer + storage.
 */

import { loadPrefs, patchPrefs } from '@/lib/storage';
import { SITE_IDS, SITES } from '@/sites/registry';
import type { DisplayMode, SiteId, SyncedPrefs } from '@/types';
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
  private submitTimersBySite = new Map<SiteId, number[]>();

  async init(): Promise<void> {
    this.prefs = await loadPrefs();

    this.searchBar = new SearchBar({
      onSubmit: (q) => this.onSubmit(q),
      onSynth: () => this.onSynth(),
      onToggleSite: (id, on) => this.onToggleSite(id, on),
      onToggleMode: () => this.onToggleMode()
    });

    this.grid = new IframesGrid();

    const root = document.getElementById('app')!;
    root.append(this.searchBar.el, this.grid.el);

    // Build the synthesizer wired to whichever view is currently active.
    this.synthesizer = new Synthesizer(
      this.activeView(),
      () => this.prefs.preferredModel,
      async (m) => {
        this.prefs = await patchPrefs({ preferredModel: m });
      }
    );

    this.panelView.onClose(() => this.grid.detachPanel(this.panelView.el));
    window.addEventListener('message', (ev) => this.onFrameMessage(ev));

    // First mount: show iframes for currently-enabled sites.
    this.searchBar.setPrefs(this.prefs);
    this.grid.mount(this.enabledSiteIds());

    // Refresh model list once on load so the dropdown is populated when modal opens.
    void this.synthesizer.refreshModelList();

    this.searchBar.focus();
  }

  private activeView() {
    return this.prefs.displayMode === 'panel' ? this.panelView : this.modalView;
  }

  private enabledSiteIds(): SiteId[] {
    return SITE_IDS.filter((id) => this.prefs.enabledSites[id]);
  }

  private onSubmit(query: string): void {
    // Re-mount if the enabled set has changed since last mount.
    const enabled = this.enabledSiteIds();
    if (enabled.length !== this.grid.list().length) {
      this.grid.mount(enabled);
    }
    this.clearSubmitTimers();
    // For sites with queryUrlTemplate this is a navigation; for others this
    // keeps the iframe on its current/new-chat URL.
    this.grid.submitViaUrl(query);
    // Content scripts can report READY before this submit starts, and SPA
    // navigations do not always fire a useful iframe load event. Send with
    // short retries instead of waiting on a single race-prone event.
    this.scheduleDomSubmissions(query);
  }

  private scheduleDomSubmissions(query: string): void {
    for (const frame of this.grid.list()) {
      const site = SITES[frame.siteId];
      if (site.queryUrlTemplate) continue; // already submitted via URL
      this.retrySubmitToFrame(frame.siteId, frame.origin, frame.iframe, query);
    }
  }

  private retrySubmitToFrame(
    siteId: SiteId,
    origin: string,
    iframe: HTMLIFrameElement,
    query: string
  ): void {
    const delays = [250, 900, 1800, 3200, 5200, 8000, 12000];
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
    const query = this.lastQuery() ?? '(sin consulta — pedí algo primero)';
    const view = this.activeView();
    // Re-build synthesizer so it points at the currently-active view.
    this.synthesizer = new Synthesizer(
      view,
      () => this.prefs.preferredModel,
      async (m) => {
        this.prefs = await patchPrefs({ preferredModel: m });
      }
    );

    if (view === this.panelView) {
      this.grid.attachPanel(this.panelView.el);
    }

    this.searchBar.setSynthRunning(true);
    try {
      await this.synthesizer.run(query, this.grid.list());
    } finally {
      this.searchBar.setSynthRunning(false);
    }
  }

  private async onToggleSite(siteId: SiteId, enabled: boolean): Promise<void> {
    this.prefs = await patchPrefs({
      enabledSites: { ...this.prefs.enabledSites, [siteId]: enabled }
    });
    this.grid.mount(this.enabledSiteIds());
  }

  private async onToggleMode(): Promise<void> {
    const next: DisplayMode = this.prefs.displayMode === 'modal' ? 'panel' : 'modal';
    this.prefs = await patchPrefs({ displayMode: next });
    this.searchBar.setPrefs(this.prefs);
  }

  private lastQuery(): string | null {
    // We don't currently persist the last query — read it from the textarea.
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
        '<div class="error-box" style="margin: 24px;">No se pudo iniciar la extensión: ' +
        String((e as Error).message) +
        '</div>';
    }
  });
});

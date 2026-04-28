import { SITES } from '@/sites/registry';
import type { SiteId } from '@/types';

/**
 * Manages the grid of AI iframes.
 */

export interface FrameRef {
  siteId: SiteId;
  origin: string;
  iframe: HTMLIFrameElement;
}

export class IframesGrid {
  readonly el: HTMLElement;
  private frames: FrameRef[] = [];

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'iframes-container';
  }

  mount(siteIds: SiteId[]): void {
    this.el.replaceChildren();
    this.frames = [];
    siteIds.forEach((id) => {
      const site = SITES[id];
      const wrap = document.createElement('div');
      wrap.className = 'ai-frame';

      const label = document.createElement('span');
      label.className = 'ai-frame__label';
      label.textContent = site.displayName;

      const iframe = document.createElement('iframe');
      iframe.dataset.siteId = id;
      iframe.src = site.newChatUrl;

      wrap.append(label, iframe);
      this.el.append(wrap);
      this.frames.push({ siteId: id, origin: site.origin, iframe });
    });
    this.applyGrid();
  }

  /**
   * Navigate only sites that truly support query URL submission. DOM-driven
   * sites stay loaded; the parent sends MULTIAI_SUBMIT_QUERY via postMessage.
   */
  submitViaUrl(query: string): void {
    for (const { siteId, iframe } of this.frames) {
      const site = SITES[siteId];
      if (site.queryUrlTemplate) {
        iframe.src = site.queryUrlTemplate.replace('{query}', encodeURIComponent(query));
      }
    }
  }

  setColumns(cols: number | null): void {
    if (cols === null || cols <= 0) {
      this.el.style.removeProperty('grid-template-columns');
      this.el.classList.remove('has-panel');
      return;
    }
    this.el.style.setProperty('grid-template-columns', `repeat(${cols}, 1fr)`);
  }

  applyGrid(): void {
    this.setColumns(this.frames.length || 1);
  }

  applyPanelGrid(): void {
    this.el.classList.add('has-panel');
    this.setColumns(this.frames.length + 1);
  }

  list(): readonly FrameRef[] {
    return this.frames;
  }

  attachPanel(panelEl: HTMLElement): void {
    this.el.append(panelEl);
    this.applyPanelGrid();
  }

  detachPanel(panelEl: HTMLElement): void {
    if (panelEl.parentElement === this.el) panelEl.remove();
    this.applyGrid();
  }
}

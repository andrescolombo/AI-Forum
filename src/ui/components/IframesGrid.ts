import { renderMarkdown } from '@/synth/markdown';
import { SITES } from '@/sites/registry';
import type { SiteId } from '@/types';

export interface FrameRef {
  siteId: SiteId;
  origin: string;
  iframe: HTMLIFrameElement;
}

export interface IframesGridOptions {
  onOpenPerplexity?: () => void;
}

interface MirrorRef {
  siteId: SiteId;
  root: HTMLElement;
  status: HTMLElement;
  content: HTMLElement;
}

export class IframesGrid {
  readonly el: HTMLElement;
  private frames: FrameRef[] = [];
  private mirrors = new Map<SiteId, MirrorRef>();
  private itemCount = 0;

  constructor(private options: IframesGridOptions = {}) {
    this.el = document.createElement('div');
    this.el.className = 'iframes-container';
  }

  mount(siteIds: SiteId[]): void {
    this.el.replaceChildren();
    this.frames = [];
    this.mirrors.clear();
    this.itemCount = 0;

    siteIds.forEach((id) => {
      const site = SITES[id];
      if (site.mirrorPanel) {
        this.mountMirror(id);
        return;
      }
      this.mountIframe(id);
    });

    this.applyGrid();
  }

  private mountIframe(id: SiteId): void {
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
    this.itemCount += 1;
  }

  private mountMirror(id: SiteId): void {
    const site = SITES[id];
    const root = document.createElement('div');
    root.className = 'ai-frame mirror-frame';

    const header = document.createElement('div');
    header.className = 'mirror-frame__header';

    const title = document.createElement('div');
    title.className = 'mirror-frame__title';
    title.textContent = site.displayName;

    const open = document.createElement('button');
    open.className = 'mirror-frame__open';
    open.type = 'button';
    open.textContent = 'Abrir';
    open.title = 'Abrir la pestaña real de Perplexity';
    open.addEventListener('click', () => this.options.onOpenPerplexity?.());

    header.append(title, open);

    const status = document.createElement('div');
    status.className = 'mirror-frame__status';
    status.textContent = 'Listo para usar una pestaña real de Perplexity en segundo plano.';

    const content = document.createElement('div');
    content.className = 'mirror-frame__content md';
    content.innerHTML =
      '<p>Perplexity se ejecuta en una pestaña normal del navegador y este panel muestra una copia de la respuesta.</p>';

    root.append(header, status, content);
    this.el.append(root);
    this.mirrors.set(id, { siteId: id, root, status, content });
    this.itemCount += 1;
  }

  submitViaUrl(query: string): void {
    for (const { siteId, iframe } of this.frames) {
      const site = SITES[siteId];
      if (site.queryUrlTemplate) {
        iframe.src = site.queryUrlTemplate.replace('{query}', encodeURIComponent(query));
      }
    }
  }

  setMirrorStatus(siteId: SiteId, message: string, state: 'idle' | 'busy' | 'ok' | 'fail' = 'idle'): void {
    const mirror = this.mirrors.get(siteId);
    if (!mirror) return;
    mirror.status.textContent = message;
    mirror.root.dataset.state = state;
  }

  setMirrorContent(siteId: SiteId, markdown: string): void {
    const mirror = this.mirrors.get(siteId);
    if (!mirror) return;
    mirror.content.innerHTML = renderMarkdown(markdown);
  }

  hasMirror(siteId: SiteId): boolean {
    return this.mirrors.has(siteId);
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
    this.setColumns(this.itemCount || 1);
  }

  applyPanelGrid(): void {
    this.el.classList.add('has-panel');
    this.setColumns(this.itemCount + 1);
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

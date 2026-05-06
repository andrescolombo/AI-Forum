import { renderMarkdown } from '@/synth/markdown';
import { SITES } from '@/sites/registry';
import type { OllamaModel, SiteId } from '@/types';

/**
 * A SynthesisView is the UI shown while/after Ollama synthesizes responses.
 * Two render modes share the same data: a centered modal, or a panel inside
 * the iframes-grid (N+1 column). Both implement this interface.
 */
export interface SynthesisView {
  show(query: string, sites: SiteId[]): void;
  hide(): void;
  setModels(models: OllamaModel[], current: string | null): void;
  onModelChange(handler: (model: string) => void): void;
  onModelRefresh(handler: () => void): void;
  setProgress(siteId: SiteId, state: 'pending' | 'ok' | 'fail'): void;
  setActiveModel(model: string): void;
  setStatus(message: string): void;
  setPrompt(prompt: string): void;
  setContent(markdown: string): void;
  appendContent(chunk: string): void;
  showError(message: string): void;
  /** Called when user clicks "Usar en prompt" */
  onReuseContent(handler: (text: string) => void): void;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function buildHeader(title: string, onClose: () => void): {
  root: HTMLElement;
  modelSelect: HTMLSelectElement;
  modelLabel: HTMLElement;
  modelRefresh: HTMLButtonElement;
} {
  const header = document.createElement('div');
  header.className = 'synth-modal__header';
  const titleEl = document.createElement('div');
  titleEl.className = 'synth-modal__title';
  titleEl.innerHTML = `<span>🧠</span><span>${title}</span>`;
  const close = document.createElement('button');
  close.className = 'synth-modal__close';
  close.type = 'button';
  close.textContent = '×';
  close.addEventListener('click', onClose);
  header.append(titleEl, close);

  const modelRow = document.createElement('div');
  modelRow.className = 'synth-modal__model-row';
  const lbl = document.createElement('span');
  lbl.className = 'synth-modal__model-label';
  lbl.textContent = 'Modelo:';
  const select = document.createElement('select');
  const refresh = document.createElement('button');
  refresh.className = 'synth-modal__model-refresh';
  refresh.type = 'button';
  refresh.title = 'Consultar modelos disponibles en Ollama local';
  refresh.textContent = 'Refresh';
  modelRow.append(lbl, select, refresh);
  return { root: header, modelSelect: select, modelLabel: lbl, modelRefresh: refresh };
}

function buildProgressBar(): {
  el: HTMLElement;
  setSite: (siteId: SiteId, state: 'pending' | 'ok' | 'fail') => void;
  setSites: (sites: SiteId[]) => void;
} {
  const el = document.createElement('div');
  el.className = 'synth-modal__progress';
  const pills = new Map<SiteId, HTMLElement>();
  return {
    el,
    setSites(sites) {
      el.replaceChildren();
      pills.clear();
      sites.forEach((id) => {
        const pill = document.createElement('span');
        pill.className = 'synth-modal__pill';
        pill.dataset.state = 'pending';
        pill.textContent = `⌛ ${SITES[id].displayName}`;
        pills.set(id, pill);
        el.append(pill);
      });
    },
    setSite(siteId, state) {
      const pill = pills.get(siteId);
      if (!pill) return;
      pill.dataset.state = state;
      const name = SITES[siteId].displayName;
      pill.textContent = state === 'ok' ? `✅ ${name}` : state === 'fail' ? `⚠️ ${name}` : `⌛ ${name}`;
    }
  };
}

function buildPromptBox(): {
  el: HTMLDetailsElement;
  setPrompt: (prompt: string) => void;
} {
  const el = document.createElement('details');
  el.className = 'prompt-box';
  const summary = document.createElement('summary');
  summary.textContent = 'Ver prompt enviado a Ollama';
  const pre = document.createElement('pre');
  pre.className = 'prompt-box__content';
  const code = document.createElement('code');
  pre.append(code);
  el.append(summary, pre);
  return { el, setPrompt(p) { code.textContent = p; } };
}

/**
 * Action bar shown after synthesis completes.
 * Buttons: Copy | Save to Obsidian | Use in prompt
 */
function buildActionBar(opts: {
  onCopy:    (raw: string) => void;
  onObsidian:(raw: string, query: string) => void;
  onReuse:   (raw: string) => void;
}): {
  el: HTMLElement;
  setRaw: (raw: string) => void;
  setQuery: (query: string) => void;
  show: () => void;
} {
  let raw = '';
  let currentQuery = '';
  const bar = document.createElement('div');
  bar.className = 'synth-actions';
  bar.style.display = 'none';

  const mkBtn = (label: string, title: string, cls: string) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `synth-action-btn ${cls}`;
    b.title = title;
    b.textContent = label;
    return b;
  };

  const copyBtn    = mkBtn('📋 Copiar',         'Copiar síntesis al portapapeles',       'synth-action-btn--copy');
  const obsBtn     = mkBtn('🪨 Obsidian',        'Guardar en Obsidian',                   'synth-action-btn--obs');
  const reuseBtn   = mkBtn('↩ Usar en prompt',  'Poner síntesis en el campo de búsqueda','synth-action-btn--reuse');

  copyBtn.addEventListener('click', () => opts.onCopy(raw));
  obsBtn.addEventListener('click',  () => opts.onObsidian(raw, currentQuery));
  reuseBtn.addEventListener('click',() => opts.onReuse(raw));

  bar.append(copyBtn, obsBtn, reuseBtn);
  return {
    el: bar,
    setRaw(r) { raw = r; },
    setQuery(q) { currentQuery = q; },
    show()    { bar.style.display = 'flex'; }
  };
}

// ─── Copy helper ──────────────────────────────────────────────────────────────

function copyToClipboard(text: string, btn: Element): void {
  void navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✅ Copiado';
    setTimeout(() => { btn.textContent = orig; }, 1800);
  }).catch(() => {
    btn.textContent = '❌ Error';
    setTimeout(() => { btn.textContent = '📋 Copiar'; }, 1800);
  });
}

// ─── Obsidian helper ──────────────────────────────────────────────────────────

function saveToObsidian(raw: string, query: string): void {
  const storedVault = localStorage.getItem('multiai_obsidian_vault') ?? '';
  const vault = prompt('Nombre de tu vault de Obsidian:', storedVault);
  if (!vault) return;
  localStorage.setItem('multiai_obsidian_vault', vault);

  // Build a safe note title from the query (Obsidian forbids * " \ / < > : | ?)
  const safeTitle = query
    .slice(0, 60)
    .replace(/[*"\\/<>:|?]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    || 'MultiAI Síntesis';

  // `file` sets folder + name in one shot (Obsidian creates the folder if needed)
  const filePath = `AI Summaries/${safeTitle}`;
  const url = `obsidian://new?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(filePath)}&content=${encodeURIComponent(raw)}`;

  void chrome.tabs.create({ url, active: false }).then((tab) => {
    // Close the helper tab after Obsidian has had time to handle the URI
    setTimeout(() => { if (tab.id !== undefined) { void chrome.tabs.remove(tab.id); } }, 2000);
  });
}

/** Strip markdown syntax so plain text goes into the prompt box. */
function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```[a-z]*/gi, '').trim()) // fenced code: keep content
    .replace(/^#{1,6}\s+/gm, '')          // headers
    .replace(/\*\*([^*]+)\*\*/g, '$1')    // bold
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')        // italic
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')          // inline code
    .replace(/^[*-]\s+/gm, '')            // unordered list markers
    .replace(/^\d+\.\s+/gm, '')           // ordered list markers
    .replace(/^>\s*/gm, '')               // blockquotes
    .replace(/^---+$/gm, '')              // hr
    .replace(/\n{3,}/g, '\n\n')           // collapse excess blank lines
    .trim();
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export class SynthesisModalView implements SynthesisView {
  private root: HTMLElement;
  private modelSelect!: HTMLSelectElement;
  private modelLabel!: HTMLElement;
  private bodyContent!: HTMLElement;
  private statusEl!: HTMLElement;
  private progress!: ReturnType<typeof buildProgressBar>;
  private promptBox!: ReturnType<typeof buildPromptBox>;
  private actions!: ReturnType<typeof buildActionBar>;
  private modelChangeHandler?: (model: string) => void;
  private modelRefreshHandler?: () => void;
  private reuseHandler?: (text: string) => void;
  private rawContent = '';
  private currentQuery = '';

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'synth-modal';
    this.root.style.display = 'none';
    this.root.addEventListener('click', (e) => { if (e.target === this.root) this.hide(); });

    const dialog = document.createElement('div');
    dialog.className = 'synth-modal__dialog';

    const header = buildHeader('Síntesis Multi-AI', () => this.hide());
    this.modelSelect = header.modelSelect;
    this.modelLabel  = header.modelLabel;
    this.modelSelect.addEventListener('change', () => this.modelChangeHandler?.(this.modelSelect.value));
    header.modelRefresh.addEventListener('click', () => this.modelRefreshHandler?.());

    const body = document.createElement('div');
    body.className = 'synth-modal__body';
    body.append(this.modelLabel.parentElement!);

    this.progress = buildProgressBar();
    body.append(this.progress.el);

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'synth-status';
    body.append(this.statusEl);

    this.promptBox = buildPromptBox();
    body.append(this.promptBox.el);

    this.bodyContent = document.createElement('div');
    this.bodyContent.className = 'md';
    body.append(this.bodyContent);

    this.actions = buildActionBar({
      onCopy:    (raw) => copyToClipboard(raw, this.root.querySelector('.synth-action-btn--copy')!),
      onObsidian:(raw, query) => saveToObsidian(raw, query),
      onReuse:   (raw) => { this.hide(); this.reuseHandler?.(stripMarkdown(raw)); }
    });
    body.append(this.actions.el);

    dialog.append(header.root, body);
    this.root.append(dialog);
    document.body.append(this.root);
  }

  show(query: string, sites: SiteId[]): void {
    this.rawContent = '';
    this.currentQuery = query;
    this.actions.el.style.display = 'none';
    this.root.style.display = 'flex';
    this.bodyContent.innerHTML = `<p style="color:var(--c-text-dim)"><em>Pregunta:</em> ${escapeHtml(query)}</p>`;
    this.statusEl.textContent = 'Capturando respuestas visibles...';
    this.progress.setSites(sites);
  }

  hide(): void { this.root.style.display = 'none'; }

  setModels(models: OllamaModel[], current: string | null): void {
    if (models.length === 0) {
      this.modelSelect.innerHTML = '<option value="">(ningún modelo Ollama detectado)</option>';
      this.modelSelect.disabled = true; return;
    }
    this.modelSelect.disabled = false;
    this.modelSelect.innerHTML = models
      .map((m) => `<option value="${escapeAttr(m.name)}"${m.name === current ? ' selected' : ''}>${escapeHtml(m.name)}</option>`)
      .join('');
  }

  onModelChange(h: (m: string) => void): void  { this.modelChangeHandler = h; }
  onModelRefresh(h: () => void): void           { this.modelRefreshHandler = h; }
  onReuseContent(h: (t: string) => void): void  { this.reuseHandler = h; }

  setProgress(siteId: SiteId, state: 'pending' | 'ok' | 'fail'): void { this.progress.setSite(siteId, state); }
  setActiveModel(model: string): void  { this.modelLabel.textContent = `Modelo: ${model}`; }
  setStatus(message: string): void     { this.statusEl.textContent = message; }
  setPrompt(prompt: string): void      { this.promptBox.setPrompt(prompt); }

  setContent(markdown: string): void {
    this.rawContent = markdown;
    this.actions.setRaw(markdown);
    this.actions.setQuery(this.currentQuery);
    this.bodyContent.innerHTML = renderMarkdown(markdown);
    this.actions.show();
  }

  appendContent(_chunk: string): void { /* streaming not used */ }

  showError(message: string): void {
    const box = document.createElement('div');
    box.className = 'error-box';
    box.textContent = message;
    this.bodyContent.replaceChildren(box);
  }
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export class SynthesisPanelView implements SynthesisView {
  readonly el: HTMLElement;
  private modelSelect!: HTMLSelectElement;
  private bodyContent!: HTMLElement;
  private statusEl!: HTMLElement;
  private progress!: ReturnType<typeof buildProgressBar>;
  private promptBox!: ReturnType<typeof buildPromptBox>;
  private actions!: ReturnType<typeof buildActionBar>;
  private modelChangeHandler?: (model: string) => void;
  private modelRefreshHandler?: () => void;
  private onCloseHandler?: () => void;
  private reuseHandler?: (text: string) => void;
  private currentQuery = '';

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'synth-panel';

    const header = document.createElement('div');
    header.className = 'synth-panel__header';
    header.innerHTML = '<span class="synth-panel__title"><span>🧠</span><span>Síntesis</span></span>';
    const close = document.createElement('button');
    close.className = 'synth-panel__close';
    close.type = 'button';
    close.textContent = '×';
    close.addEventListener('click', () => this.onCloseHandler?.());
    header.append(close);

    const body = document.createElement('div');
    body.className = 'synth-panel__body';

    const modelRow = document.createElement('div');
    modelRow.className = 'synth-modal__model-row';
    const lbl = document.createElement('span');
    lbl.className = 'synth-modal__model-label';
    lbl.textContent = 'Modelo:';
    this.modelSelect = document.createElement('select');
    this.modelSelect.addEventListener('change', () => this.modelChangeHandler?.(this.modelSelect.value));
    const refresh = document.createElement('button');
    refresh.className = 'synth-modal__model-refresh';
    refresh.type = 'button';
    refresh.title = 'Consultar modelos disponibles en Ollama local';
    refresh.textContent = 'Refresh';
    refresh.addEventListener('click', () => this.modelRefreshHandler?.());
    modelRow.append(lbl, this.modelSelect, refresh);
    body.append(modelRow);

    this.progress = buildProgressBar();
    body.append(this.progress.el);

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'synth-status';
    body.append(this.statusEl);

    this.promptBox = buildPromptBox();
    body.append(this.promptBox.el);

    this.bodyContent = document.createElement('div');
    this.bodyContent.className = 'md';
    body.append(this.bodyContent);

    this.actions = buildActionBar({
      onCopy:    (raw) => copyToClipboard(raw, this.el.querySelector('.synth-action-btn--copy')!),
      onObsidian:(raw, query) => saveToObsidian(raw, query),
      onReuse:   (raw) => this.reuseHandler?.(stripMarkdown(raw))
    });
    body.append(this.actions.el);

    this.el.append(header, body);
  }

  onClose(handler: () => void): void          { this.onCloseHandler = handler; }
  onReuseContent(h: (t: string) => void): void { this.reuseHandler = h; }

  show(query: string, sites: SiteId[]): void {
    this.currentQuery = query;
    this.actions.el.style.display = 'none';
    this.bodyContent.innerHTML = `<p style="color:var(--c-text-dim)"><em>Pregunta:</em> ${escapeHtml(query)}</p>`;
    this.statusEl.textContent = 'Capturando respuestas visibles...';
    this.progress.setSites(sites);
  }

  hide(): void { /* managed by grid attach/detach */ }

  setModels(models: OllamaModel[], current: string | null): void {
    if (models.length === 0) {
      this.modelSelect.innerHTML = '<option value="">(sin modelos)</option>';
      this.modelSelect.disabled = true; return;
    }
    this.modelSelect.disabled = false;
    this.modelSelect.innerHTML = models
      .map((m) => `<option value="${escapeAttr(m.name)}"${m.name === current ? ' selected' : ''}>${escapeHtml(m.name)}</option>`)
      .join('');
  }

  onModelChange(h: (m: string) => void): void  { this.modelChangeHandler = h; }
  onModelRefresh(h: () => void): void           { this.modelRefreshHandler = h; }
  setProgress(siteId: SiteId, s: 'pending' | 'ok' | 'fail'): void { this.progress.setSite(siteId, s); }
  setActiveModel(_m: string): void {}
  setStatus(message: string): void   { this.statusEl.textContent = message; }
  setPrompt(prompt: string): void    { this.promptBox.setPrompt(prompt); }

  setContent(markdown: string): void {
    this.actions.setRaw(markdown);
    this.actions.setQuery(this.currentQuery);
    this.bodyContent.innerHTML = renderMarkdown(markdown);
    this.actions.show();
  }

  appendContent(_chunk: string): void {}

  showError(message: string): void {
    const box = document.createElement('div');
    box.className = 'error-box';
    box.textContent = message;
    this.bodyContent.replaceChildren(box);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escapeAttr(s: string): string {
  return s.replace(/"/g,'&quot;');
}

import { renderMarkdown } from '@/synth/markdown';
import { SITES } from '@/sites/registry';
import type { OllamaModel, SiteId } from '@/types';

/**
 * A SynthesisView is the UI shown while/after Ollama synthesizes responses.
 * Two render modes share the same data: a centered modal, or a panel inside
 * the iframes-grid (N+1 column). Both implement this interface so the
 * orchestrator only talks to one type.
 */
export interface SynthesisView {
  show(query: string, sites: SiteId[]): void;
  hide(): void;
  setModels(models: OllamaModel[], current: string | null): void;
  onModelChange(handler: (model: string) => void): void;
  setProgress(siteId: SiteId, state: 'pending' | 'ok' | 'fail'): void;
  setActiveModel(model: string): void;
  setStatus(message: string): void;
  setPrompt(prompt: string): void;
  setContent(markdown: string): void;
  appendContent(chunk: string): void;
  showError(message: string): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared rendering helpers (private to this module)
// ─────────────────────────────────────────────────────────────────────────────

function buildHeader(title: string, onClose: () => void): {
  root: HTMLElement;
  modelSelect: HTMLSelectElement;
  modelLabel: HTMLElement;
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
  modelRow.append(lbl, select);

  // We need the body to also include modelRow; expose it by appending to header parent later.
  return { root: header, modelSelect: select, modelLabel: lbl };
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

  return {
    el,
    setPrompt(prompt) {
      code.textContent = prompt;
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal implementation
// ─────────────────────────────────────────────────────────────────────────────

export class SynthesisModalView implements SynthesisView {
  private root: HTMLElement;
  private modelSelect!: HTMLSelectElement;
  private modelLabel!: HTMLElement;
  private bodyContent!: HTMLElement;
  private statusEl!: HTMLElement;
  private progress!: ReturnType<typeof buildProgressBar>;
  private promptBox!: ReturnType<typeof buildPromptBox>;
  private modelChangeHandler?: (model: string) => void;

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'synth-modal';
    this.root.style.display = 'none';
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.hide();
    });

    const dialog = document.createElement('div');
    dialog.className = 'synth-modal__dialog';

    const header = buildHeader('Síntesis Multi-AI', () => this.hide());
    this.modelSelect = header.modelSelect;
    this.modelLabel = header.modelLabel;
    this.modelSelect.addEventListener('change', () => {
      this.modelChangeHandler?.(this.modelSelect.value);
    });

    const body = document.createElement('div');
    body.className = 'synth-modal__body';

    // model row goes in body for cleanness
    const modelRow = this.modelLabel.parentElement!;
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

    dialog.append(header.root, body);
    this.root.append(dialog);
    document.body.append(this.root);
  }

  show(query: string, sites: SiteId[]): void {
    this.root.style.display = 'flex';
    this.bodyContent.innerHTML = `<p style="color: var(--c-text-dim);"><em>Pregunta:</em> ${escapeHtml(
      query
    )}</p>`;
    this.statusEl.textContent = 'Capturando respuestas visibles...';
    this.progress.setSites(sites);
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  setModels(models: OllamaModel[], current: string | null): void {
    if (models.length === 0) {
      this.modelSelect.innerHTML = '<option value="">(ningún modelo Ollama detectado)</option>';
      this.modelSelect.disabled = true;
      return;
    }
    this.modelSelect.disabled = false;
    this.modelSelect.innerHTML = models
      .map((m) => {
        const sel = m.name === current ? ' selected' : '';
        return `<option value="${escapeAttr(m.name)}"${sel}>${escapeHtml(m.name)}</option>`;
      })
      .join('');
  }

  onModelChange(handler: (model: string) => void): void {
    this.modelChangeHandler = handler;
  }

  setProgress(siteId: SiteId, state: 'pending' | 'ok' | 'fail'): void {
    this.progress.setSite(siteId, state);
  }

  setActiveModel(model: string): void {
    this.modelLabel.textContent = `Modelo: ${model}`;
  }

  setStatus(message: string): void {
    this.statusEl.textContent = message;
  }

  setPrompt(prompt: string): void {
    this.promptBox.setPrompt(prompt);
  }

  setContent(markdown: string): void {
    this.bodyContent.innerHTML = renderMarkdown(markdown);
  }

  appendContent(_chunk: string): void {
    // Streaming append: re-render whole content for simplicity (markdown
    // partial state is hard). Caller passes accumulated text via setContent.
  }

  showError(message: string): void {
    const box = document.createElement('div');
    box.className = 'error-box';
    box.textContent = message;
    this.bodyContent.replaceChildren(box);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel implementation
// ─────────────────────────────────────────────────────────────────────────────

export class SynthesisPanelView implements SynthesisView {
  readonly el: HTMLElement;
  private modelSelect!: HTMLSelectElement;
  private bodyContent!: HTMLElement;
  private statusEl!: HTMLElement;
  private progress!: ReturnType<typeof buildProgressBar>;
  private promptBox!: ReturnType<typeof buildPromptBox>;
  private modelChangeHandler?: (model: string) => void;
  private onCloseHandler?: () => void;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'synth-panel';

    const header = document.createElement('div');
    header.className = 'synth-panel__header';
    header.innerHTML =
      '<span class="synth-panel__title"><span>🧠</span><span>Síntesis</span></span>';
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
    this.modelSelect.addEventListener('change', () => {
      this.modelChangeHandler?.(this.modelSelect.value);
    });
    modelRow.append(lbl, this.modelSelect);
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

    this.el.append(header, body);
  }

  /** Set callback for the × button. */
  onClose(handler: () => void): void {
    this.onCloseHandler = handler;
  }

  show(query: string, sites: SiteId[]): void {
    this.bodyContent.innerHTML = `<p style="color: var(--c-text-dim);"><em>Pregunta:</em> ${escapeHtml(
      query
    )}</p>`;
    this.statusEl.textContent = 'Capturando respuestas visibles...';
    this.progress.setSites(sites);
  }

  hide(): void {
    // Visibility is managed by attach/detach in the grid.
  }

  setModels(models: OllamaModel[], current: string | null): void {
    if (models.length === 0) {
      this.modelSelect.innerHTML = '<option value="">(sin modelos)</option>';
      this.modelSelect.disabled = true;
      return;
    }
    this.modelSelect.disabled = false;
    this.modelSelect.innerHTML = models
      .map((m) => {
        const sel = m.name === current ? ' selected' : '';
        return `<option value="${escapeAttr(m.name)}"${sel}>${escapeHtml(m.name)}</option>`;
      })
      .join('');
  }

  onModelChange(handler: (model: string) => void): void {
    this.modelChangeHandler = handler;
  }

  setProgress(siteId: SiteId, state: 'pending' | 'ok' | 'fail'): void {
    this.progress.setSite(siteId, state);
  }

  setActiveModel(_model: string): void {
    // Panel is tighter; leave model name in the dropdown only.
  }

  setStatus(message: string): void {
    this.statusEl.textContent = message;
  }

  setPrompt(prompt: string): void {
    this.promptBox.setPrompt(prompt);
  }

  setContent(markdown: string): void {
    this.bodyContent.innerHTML = renderMarkdown(markdown);
  }

  appendContent(_chunk: string): void {
    // see modal note above
  }

  showError(message: string): void {
    const box = document.createElement('div');
    box.className = 'error-box';
    box.textContent = message;
    this.bodyContent.replaceChildren(box);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;');
}

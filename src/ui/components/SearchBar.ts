import { SITES, SITE_IDS } from '@/sites/registry';
import type { DisplayMode, SiteId, SyncedPrefs } from '@/types';

const ARROW_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export interface SearchBarHandlers {
  onSubmit: (query: string) => void;
  onSynth: () => void;
  onToggleSite: (siteId: SiteId, enabled: boolean) => void;
  onToggleMode: () => void;
}

export class SearchBar {
  readonly el: HTMLElement;
  private textarea!: HTMLTextAreaElement;
  private submitBtn!: HTMLButtonElement;
  private synthBtn!: HTMLButtonElement;
  private modeBtn!: HTMLButtonElement;
  private chips = new Map<SiteId, HTMLButtonElement>();

  constructor(private h: SearchBarHandlers) {
    this.el = this.build();
  }

  setPrefs(prefs: SyncedPrefs): void {
    SITE_IDS.forEach((id) => {
      const chip = this.chips.get(id);
      if (chip) chip.dataset.on = String(prefs.enabledSites[id] === true);
    });
    this.modeBtn.dataset.mode = prefs.displayMode;
    this.modeBtn.textContent = prefs.displayMode === 'panel' ? 'Panel' : 'Modal';
    this.modeBtn.title =
      prefs.displayMode === 'panel'
        ? 'La sintesis aparece como cuarto panel. Clic para cambiar a modal.'
        : 'La sintesis aparece en modal. Clic para cambiar a cuarto panel.';
  }

  setSynthRunning(running: boolean): void {
    this.synthBtn.dataset.running = String(running);
  }

  setQuery(value: string): void {
    this.textarea.value = value;
    this.autoResize();
  }

  focus(): void {
    this.textarea.focus();
  }

  private build(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'search-bar';

    const chipRow = document.createElement('div');
    chipRow.className = 'site-toggle-row';
    SITE_IDS.forEach((id) => {
      const chip = document.createElement('button');
      chip.className = 'site-chip';
      chip.type = 'button';
      chip.textContent = SITES[id].displayName;
      chip.dataset.on = 'true';
      chip.addEventListener('click', () => {
        const next = chip.dataset.on !== 'true';
        chip.dataset.on = String(next);
        this.h.onToggleSite(id, next);
      });
      this.chips.set(id, chip);
      chipRow.append(chip);
    });

    const inputWrap = document.createElement('div');
    inputWrap.className = 'search-bar__input-wrap';
    this.textarea = document.createElement('textarea');
    this.textarea.placeholder = 'Pregunta para todas las IAs...';
    this.textarea.rows = 1;
    this.textarea.addEventListener('input', () => this.autoResize());
    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        this.fire();
      }
    });

    this.submitBtn = document.createElement('button');
    this.submitBtn.className = 'search-bar__submit';
    this.submitBtn.type = 'button';
    this.submitBtn.title = 'Enviar a todas las IAs (Enter)';
    this.submitBtn.innerHTML = ARROW_SVG;
    this.submitBtn.addEventListener('click', () => this.fire());
    inputWrap.append(this.textarea, this.submitBtn);

    const synthGroup = document.createElement('div');
    synthGroup.className = 'synth-group';

    this.synthBtn = document.createElement('button');
    this.synthBtn.className = 'synth-btn';
    this.synthBtn.type = 'button';
    this.synthBtn.title = 'Sintetizar respuestas con Ollama';
    this.synthBtn.innerHTML = '<span class="synth-btn__dot"></span><span>Sintetizar</span>';
    this.synthBtn.addEventListener('click', () => this.h.onSynth());

    this.modeBtn = document.createElement('button');
    this.modeBtn.className = 'mode-toggle';
    this.modeBtn.type = 'button';
    this.modeBtn.textContent = 'Modal';
    this.modeBtn.addEventListener('click', () => this.h.onToggleMode());

    synthGroup.append(this.synthBtn, this.modeBtn);
    root.append(chipRow, inputWrap, synthGroup);
    return root;
  }

  private fire(): void {
    const v = this.textarea.value.trim();
    if (!v) return;
    this.h.onSubmit(v);
  }

  private autoResize(): void {
    this.textarea.style.height = 'auto';
    this.textarea.style.height = this.textarea.scrollHeight + 'px';
  }

  get currentMode(): DisplayMode {
    return (this.modeBtn.dataset.mode as DisplayMode) ?? 'modal';
  }
}

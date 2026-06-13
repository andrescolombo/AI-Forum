/**
 * DOM utilities shared across SiteAdapters.
 *
 * These helpers exist because the AI sites use exotic editors (ProseMirror,
 * Lexical, contenteditable Slate) that don't accept naive `value = '...'`
 * assignments. They also break their own selectors every few weeks, so each
 * helper is defensive: tries multiple selectors, returns null cleanly.
 */

/** Wait until at least one element matching `selector` is in the DOM. */
export async function waitFor<T extends Element>(
  selector: string,
  { timeout = 6000, root = document }: { timeout?: number; root?: ParentNode } = {}
): Promise<T | null> {
  const start = performance.now();
  return new Promise((resolve) => {
    const tick = () => {
      const el = root.querySelector<T>(selector);
      if (el) return resolve(el);
      if (performance.now() - start > timeout) return resolve(null);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

/** Wait until any selector in the list matches. Checks all selectors each frame. */
export async function waitForAny<T extends Element>(
  selectors: readonly string[],
  { timeout = 6000, root = document }: { timeout?: number; root?: ParentNode } = {}
): Promise<T | null> {
  const start = performance.now();
  return new Promise((resolve) => {
    const tick = () => {
      const el = querySelectorAny<T>(selectors, root);
      if (el) return resolve(el);
      if (performance.now() - start > timeout) return resolve(null);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

/** First element that matches any of the given selectors. */
export function querySelectorAny<T extends Element>(
  selectors: readonly string[],
  root: ParentNode = document
): T | null {
  for (const sel of selectors) {
    const el = root.querySelector<T>(sel);
    if (el) return el;
  }
  return null;
}

/**
 * Type into a ProseMirror / Lexical contenteditable editor.
 * Uses execCommand('insertText') which is the only reliable way to make these
 * editors fire their own input pipeline (we tried `value=` and dispatching
 * 'input' events directly — both miss the editor's internal state machine).
 *
 * After execCommand, we also dispatch an InputEvent explicitly because React 18+
 * synthetic event system may not pick up browser-level execCommand events,
 * leaving the submit button disabled. The InputEvent forces React to re-evaluate
 * editor content and enable the send button.
 */
export function typeIntoContentEditable(el: HTMLElement, text: string): void {
  el.focus();
  // Select all existing content so insertText replaces it.
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  el.dispatchEvent(
    new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text
    })
  );
  // execCommand is deprecated but still the only path that works for these
  // editors. Their react-side observers listen for `beforeinput`/`input` events
  // dispatched by the browser, not by us.
  document.execCommand('insertText', false, text);
  // Explicit InputEvent so React/ProseMirror registers the change and enables send.
  el.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text
    })
  );
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

export function pressEnter(el: HTMLElement): void {
  const eventInit: KeyboardEventInit = {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true
  };
  el.dispatchEvent(new KeyboardEvent('keydown', eventInit));
  el.dispatchEvent(new KeyboardEvent('keypress', eventInit));
  el.dispatchEvent(new KeyboardEvent('keyup', eventInit));
}

/** Type into a plain <textarea> or <input>. Fires React-friendly input events. */
export function typeIntoNativeInput(
  el: HTMLTextAreaElement | HTMLInputElement,
  text: string
): void {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    'value'
  )?.set;
  nativeSetter?.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** "send"/"submit" words across the languages our target sites localize into. */
const SEND_WORDS = ['send', 'submit', 'enviar', 'envoyer', 'invia', 'senden'] as const;

/**
 * Utility controls that live in a composer but are NOT the send button.
 * Includes localized labels (Spanish, etc.) because the sites are tested in
 * non-English locales — e.g. ChatGPT's voice button reads "iniciar voz".
 */
const UTILITY_WORDS = [
  // English
  'attach',
  'upload',
  'file',
  'mic',
  'voice',
  'dictate',
  'search',
  'tool',
  'share',
  'copy',
  'more',
  'model',
  'setting',
  'menu',
  'emoji',
  // Spanish
  'voz',
  'dictado',
  'dictar',
  'micro',
  'adjuntar',
  'subir',
  'cargar',
  'archivo',
  'buscar',
  'herramienta',
  'compartir',
  'copiar',
  'modelo',
  'ajuste',
  'config'
] as const;

/**
 * Words for the "stop generating" control. While a site streams its answer the
 * send button is replaced by a stop button at the same spot; the bottom-right
 * heuristic would otherwise click it (e.g. Claude's "detener respuesta"),
 * cancelling the response. Never treat these as a submit button.
 */
const STOP_WORDS = ['stop', 'detener', 'parar', 'cancelar', 'cancel'] as const;

export interface SubmitButtonOptions {
  /** Site-specific selectors for the send button, tried first (most reliable). */
  selectors: readonly string[];
  /** Composer container selectors to scope the search; document is the last resort. */
  scopeSelectors?: readonly string[];
  /**
   * Whether to fall back to the bottom-right heuristic when no explicit selector
   * matches. Default true. Disable for sites whose send button is reliably
   * identified by selectors and whose composer has look-alike controls (e.g.
   * ChatGPT's model selector / temporary-chat toggle).
   */
  useHeuristicFallback?: boolean;
}

function labelOf(button: HTMLButtonElement): string {
  return [
    button.getAttribute('aria-label') ?? '',
    button.getAttribute('data-testid') ?? '',
    button.title ?? '',
    button.textContent ?? ''
  ]
    .join(' ')
    .toLowerCase();
}

function isClickable(button: HTMLButtonElement): boolean {
  if (
    button.disabled ||
    button.getAttribute('aria-disabled') === 'true' ||
    button.dataset.disabled === 'true' ||
    button.classList.contains('disabled')
  ) {
    return false;
  }
  const rect = button.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function isUtilityButton(label: string): boolean {
  return UTILITY_WORDS.some((word) => label.includes(word));
}

function isStopButton(label: string): boolean {
  return STOP_WORDS.some((word) => label.includes(word));
}

/** A button that must never be chosen as the send/submit control. */
function isNonSubmitButton(label: string): boolean {
  return isUtilityButton(label) || isStopButton(label);
}

/**
 * A button that opens a menu/popup (e.g. ChatGPT's model selector, tool pickers)
 * is never the send control. Keying on `aria-haspopup` is locale-independent and
 * avoids grabbing a dropdown trigger that happens to default to `type="submit"`
 * and is clickable before the real send button is enabled.
 */
function opensMenu(button: HTMLButtonElement): boolean {
  const hasPopup = button.getAttribute('aria-haspopup');
  return hasPopup !== null && hasPopup !== 'false';
}

function buildScopes(target: HTMLElement, scopeSelectors?: readonly string[]): ParentNode[] {
  const scopes: ParentNode[] = [];
  for (const selector of scopeSelectors ?? []) {
    const el = target.closest(selector);
    if (el && !scopes.includes(el)) scopes.push(el);
  }
  scopes.push(document);
  return scopes;
}

/**
 * Find a site's send/submit button near the composer, resilient to localized
 * labels (e.g. Claude's "Enviar mensaje" in Spanish). Strategy:
 *   1. Trust the site-specific `selectors` (most reliable: data-testid, class).
 *   2. Fallback: an enabled, non-utility button that either carries a known send
 *      word (any language) or sits at the composer's bottom-right edge.
 */
export function findSubmitButton(
  target: HTMLElement,
  { selectors, scopeSelectors, useHeuristicFallback = true }: SubmitButtonOptions
): HTMLButtonElement | null {
  const scopes = buildScopes(target, scopeSelectors);

  for (const scope of scopes) {
    for (const selector of selectors) {
      const found = Array.from(scope.querySelectorAll<HTMLButtonElement>(selector)).find(
        (button) => isClickable(button) && !opensMenu(button) && !isNonSubmitButton(labelOf(button))
      );
      if (found) return found;
    }
  }

  if (!useHeuristicFallback) return null;

  for (const scope of scopes) {
    const candidate = pickSubmitByHeuristic(
      Array.from(scope.querySelectorAll<HTMLButtonElement>('button'))
    );
    if (candidate) return candidate;
  }
  return null;
}

function pickSubmitByHeuristic(buttons: HTMLButtonElement[]): HTMLButtonElement | null {
  const usable = buttons.filter(
    (button) => isClickable(button) && !opensMenu(button) && !isNonSubmitButton(labelOf(button))
  );
  if (usable.length === 0) return null;

  // Prefer a button with an explicit (possibly localized) send word in its label.
  // We deliberately do NOT match on `type === 'submit'`: a <button> with no type
  // attribute defaults to "submit", which would wrongly grab unrelated buttons
  // (e.g. Gemini's top-left menu button).
  const labeled = usable.find((button) =>
    SEND_WORDS.some((word) => labelOf(button).includes(word))
  );
  if (labeled) return labeled;

  // Otherwise the unlabeled send arrow at the composer's bottom-right corner.
  const rightSide = usable.filter(
    (button) => button.getBoundingClientRect().left > window.innerWidth * 0.45
  );
  if (rightSide.length === 0) return null;
  return rightSide.reduce((best, button) => {
    const r = button.getBoundingClientRect();
    const br = best.getBoundingClientRect();
    return r.left + r.top > br.left + br.top ? button : best;
  });
}

/**
 * Activate a button like a user: a pointer/mouse press sequence (for frameworks
 * that listen for pointer events) followed by a native `.click()`. The native
 * click is essential — a synthetic 'click' event does NOT trigger a button's
 * default action (e.g. submitting its form), which some sites rely on.
 */
export function clickLikeUser(button: HTMLElement): void {
  button.focus();
  const init: MouseEventInit = { bubbles: true, cancelable: true, view: window };
  button.dispatchEvent(new PointerEvent('pointerdown', init));
  button.dispatchEvent(new MouseEvent('mousedown', init));
  button.dispatchEvent(new PointerEvent('pointerup', init));
  button.dispatchEvent(new MouseEvent('mouseup', init));
  button.click();
}

/** Poll until the submit button is found, then click it. Returns whether it clicked. */
export async function waitAndClickSubmit(
  target: HTMLElement,
  options: SubmitButtonOptions,
  { timeout = 5000 }: { timeout?: number } = {}
): Promise<boolean> {
  const deadline = performance.now() + timeout;
  return new Promise((resolve) => {
    const attempt = () => {
      const btn = findSubmitButton(target, options);
      if (btn) {
        clickLikeUser(btn);
        return resolve(true);
      }
      if (performance.now() > deadline) return resolve(false);
      requestAnimationFrame(attempt);
    };
    attempt();
  });
}

export function requestSubmitNear(el: HTMLElement): boolean {
  const form = el.closest('form');
  if (!form) return false;
  if (typeof form.requestSubmit === 'function') {
    form.requestSubmit();
  } else {
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
  }
  return true;
}

/** Concatenate textContent of all matched elements, trimmed. */
export function textOfAll(selector: string, root: ParentNode = document): string {
  const nodes = root.querySelectorAll<HTMLElement>(selector);
  if (nodes.length === 0) return '';
  return Array.from(nodes)
    .map((n) => n.innerText.trim())
    .filter(Boolean)
    .join('\n\n');
}

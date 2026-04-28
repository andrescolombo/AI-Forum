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

function isActuallyDisabled(btn: HTMLButtonElement): boolean {
  return (
    btn.disabled ||
    btn.getAttribute('aria-disabled') === 'true' ||
    btn.dataset.disabled === 'true' ||
    btn.classList.contains('disabled')
  );
}

function isVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function findClickableButton(selectors: readonly string[]): HTMLButtonElement | null {
  for (const sel of selectors) {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(sel));
    const btn = buttons.find((candidate) => isVisible(candidate) && !isActuallyDisabled(candidate));
    if (btn) return btn;
  }
  return null;
}

/** Click a button by trying a list of selectors. Returns true if it clicked. */
export function clickFirst(selectors: readonly string[]): boolean {
  const btn = findClickableButton(selectors);
  if (!btn) return false;
  btn.click();
  return true;
}

/**
 * Poll until a button matching one of the selectors becomes enabled, then click it.
 * Needed for React/ProseMirror editors where the send button stays disabled for a
 * few frames after content is inserted, until React re-renders.
 */
export async function waitAndClickFirst(
  selectors: readonly string[],
  { timeout = 2000 }: { timeout?: number } = {}
): Promise<boolean> {
  const deadline = performance.now() + timeout;
  return new Promise((resolve) => {
    const attempt = () => {
      const btn = findClickableButton(selectors);
      if (btn) {
        btn.click();
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

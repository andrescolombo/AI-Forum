import type { SiteAdapter } from '@/types';
import {
  pressEnter,
  querySelectorAny,
  textOfAll,
  typeIntoContentEditable,
  typeIntoNativeInput,
  waitAndClickSubmit,
  waitForAny
} from './dom-utils';

const SCOPE_SELECTORS = ['form', '[data-testid*="composer"], [class*="composer"], main'] as const;

/**
 * ChatGPT uses ProseMirror (contenteditable). The compose box has a `#prompt-textarea`
 * id even though it may be a div[contenteditable]. Submit button is disabled until
 * React registers the input, so we poll with waitAndClickSubmit.
 */
const COMPOSE_SELECTORS = [
  'textarea#prompt-textarea',
  'textarea[data-id="root"]',
  '[data-testid="composer-text-input"] textarea',
  'div#prompt-textarea[contenteditable="true"]',
  '#prompt-textarea[contenteditable="true"]',
  '#prompt-textarea.ProseMirror',
  '#prompt-textarea',
  'form textarea',
  'div[contenteditable="true"][data-virtualkeyboard="true"]',
  'div[contenteditable="true"][data-testid="composer-text-input"]',
  '[data-testid="composer-text-input"] div[contenteditable="true"]',
  'main form div[contenteditable="true"]',
  'div[contenteditable="true"][tabindex="0"]'
] as const;

// Only the reliable, send-specific anchors. We deliberately omit
// `button[type="submit"]`: ChatGPT's model selector and "temporary chat" toggle
// are typeless buttons (which default to type=submit) and are clickable before
// the real send button enables, so the broad selector grabs them by mistake.
const SUBMIT_SELECTORS = [
  'button[data-testid="send-button"]',
  'button[data-testid="composer-send-button"]',
  'button[aria-label*="send" i]',
  'button[aria-label*="enviar" i]'
] as const;

const ANSWER_SELECTORS = [
  'div[data-message-author-role="assistant"] .markdown',
  'div[data-message-author-role="assistant"]'
] as const;

const STREAMING_SELECTORS = [
  'button[data-testid="stop-button"]',
  'button[aria-label="Stop generating"]',
  'button[aria-label="Stop streaming"]'
] as const;

export const chatgptAdapter: SiteAdapter = {
  id: 'chatgpt',

  matches(url) {
    return url.hostname === 'chatgpt.com';
  },

  async submitQuery(query) {
    const target =
      (await waitForAny<HTMLElement>(COMPOSE_SELECTORS, { timeout: 15000 })) ??
      querySelectorAny<HTMLElement>(COMPOSE_SELECTORS);
    if (!target) throw new Error('ChatGPT: compose box not found');

    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
      typeIntoNativeInput(target, query);
    } else {
      typeIntoContentEditable(target, query);
    }

    // No heuristic fallback: ChatGPT's send button is reliably identified by the
    // selectors above. Falling back to "bottom-right clickable button" picks the
    // wrong control (model selector / temporary-chat toggle) while send is still
    // disabled. Instead we wait for the real button, then Enter as a last resort.
    const clicked = await waitAndClickSubmit(
      target,
      { selectors: SUBMIT_SELECTORS, scopeSelectors: SCOPE_SELECTORS, useHeuristicFallback: false },
      { timeout: 5000 }
    );
    if (!clicked) {
      target.focus();
      pressEnter(target);
    }
  },

  extractAnswer() {
    const text = textOfAll(ANSWER_SELECTORS[0]) || textOfAll(ANSWER_SELECTORS[1]);
    const streaming = !!querySelectorAny(STREAMING_SELECTORS);
    return { text, stable: !streaming && text.length > 0 };
  }
};


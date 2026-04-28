import type { SiteAdapter } from '@/types';
import {
  clickFirst,
  querySelectorAny,
  textOfAll,
  typeIntoContentEditable,
  waitFor
} from './dom-utils';

/**
 * Gemini uses an Angular-driven contenteditable inside <rich-textarea>.
 * Selectors are unstable; we keep multiple fallbacks.
 */
const COMPOSE_SELECTORS = [
  'rich-textarea div[contenteditable="true"]',
  'div.ql-editor[contenteditable="true"]',
  '.input-area-container div[contenteditable="true"]'
] as const;

const SUBMIT_SELECTORS = [
  'button.send-button',
  'button[aria-label="Send message"]',
  'button[mattooltip="Send message"]'
] as const;

const ANSWER_SELECTORS = [
  'model-response .model-response-text',
  'message-content .markdown',
  'model-response message-content'
] as const;

const STREAMING_SELECTORS = [
  'button.stop',
  'button[aria-label="Stop response"]',
  '.response-container[data-is-loading="true"]'
] as const;

export const geminiAdapter: SiteAdapter = {
  id: 'gemini',

  matches(url) {
    return url.hostname === 'gemini.google.com';
  },

  async submitQuery(query) {
    const compose = await waitFor<HTMLElement>(COMPOSE_SELECTORS[0], { timeout: 8000 });
    const target = compose ?? querySelectorAny<HTMLElement>(COMPOSE_SELECTORS);
    if (!target) throw new Error('Gemini: compose box not found');
    typeIntoContentEditable(target, query);
    await new Promise((r) => setTimeout(r, 100));
    if (!clickFirst(SUBMIT_SELECTORS)) {
      target.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
      );
    }
  },

  extractAnswer() {
    const text =
      textOfAll(ANSWER_SELECTORS[0]) ||
      textOfAll(ANSWER_SELECTORS[1]) ||
      textOfAll(ANSWER_SELECTORS[2]);
    const streaming = !!querySelectorAny(STREAMING_SELECTORS);
    return { text, stable: !streaming && text.length > 0 };
  }
};

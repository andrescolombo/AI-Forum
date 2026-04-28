import type { SiteAdapter } from '@/types';
import {
  pressEnter,
  querySelectorAny,
  textOfAll,
  typeIntoContentEditable,
  typeIntoNativeInput,
  waitAndClickFirst,
  waitFor
} from './dom-utils';

/**
 * Perplexity sometimes accepts query-via-URL, but it is not reliable for actual
 * submission. We use the DOM path so "typed but not sent" does not happen.
 */
const COMPOSE_SELECTORS = [
  'textarea[placeholder*="Ask" i]',
  'textarea',
  'div[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"]'
] as const;

const SUBMIT_SELECTORS = [
  'button[aria-label="Submit"]',
  'button[aria-label="Send"]',
  'button[aria-label*="submit" i]',
  'button[aria-label*="send" i]',
  'button[type="submit"]',
  'form button:last-of-type'
] as const;

const ANSWER_SELECTORS = [
  '.prose.prose-base',
  'div[id^="markdown-content"] .prose',
  'div[class*="prose"]'
] as const;

const STREAMING_SELECTORS = ['div[class*="loading"]', 'svg.animate-spin'] as const;

export const perplexityAdapter: SiteAdapter = {
  id: 'perplexity',

  matches(url) {
    return url.hostname === 'www.perplexity.ai' || url.hostname === 'perplexity.ai';
  },

  async submitQuery(query) {
    let target: HTMLElement | null = null;
    for (const sel of COMPOSE_SELECTORS) {
      target = await waitFor<HTMLElement>(sel, { timeout: 3000 });
      if (target) break;
    }
    target = target ?? querySelectorAny<HTMLElement>(COMPOSE_SELECTORS);
    if (!target) throw new Error('Perplexity: compose box not found');

    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
      typeIntoNativeInput(target, query);
    } else {
      typeIntoContentEditable(target, query);
    }

    const clicked = await waitAndClickFirst(SUBMIT_SELECTORS, { timeout: 2000 });
    if (!clicked) pressEnter(target);
  },

  extractAnswer() {
    let text = '';
    for (const sel of ANSWER_SELECTORS) {
      text = textOfAll(sel);
      if (text) break;
    }
    const streaming = !!document.querySelector(STREAMING_SELECTORS.join(','));
    return { text, stable: !streaming && text.length > 0 };
  }
};

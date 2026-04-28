import type { SiteAdapter } from '@/types';
import {
  pressEnter,
  querySelectorAny,
  textOfAll,
  typeIntoContentEditable,
  waitAndClickFirst,
  waitFor
} from './dom-utils';

/**
 * Claude.ai uses ProseMirror/Tiptap in the compose box. The submit button is
 * disabled until React registers the editor content, so we use waitAndClickFirst
 * which polls until it becomes enabled.
 */
const COMPOSE_SELECTORS = [
  // v1 proved these work reliably (ProseMirror / Tiptap)
  '.tiptap.ProseMirror',
  'div.ProseMirror[contenteditable="true"]',
  'div[contenteditable="true"].ProseMirror',
  'fieldset div[contenteditable="true"]',
  'div[contenteditable="true"][role="textbox"]'
] as const;

const SUBMIT_SELECTORS = [
  'button[aria-label="Send message"]',
  'button[aria-label="Send Message"]',
  'button[aria-label="Send"]',
  'button[aria-label*="send" i]',
  'button[data-testid="send-button"]',
  'button[data-testid="chat-submit-button"]',
  'button[data-testid="composer-send-button"]',
  'fieldset button[type="submit"]',
  'button[type="submit"]',
  'form button:last-of-type'
] as const;

const ANSWER_SELECTORS = [
  '.font-claude-message',
  '.font-claude-response',
  'div[data-is-streaming]'
] as const;

const STREAMING_SELECTORS = [
  'button[aria-label="Stop response"]',
  'button[aria-label*="Stop" i]',
  'div[data-is-streaming="true"]'
] as const;

export const claudeAdapter: SiteAdapter = {
  id: 'claude',

  matches(url) {
    return url.hostname === 'claude.ai';
  },

  async submitQuery(query) {
    // Try each compose selector — ProseMirror selectors first (from v1)
    let target: HTMLElement | null = null;
    for (const sel of COMPOSE_SELECTORS) {
      target = await waitFor<HTMLElement>(sel, { timeout: 3000 });
      if (target) break;
    }
    target = target ?? querySelectorAny<HTMLElement>(COMPOSE_SELECTORS);
    if (!target) throw new Error('Claude: compose box not found');
    typeIntoContentEditable(target, query);
    // Poll until the button becomes enabled (React needs a frame or two to re-render)
    const clicked = await waitAndClickFirst(SUBMIT_SELECTORS, { timeout: 2000 });
    if (!clicked) {
      pressEnter(target);
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

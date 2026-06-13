import type { SiteAdapter } from '@/types';
import {
  querySelectorAny,
  requestSubmitNear,
  textOfAll,
  typeIntoContentEditable,
  waitAndClickSubmit,
  waitForAny
} from './dom-utils';

const SCOPE_SELECTORS = [
  'form, fieldset, [data-testid*="composer"], [class*="composer"]',
  '[class*="composer"], [data-testid*="composer"], [class*="input"], main'
] as const;

const COMPOSE_SELECTORS = [
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
  'button[data-testid*="send" i]',
  'button[data-testid*="submit" i]',
  'fieldset button[type="submit"]',
  'button[type="submit"]'
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
    const target =
      (await waitForAny<HTMLElement>(COMPOSE_SELECTORS, { timeout: 12000 })) ??
      querySelectorAny<HTMLElement>(COMPOSE_SELECTORS);
    if (!target) throw new Error('Claude: compose box not found');

    typeIntoContentEditable(target, query);
    await waitForComposerText(target, query, 2500);
    await sleep(250);

    // Click the send button once it's actually enabled (Claude enables it only
    // after the composer has registered the inserted text). We deliberately do
    // NOT fall back to a synthetic Enter keydown: Claude's editor ignores
    // untrusted keyboard events for "send" and inserts a newline instead.
    const clicked = await waitAndClickSubmit(
      target,
      { selectors: SUBMIT_SELECTORS, scopeSelectors: SCOPE_SELECTORS },
      { timeout: 6000 }
    );
    if (!clicked && !requestSubmitNear(target)) {
      throw new Error('Claude: send button not found or still disabled');
    }

    // Confirm the prompt actually left the composer; if it's still there,
    // throw so the parent's retry loop tries again.
    const submitted = await waitForSubmitted(query, 5000);
    if (!submitted) {
      throw new Error('Claude: message did not submit');
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

async function waitForComposerText(target: HTMLElement, query: string, timeout: number): Promise<void> {
  const expected = normalizeText(query).slice(0, 80);
  const deadline = performance.now() + timeout;

  while (performance.now() < deadline) {
    const current = normalizeText(target.innerText || target.textContent || '');
    if (!expected || current.includes(expected)) return;
    await sleep(100);
  }
}

/**
 * Decide whether the message was actually submitted. Two positive signals:
 *  - A streaming/stop indicator appeared (Claude is generating → it was sent).
 *    `div[data-is-streaming="true"]` is locale-independent, unlike the Stop
 *    button's aria-label which is localized ("Detener respuesta").
 *  - The LIVE composer no longer holds our text. We re-query the composer each
 *    tick rather than trusting the original node: Claude remounts the composer
 *    on send, leaving the old node detached with stale text (which made the
 *    previous "is the original target empty?" check false-negative forever and
 *    drove the retry loop to re-type mid-answer).
 */
async function waitForSubmitted(query: string, timeout: number): Promise<boolean> {
  const expected = normalizeText(query).slice(0, 80);
  const deadline = performance.now() + timeout;
  while (performance.now() < deadline) {
    if (querySelectorAny(STREAMING_SELECTORS)) return true;
    const live = querySelectorAny<HTMLElement>(COMPOSE_SELECTORS);
    const current = normalizeText(live?.innerText || live?.textContent || '');
    if (current.length === 0 || (expected && !current.includes(expected))) return true;
    await sleep(150);
  }
  return false;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

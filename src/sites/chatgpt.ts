import type { SiteAdapter } from '@/types';
import {
  pressEnter,
  querySelectorAny,
  textOfAll,
  typeIntoContentEditable,
  typeIntoNativeInput,
  waitForAny
} from './dom-utils';

/**
 * ChatGPT uses ProseMirror (contenteditable). The compose box has a `#prompt-textarea`
 * id even though it may be a div[contenteditable]. Submit button is disabled until
 * React registers the input, so we poll with waitAndClickFirst.
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

const SUBMIT_SELECTORS = [
  'button[data-testid="send-button"]',
  'button[data-testid="composer-send-button"]',
  'button[aria-label="Send prompt"]',
  'button[aria-label="Send message"]',
  'button[aria-label="Enviar mensaje"]',
  'button[aria-label="Enviar"]',
  'button[aria-label*="send" i]',
  'button[aria-label*="enviar" i]',
  'button[type="submit"]'
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
    console.info('[multiai] ChatGPT composer found:', target.tagName, target.id || target.className);

    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
      typeIntoNativeInput(target, query);
    } else {
      typeIntoContentEditable(target, query);
    }

    const clicked = await clickChatGptSend(target, 5000);
    console.info('[multiai] ChatGPT submit clicked:', clicked);
    if (!clicked) {
      console.info('[multiai] ChatGPT falling back to Enter');
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

async function clickChatGptSend(target: HTMLElement, timeout: number): Promise<boolean> {
  const deadline = performance.now() + timeout;
  return new Promise((resolve) => {
    const attempt = () => {
      const btn = findSendButtonNear(target);
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

function findSendButtonNear(target: HTMLElement): HTMLButtonElement | null {
  const scopes: ParentNode[] = [];
  const form = target.closest('form');
  if (form) scopes.push(form);
  const composer = target.closest('[data-testid*="composer"], [class*="composer"], main');
  if (composer && composer !== form) scopes.push(composer);
  scopes.push(document);

  for (const scope of scopes) {
    for (const selector of SUBMIT_SELECTORS) {
      const buttons = Array.from(scope.querySelectorAll<HTMLButtonElement>(selector));
      const found = buttons.find((button) => isUsableSendButton(button));
      if (found) return found;
    }
  }
  return null;
}

function isUsableSendButton(button: HTMLButtonElement): boolean {
  const label = [
    button.getAttribute('aria-label') ?? '',
    button.getAttribute('data-testid') ?? '',
    button.title ?? '',
    button.textContent ?? ''
  ]
    .join(' ')
    .toLowerCase();

  const looksLikeSend =
    label.includes('send') ||
    label.includes('enviar') ||
    label.includes('submit') ||
    label.includes('composer-send') ||
    label.includes('send-button');

  if (!looksLikeSend && button.type !== 'submit') return false;
  if (button.disabled || button.getAttribute('aria-disabled') === 'true') return false;

  const rect = button.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  return true;
}

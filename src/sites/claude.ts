import type { SiteAdapter } from '@/types';
import {
  querySelectorAny,
  requestSubmitNear,
  textOfAll,
  typeIntoContentEditable,
  waitForAny
} from './dom-utils';

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
  'button[aria-label*="enviar" i]',
  'button[aria-label*="mensaje" i]',
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

    const sent = await clickClaudeSend(target, 8000);
    if (!sent && !requestSubmitNear(target)) {
      throw new Error('Claude: send button not found or still disabled');
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

async function clickClaudeSend(target: HTMLElement, timeout: number): Promise<boolean> {
  const deadline = performance.now() + timeout;
  return new Promise((resolve) => {
    const attempt = () => {
      const btn = findSendButtonNear(target);
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

function findSendButtonNear(target: HTMLElement): HTMLButtonElement | null {
  const scopes: ParentNode[] = [];
  const form = target.closest('form, fieldset, [data-testid*="composer"], [class*="composer"]');
  if (form) scopes.push(form);
  const composer = target.closest('[class*="composer"], [data-testid*="composer"], [class*="input"], main');
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
    label.includes('mensaje') ||
    label.includes('envoyer') ||
    label.includes('submit') ||
    label.includes('chat-submit') ||
    label.includes('composer-send');

  if (button.disabled || button.getAttribute('aria-disabled') === 'true') return false;

  const rect = button.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  if (looksLikeBadButton(label)) return false;

  if (looksLikeSend || button.type === 'submit') return true;

  // Claude sometimes ships the arrow button with no accessible label. In the
  // composer scope, the send control is usually a compact square-ish button on
  // the right side. This avoids relying only on labels.
  const squareish = rect.width >= 24 && rect.width <= 64 && rect.height >= 24 && rect.height <= 64;
  const rightSide = rect.left > window.innerWidth * 0.45;
  return squareish && rightSide;
}

function looksLikeBadButton(label: string): boolean {
  return (
    label.includes('attach') ||
    label.includes('adjuntar') ||
    label.includes('upload') ||
    label.includes('file') ||
    label.includes('mic') ||
    label.includes('voice') ||
    label.includes('dictate') ||
    label.includes('search') ||
    label.includes('tool') ||
    label.includes('share') ||
    label.includes('compartir') ||
    label.includes('copy') ||
    label.includes('copiar') ||
    label.includes('more') ||
    label.includes('mas') ||
    label.includes('más')
  );
}

async function waitForComposerText(target: HTMLElement, query: string, timeout: number): Promise<void> {
  const expected = normalizeText(query).slice(0, 80);
  const deadline = performance.now() + timeout;

  while (performance.now() < deadline) {
    const current = normalizeText(target.innerText || target.textContent || '');
    if (!expected || current.includes(expected)) return;
    await sleep(100);
  }
}

function clickLikeUser(button: HTMLButtonElement): void {
  button.focus();
  const eventInit: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    view: window
  };
  button.dispatchEvent(new PointerEvent('pointerdown', eventInit));
  button.dispatchEvent(new MouseEvent('mousedown', eventInit));
  button.dispatchEvent(new PointerEvent('pointerup', eventInit));
  button.dispatchEvent(new MouseEvent('mouseup', eventInit));
  button.dispatchEvent(new MouseEvent('click', eventInit));
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

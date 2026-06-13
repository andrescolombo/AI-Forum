import type { BackgroundResponse } from '@/types';
import type { OffscreenTabAdapter } from './offscreen-tab';

/**
 * Offscreen-tab adapter for Perplexity. Perplexity is hostile to iframes, so the
 * extension drives it through a real top-level browser tab kept in the background.
 * This adapter supplies the site-specific bits (URLs, tab match patterns, and the
 * in-page answer extractor); the generic plumbing lives in `offscreen-tab.ts`.
 */

const PERPLEXITY_HOME = 'https://www.perplexity.ai/';
const PERPLEXITY_SEARCH = 'https://www.perplexity.ai/search/new?q=';

export const perplexityOffscreenAdapter: OffscreenTabAdapter = {
  siteId: 'perplexity',
  homeUrl: PERPLEXITY_HOME,
  tabUrlPatterns: ['https://www.perplexity.ai/*', 'https://perplexity.ai/*'],
  buildSearchUrl: (query) => PERPLEXITY_SEARCH + encodeURIComponent(query),
  extractInPage: extractPerplexityInPage
};

/**
 * Runs inside the Perplexity page via `chrome.scripting.executeScript`. It is
 * serialized by `Function.prototype.toString()`, so it MUST stay fully
 * self-contained — every helper is an inner function and it references nothing
 * from module scope.
 */
function extractPerplexityInPage(query: string): BackgroundResponse {
  function normalizeLocal(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function isLikelyUiLineLocal(line: string): boolean {
    const normalized = normalizeLocal(line);
    if (!normalized) return true;
    if (/^\d+$/.test(normalized)) return true;
    if (normalized.length <= 2) return true;
    return [
      'inicio',
      'home',
      'discover',
      'biblioteca',
      'library',
      'espacios',
      'spaces',
      'respuesta',
      'answer',
      'enlaces',
      'links',
      'imagenes',
      'images',
      'lugares',
      'places',
      'compartir',
      'share',
      'copiar',
      'copy',
      'pro',
      'saber mas',
      'learn more',
      'modelo',
      'model',
      'vista previa gratuita de la busqueda avanzada activada',
      'free preview of advanced search activated',
      'solicitar seguimiento',
      'ask follow-up',
      'follow up'
    ].includes(normalized);
  }

  function looksLikeHistoryQueryLocal(line: string): boolean {
    const normalized = normalizeLocal(line);
    if (line.endsWith('?') && line.length < 220) return true;
    return (
      normalized.startsWith('which ') ||
      normalized.startsWith('how ') ||
      normalized.startsWith('giving ') ||
      normalized.startsWith('i need ') ||
      normalized.startsWith('search ') ||
      normalized.startsWith('what ')
    ) && line.length < 180;
  }

  function splitLinesLocal(raw: string): string[] {
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line, index, arr) => arr.indexOf(line) === index);
  }

  function cleanLinesLocal(raw: string, localQuery: string): string[] {
    const bannedExact = new Set([
      'Answer',
      'Links',
      'Images',
      'Places',
      'Share',
      'Ask follow-up'
    ]);
    const normalizedQuery = normalizeLocal(localQuery);

    return splitLinesLocal(raw)
      .filter((line) => !bannedExact.has(line))
      .filter((line) => !isLikelyUiLineLocal(line))
      .filter((line) => {
        const normalizedLine = normalizeLocal(line);
        return !normalizedQuery || normalizedLine !== normalizedQuery;
      })
      .filter((line) => !looksLikeHistoryQueryLocal(line))
      .filter((line, index, arr) => arr.indexOf(line) === index);
  }

  function cleanTextLocal(raw: string, localQuery: string): string {
    return cleanLinesLocal(raw, localQuery).join('\n').trim();
  }

  function scoreTextLocal(text: string): number {
    const sentenceCount = (text.match(/[.!?]\s/g) ?? []).length;
    return text.length + sentenceCount * 120;
  }

  function isUsefulLocal(text: string): boolean {
    if (!text || text.length < 120) return false;
    const lowerText = text.toLowerCase();
    if (lowerText.includes('solicitar seguimiento') && text.length < 600) return false;
    const lines = splitLinesLocal(text);
    const historyish = lines.filter((line) => looksLikeHistoryQueryLocal(line)).length;
    if (historyish >= 3 && historyish >= Math.max(3, Math.floor(lines.length * 0.35))) return false;
    if (!/[.!?]\s/.test(text) && text.split('\n').length < 4) return false;
    return true;
  }

  function getNodeTextLocal(node: Element | null | undefined): string {
    if (!node) return '';
    const inner = (node as HTMLElement).innerText;
    const text = inner && inner.trim().length > 0 ? inner : node.textContent;
    return text?.trim() ?? '';
  }

  function trimAfterFollowupUiLocal(lines: string[]): string[] {
    const stopIndex = lines.findIndex((line) => {
      const normalized = normalizeLocal(line);
      return (
        normalized === 'ask follow-up' ||
        normalized === 'related'
      );
    });
    return stopIndex >= 0 ? lines.slice(0, stopIndex) : lines;
  }

  function extractFromVisibleTextLocal(raw: string, localQuery: string): string {
    const rawLines = splitLinesLocal(raw);
    const lines = cleanLinesLocal(raw, localQuery);
    const normalizedQuery = normalizeLocal(localQuery);

    if (normalizedQuery) {
      const queryIndex = rawLines.findIndex((line) => {
        const normalizedLine = normalizeLocal(line);
        return normalizedLine === normalizedQuery || normalizedLine.includes(normalizedQuery);
      });
      if (queryIndex >= 0) {
        const afterQueryRaw = rawLines.slice(queryIndex + 1).join('\n');
        const afterQuery = cleanLinesLocal(afterQueryRaw, localQuery);
        const answer = trimAfterFollowupUiLocal(afterQuery).join('\n').trim();
        if (answer) return answer;
      }
    }

    const blocks: string[][] = [];
    let current: string[] = [];
    for (const line of lines) {
      if (isLikelyUiLineLocal(line)) {
        if (current.length) blocks.push(current);
        current = [];
        continue;
      }
      current.push(line);
    }
    if (current.length) blocks.push(current);

    return (
      blocks
        .map((block) => block.join('\n').trim())
        .filter(Boolean)
        .sort((a, b) => scoreTextLocal(b) - scoreTextLocal(a))[0] ?? ''
    );
  }

  function bestDomCandidateLocal(localQuery: string): string {
    const root = document.querySelector<HTMLElement>('main');
    if (!root) return '';

    const candidates = Array.from(root.querySelectorAll<HTMLElement>('*'))
      .map((el) => {
        const text = cleanTextLocal(getNodeTextLocal(el), localQuery);
        if (!text || text.length < 100) return null;
        const childCount = el.children.length;
        const rect = el.getBoundingClientRect();
        const score =
          scoreTextLocal(text) +
          (rect.width > 0 && rect.height > 0 ? 200 : 0) -
          childCount * 25;
        return { text, score };
      })
      .filter((item): item is { text: string; score: number } => item !== null)
      .sort((a, b) => b.score - a.score);

    return candidates[0]?.text ?? '';
  }

  function bestAnswerContainerLocal(localQuery: string): string {
    const selectors = [
      'div.prose',
      '[class*="prose"]',
      '[class*="markdown"]',
      '[class*="answer"]',
      '[data-testid*="answer"]'
    ];
    const normalizedQuery = normalizeLocal(localQuery);

    const candidates = selectors.flatMap((selector) =>
      Array.from(document.querySelectorAll<HTMLElement>(selector)).map((el) => {
        const raw = getNodeTextLocal(el);
        const text = cleanTextLocal(raw, localQuery);
        if (!text || text.length < 120) return null;

        const rect = el.getBoundingClientRect();
        const className = String(el.className).toLowerCase();
        const queryPenalty = normalizedQuery && normalizeLocal(raw).includes(normalizedQuery) ? 900 : 0;
        const score =
          scoreTextLocal(text) +
          (className.includes('prose') ? 1000 : 0) +
          (rect.width > 0 && rect.height > 0 ? 300 : 0) -
          el.children.length * 15 -
          queryPenalty;
        return { text, score };
      })
    );

    return candidates
      .filter((item): item is { text: string; score: number } => item !== null)
      .sort((a, b) => b.score - a.score)[0]?.text ?? '';
  }

  const bodyText = getNodeTextLocal(document.body);
  const mainEl = document.querySelector<HTMLElement>('main');
  const mainText = getNodeTextLocal(mainEl);
  const title = document.title ?? '';
  const lower = `${title}\n${bodyText}`.toLowerCase();
  const challenge =
    lower.includes('checking if the site connection is secure') ||
    lower.includes('security check') ||
    lower.includes('just a moment') ||
    lower.includes('verify you are human');

  if (challenge) {
    return {
      ok: false,
      error: 'Perplexity needs human verification in its real tab.',
      needsUserAction: true
    };
  }

  let text = '';
  const directAnswer = bestAnswerContainerLocal(query);
  if (isUsefulLocal(directAnswer)) text = directAnswer;

  const anchored = extractFromVisibleTextLocal(mainText, query);
  if (!text && isUsefulLocal(anchored)) text = anchored;

  const selectors = [
    '.prose.prose-base',
    'div[id^="markdown-content"] .prose',
    'div[class*="prose"]',
    '[class*="markdown"]',
    '[class*="answer"]',
    '[data-testid*="answer"]',
    'main article'
  ];

  for (const selector of selectors) {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const candidate = nodes
      .map((node) => cleanTextLocal(getNodeTextLocal(node), query))
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)[0] ?? '';
    if (!text && isUsefulLocal(candidate)) text = candidate;
    else if (candidate && candidate.length > text.length && candidate.length > text.length * 1.4) {
      text = candidate;
    }
  }

  if (!isUsefulLocal(text)) {
    const domCandidate = bestDomCandidateLocal(query);
    if (isUsefulLocal(domCandidate)) text = domCandidate;
  }

  if (!isUsefulLocal(text)) {
    if (isUsefulLocal(anchored)) text = anchored;
  }

  const streaming =
    !!document.querySelector('svg.animate-spin, div[class*="loading"], [aria-label*="Stop" i]') ||
    lower.includes('answering');

  if (!isUsefulLocal(text)) {
    const preview = cleanTextLocal(mainText, query).slice(0, 240);
    return {
      ok: false,
      error: preview
        ? `Perplexity is open, but I couldn't find the answer block. Preview: ${preview}`
        : 'Perplexity is open, but there is no visible answer yet.',
      stable: false
    };
  }

  return {
    ok: true,
    text,
    stable: !streaming,
    url: location.href
  };
}

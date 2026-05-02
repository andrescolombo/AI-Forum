import type { BackgroundRequest, BackgroundResponse } from '@/types';

/**
 * Background service worker.
 *
 * Jobs:
 *  - Open/focus the Multi-AI UI when the toolbar icon is clicked.
 *  - Control Perplexity through a real top-level browser tab kept in the
 *    background. Perplexity is hostile to iframes; a normal tab keeps login,
 *    cookies, and Cloudflare checks in the browser's expected context.
 */

const UI_URL = chrome.runtime.getURL('src/ui/main.html');
const PERPLEXITY_HOME = 'https://www.perplexity.ai/';
const PERPLEXITY_SEARCH = 'https://www.perplexity.ai/search/new?q=';
let lastPerplexityQuery = '';

chrome.action.onClicked.addListener(async () => {
  const existing = await chrome.tabs.query({ url: UI_URL });
  if (existing.length > 0 && existing[0]?.id !== undefined) {
    await chrome.tabs.update(existing[0].id, { active: true });
    if (existing[0].windowId !== undefined) {
      await chrome.windows.update(existing[0].windowId, { focused: true });
    }
    return;
  }
  await chrome.tabs.create({ url: UI_URL });
});

chrome.runtime.onMessage.addListener(
  (message: BackgroundRequest, _sender, sendResponse: (response: BackgroundResponse) => void) => {
    if (!message || typeof message !== 'object') return false;
    if (typeof message.type !== 'string' || !message.type.startsWith('MULTIAI_')) {
      return false;
    }

    const handler = message.type.startsWith('MULTIAI_OLLAMA_')
      ? handleOllamaMessage(message)
      : handlePerplexityMessage(message);

    void handler
      .then(sendResponse)
      .catch((error: unknown) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          needsUserAction: false
        });
      });
    return true;
  }
);

async function handlePerplexityMessage(message: BackgroundRequest): Promise<BackgroundResponse> {
  if (message.type === 'MULTIAI_PERPLEXITY_OPEN') {
    const tab = await ensurePerplexityTab(message.active === true);
    return { ok: true, tabId: tab.id, url: tab.url };
  }

  if (message.type === 'MULTIAI_PERPLEXITY_SUBMIT') {
    const tab = await ensurePerplexityTab(false);
    if (tab.id === undefined) return { ok: false, error: 'No se pudo abrir Perplexity.' };
    lastPerplexityQuery = message.query;
    const url = PERPLEXITY_SEARCH + encodeURIComponent(message.query);
    await chrome.tabs.update(tab.id, { url, active: false });
    return { ok: true, tabId: tab.id, url };
  }

  if (message.type === 'MULTIAI_PERPLEXITY_EXTRACT') {
    const tab = await findPerplexityTab();
    if (!tab?.id) {
      return {
        ok: false,
        error: 'No hay una pestaña de Perplexity abierta.',
        needsUserAction: true
      };
    }
    return extractPerplexityFromTab(tab.id, message.query ?? lastPerplexityQuery);
  }

  return { ok: false, error: 'Mensaje Perplexity no soportado.' };
}

async function ensurePerplexityTab(active: boolean): Promise<chrome.tabs.Tab> {
  const existing = await findPerplexityTab();
  if (existing?.id !== undefined) {
    if (active) {
      await chrome.tabs.update(existing.id, { active: true });
      if (existing.windowId !== undefined) {
        await chrome.windows.update(existing.windowId, { focused: true });
      }
    }
    return existing;
  }
  return chrome.tabs.create({ url: PERPLEXITY_HOME, active });
}

async function findPerplexityTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ url: ['https://www.perplexity.ai/*', 'https://perplexity.ai/*'] });
  return tabs.find((tab) => tab.id !== undefined) ?? null;
}

async function extractPerplexityFromTab(tabId: number, query: string): Promise<BackgroundResponse> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractPerplexityInPage,
      args: [query]
    });
    const result = results[0]?.result as BackgroundResponse | undefined;
    return result ?? { ok: false, error: 'Perplexity no devolvio resultado.' };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      needsUserAction: true
    };
  }
}

function extractPerplexityInPage(query: string): BackgroundResponse {
  function normalizeLocal(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
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
      'enlaces',
      'imagenes',
      'imágenes',
      'lugares',
      'compartir',
      'copiar',
      'pro',
      'saber mas',
      'saber más',
      'modelo',
      'vista previa gratuita de la busqueda avanzada activada',
      'vista previa gratuita de la búsqueda avanzada activada',
      'share',
      'copy',
      'solicitar seguimiento',
      'ask follow-up',
      'follow up'
    ].includes(normalized);
  }

  function looksLikeHistoryQueryLocal(line: string): boolean {
    const normalized = normalizeLocal(line);
    if (line.endsWith('?') && line.length < 220) return true;
    return (
      normalized.startsWith('cual ') ||
      normalized.startsWith('como ') ||
      normalized.startsWith('cuanto ') ||
      normalized.startsWith('dando ') ||
      normalized.startsWith('necesito ') ||
      normalized.startsWith('buscame ') ||
      normalized.startsWith('buscmae ') ||
      normalized.startsWith('i need ') ||
      normalized.startsWith('what ') ||
      normalized.startsWith('how ')
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
      'Respuesta',
      'Enlaces',
      'Imagenes',
      'Imágenes',
      'Lugares',
      'Compartir',
      'Solicitar seguimiento'
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
        normalized === 'solicitar seguimiento' ||
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
      error: 'Perplexity necesita verificacion humana en su pestaña real.',
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
        ? `Perplexity esta abierto, pero no encontre el bloque de respuesta. Preview: ${preview}`
        : 'Perplexity esta abierto, pero todavia no hay respuesta visible.',
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

function findBestPerplexityDomCandidate(query: string): string {
  const root = document.querySelector<HTMLElement>('main') ?? document.body;
  if (!root) return '';

  const candidates = Array.from(root.querySelectorAll<HTMLElement>('*'))
    .map((el) => {
      const raw = getNodeText(el);
      const text = cleanPerplexityText(raw, query);
      if (!text || text.length < 100) return null;
      const childCount = el.children.length;
      const rect = el.getBoundingClientRect();
      const score =
        scoreAnswerText(text) +
        (rect.width > 0 && rect.height > 0 ? 200 : 0) -
        childCount * 25;
      return { text, score };
    })
    .filter((item): item is { text: string; score: number } => item !== null)
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.text ?? '';
}

function getNodeText(node: Element | null | undefined): string {
  if (!node) return '';
  const inner = (node as HTMLElement).innerText;
  const text = inner && inner.trim().length > 0 ? inner : node.textContent;
  return text?.trim() ?? '';
}

function extractAnswerFromVisibleText(raw: string, query: string): string {
  const rawLines = splitPerplexityLines(raw);
  const lines = cleanPerplexityLines(raw, query);

  // If Perplexity includes the user query in the page, prefer everything after
  // that point. This avoids copying the top nav plus the prompt as the "answer".
  const normalizedQuery = normalize(query);
  if (normalizedQuery) {
    const queryIndex = rawLines.findIndex((line) => {
      const normalizedLine = normalize(line);
      return normalizedLine === normalizedQuery || normalizedLine.includes(normalizedQuery);
    });
    if (queryIndex >= 0) {
      const afterQueryRaw = rawLines.slice(queryIndex + 1).join('\n');
      const afterQuery = cleanPerplexityLines(afterQueryRaw, query);
      const answer = trimAfterFollowupUi(afterQuery).join('\n').trim();
      if (answer) return answer;
    }
  }

  // Fallback: choose the longest contiguous block with sentence-like content.
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (isLikelyUiLine(line)) {
      if (current.length) blocks.push(current);
      current = [];
      continue;
    }
    current.push(line);
  }
  if (current.length) blocks.push(current);

  return blocks
    .map((block) => block.join('\n').trim())
    .filter(Boolean)
    .sort((a, b) => scoreAnswerText(b) - scoreAnswerText(a))[0] ?? '';
}

function trimAfterFollowupUi(lines: string[]): string[] {
  const stopIndex = lines.findIndex((line) => {
    const normalized = normalize(line);
    return (
      normalized === 'solicitar seguimiento' ||
      normalized === 'related'
    );
  });
  return stopIndex >= 0 ? lines.slice(0, stopIndex) : lines;
}

function cleanPerplexityText(raw: string, query: string): string {
  return cleanPerplexityLines(raw, query).join('\n').trim();
}

function cleanPerplexityLines(raw: string, query: string): string[] {
  const bannedExact = new Set([
    'Respuesta',
    'Enlaces',
    'Imagenes',
    'Imágenes',
    'Lugares',
      'Compartir',
      'Pro',
      'Saber más',
      'Saber mas',
      'Modelo',
      'Vista previa gratuita de la búsqueda avanzada activada.',
      'Vista previa gratuita de la busqueda avanzada activada.',
      'Solicitar seguimiento'
  ]);
  const normalizedQuery = normalize(query);

  return splitPerplexityLines(raw)
    .filter((line) => !bannedExact.has(line))
    .filter((line) => !isLikelyUiLine(line))
    .filter((line) => {
      const normalizedLine = normalize(line);
      return !normalizedQuery || normalizedLine !== normalizedQuery;
    })
    .filter((line) => !(line.endsWith('?') && line.length < 220))
    .filter((line, index, arr) => arr.indexOf(line) === index);
}

function splitPerplexityLines(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line, index, arr) => arr.indexOf(line) === index);
}

function isUsefulPerplexityAnswer(text: string): boolean {
  if (!text || text.length < 180) return false;
  const lower = text.toLowerCase();
  if (lower.includes('solicitar seguimiento') && text.length < 600) return false;
  if (!/[.!?]\s/.test(text) && text.split('\n').length < 5) return false;
  return true;
}

function isLikelyUiLine(line: string): boolean {
  const normalized = normalize(line);
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
    'enlaces',
    'imagenes',
    'imágenes',
    'lugares',
    'compartir',
    'copiar',
    'share',
    'copy',
    'solicitar seguimiento',
    'ask follow-up',
    'follow up'
  ].includes(normalized);
}

function scoreAnswerText(text: string): number {
  const sentenceCount = (text.match(/[.!?]\s/g) ?? []).length;
  return text.length + sentenceCount * 120;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}


// ─── Ollama proxy ─────────────────────────────────────────────────────────────
// Requests made from the service worker have no browsing-context origin, so
// Ollama does not apply its Origin-based 403 check. This is the cleanest fix
// for the 403 error that extension pages get when OLLAMA_ORIGINS is not set.
const OLLAMA_BASE = 'http://localhost:11434';

async function handleOllamaMessage(message: BackgroundRequest): Promise<BackgroundResponse> {
  if (message.type === 'MULTIAI_OLLAMA_LIST_MODELS') {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`).catch(() => null);
    if (!res || !res.ok) return { ok: false, error: `Ollama /api/tags failed: ${res?.status ?? 'network error'}` };
    const data = (await res.json()) as { models?: Array<{ name: string; modified_at?: string; size?: number }> };
    return { ok: true, models: data.models ?? [] };
  }

  if (message.type === 'MULTIAI_OLLAMA_LIST_RUNNING') {
    const res = await fetch(`${OLLAMA_BASE}/api/ps`).catch(() => null);
    if (!res || !res.ok) return { ok: true, models: [] };
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    return { ok: true, models: data.models ?? [] };
  }

  if (message.type === 'MULTIAI_OLLAMA_GENERATE') {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: message.model, prompt: message.prompt, stream: false })
    }).catch((err: unknown) => {
      throw new Error(`Ollama network error: ${(err as Error).message}`);
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}${detail ? ': ' + detail.slice(0, 200) : ''}` };
    }
    const data = (await res.json()) as { response?: string };
    return { ok: true, text: data.response ?? '' };
  }

  return { ok: false, error: 'Ollama message type not supported.' };
}

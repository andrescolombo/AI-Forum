import type { BackgroundRequest, BackgroundResponse, SiteId } from '@/types';
import { perplexityOffscreenAdapter } from './offscreen-perplexity';

/**
 * Generic "offscreen tab" engine.
 *
 * Some AI sites are hostile to iframes (Perplexity blocks embedding; Cloudflare
 * checks, login and cookies expect a normal browsing context). For those we keep
 * a real top-level browser tab in the background and drive it from the service
 * worker: navigate it to a search URL and scrape the answer via
 * `chrome.scripting.executeScript`.
 *
 * Everything site-specific is captured by an {@link OffscreenTabAdapter}; the
 * plumbing here is shared, so supporting a new iframe-hostile site is just a
 * matter of writing an adapter and registering it in {@link OFFSCREEN_ADAPTERS}.
 */
export interface OffscreenTabAdapter {
  siteId: SiteId;
  /** URL to navigate a fresh tab to (and to reset an existing one). */
  homeUrl: string;
  /** `chrome.tabs.query` URL patterns that identify this site's tab. */
  tabUrlPatterns: string[];
  /** Build the URL that submits `query` to this site. */
  buildSearchUrl(query: string): string;
  /**
   * Runs inside the page via `chrome.scripting.executeScript`. It is serialized
   * by `Function.prototype.toString()`, so it MUST be fully self-contained and
   * reference nothing from module scope.
   */
  extractInPage: (query: string) => BackgroundResponse;
}

export const OFFSCREEN_ADAPTERS: Partial<Record<SiteId, OffscreenTabAdapter>> = {
  perplexity: perplexityOffscreenAdapter
};

// Last query submitted per site, so EXTRACT can fall back to it when the caller
// does not pass one (mirrors the previous single-site `lastPerplexityQuery`).
const lastQueryBySite = new Map<SiteId, string>();

export async function findOffscreenTab(adapter: OffscreenTabAdapter): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ url: adapter.tabUrlPatterns });
  return tabs.find((tab) => tab.id !== undefined) ?? null;
}

export async function ensureOffscreenTab(
  adapter: OffscreenTabAdapter,
  active: boolean
): Promise<chrome.tabs.Tab> {
  const existing = await findOffscreenTab(adapter);
  if (existing?.id !== undefined) {
    if (active) {
      await chrome.tabs.update(existing.id, { active: true });
      if (existing.windowId !== undefined) {
        await chrome.windows.update(existing.windowId, { focused: true });
      }
    }
    return existing;
  }
  return chrome.tabs.create({ url: adapter.homeUrl, active });
}

/** Navigate an existing tab back to its home URL so it starts fresh. */
export async function resetOffscreenTab(adapter: OffscreenTabAdapter): Promise<void> {
  const tab = await findOffscreenTab(adapter);
  if (tab?.id !== undefined) {
    await chrome.tabs.update(tab.id, { url: adapter.homeUrl });
  }
}

export async function extractFromOffscreenTab(
  adapter: OffscreenTabAdapter,
  tabId: number,
  query: string
): Promise<BackgroundResponse> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: adapter.extractInPage,
      args: [query]
    });
    const result = results[0]?.result as BackgroundResponse | undefined;
    return result ?? { ok: false, error: `${adapter.siteId} returned no result.` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      needsUserAction: true
    };
  }
}

/**
 * Handle a `MULTIAI_OFFSCREEN_*` request: resolve the adapter by `siteId` and
 * dispatch OPEN / SUBMIT / EXTRACT.
 */
export async function handleOffscreenMessage(message: BackgroundRequest): Promise<BackgroundResponse> {
  if (
    message.type !== 'MULTIAI_OFFSCREEN_OPEN' &&
    message.type !== 'MULTIAI_OFFSCREEN_SUBMIT' &&
    message.type !== 'MULTIAI_OFFSCREEN_EXTRACT'
  ) {
    return { ok: false, error: 'Offscreen message not supported.' };
  }

  const adapter = OFFSCREEN_ADAPTERS[message.siteId];
  if (!adapter) {
    return { ok: false, error: `No offscreen adapter for "${message.siteId}".` };
  }

  if (message.type === 'MULTIAI_OFFSCREEN_OPEN') {
    const tab = await ensureOffscreenTab(adapter, message.active === true);
    return { ok: true, tabId: tab.id, url: tab.url };
  }

  if (message.type === 'MULTIAI_OFFSCREEN_SUBMIT') {
    const tab = await ensureOffscreenTab(adapter, false);
    if (tab.id === undefined) return { ok: false, error: `Could not open ${adapter.siteId}.` };
    lastQueryBySite.set(adapter.siteId, message.query);
    const url = adapter.buildSearchUrl(message.query);
    await chrome.tabs.update(tab.id, { url, active: false });
    return { ok: true, tabId: tab.id, url };
  }

  // MULTIAI_OFFSCREEN_EXTRACT
  const tab = await findOffscreenTab(adapter);
  if (!tab?.id) {
    return {
      ok: false,
      error: `No ${adapter.siteId} tab is open.`,
      needsUserAction: true
    };
  }
  const query = message.query ?? lastQueryBySite.get(adapter.siteId) ?? '';
  return extractFromOffscreenTab(adapter, tab.id, query);
}

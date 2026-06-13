import type { BackgroundRequest, BackgroundResponse } from '@/types';
import { OFFSCREEN_ADAPTERS, handleOffscreenMessage, resetOffscreenTab } from './offscreen-tab';

/**
 * Background service worker.
 *
 * Jobs:
 *  - Open/focus the Multi-AI UI when the toolbar icon is clicked.
 *  - Drive iframe-hostile AI sites (e.g. Perplexity) through real top-level
 *    background tabs via the generic offscreen-tab engine (see `offscreen-tab.ts`).
 *  - Proxy Ollama requests so they carry no Origin header.
 */

const UI_URL = chrome.runtime.getURL('src/ui/main.html');

// Keep the action title in sync with whether the tab is open or not.
async function syncActionTitle(): Promise<void> {
  const existing = await chrome.tabs.query({ url: UI_URL });
  const isOpen = existing.length > 0;
  await chrome.action.setTitle({
    title: isOpen ? '↺ Restart Multi-AI' : 'Open Multi-AI'
  });
}

chrome.tabs.onUpdated.addListener((_id, _info, tab) => {
  if (tab.url === UI_URL) void syncActionTitle();
});
chrome.tabs.onRemoved.addListener(() => void syncActionTitle());
void syncActionTitle();

chrome.action.onClicked.addListener(async () => {
  const existing = await chrome.tabs.query({ url: UI_URL });
  if (existing.length > 0 && existing[0]?.id !== undefined) {
    // Tab already open — reload it to reset all AI iframes and app state.
    await chrome.tabs.reload(existing[0].id);
    await chrome.tabs.update(existing[0].id, { active: true });
    if (existing[0].windowId !== undefined) {
      await chrome.windows.update(existing[0].windowId, { focused: true });
    }
    // Also reset every offscreen background tab so they start fresh.
    await Promise.all(
      Object.values(OFFSCREEN_ADAPTERS).map((adapter) => adapter && resetOffscreenTab(adapter))
    );
    return;
  }
  await chrome.tabs.create({ url: UI_URL });
  void syncActionTitle();
});

chrome.runtime.onMessage.addListener(
  (message: BackgroundRequest, _sender, sendResponse: (response: BackgroundResponse) => void) => {
    if (!message || typeof message !== 'object') return false;
    if (typeof message.type !== 'string' || !message.type.startsWith('MULTIAI_')) {
      return false;
    }

    const handler = message.type.startsWith('MULTIAI_OLLAMA_')
      ? handleOllamaMessage(message)
      : handleOffscreenMessage(message);

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

import type { OllamaModel } from '@/types';

/**
 * Ollama client that routes all requests through the extension service worker.
 *
 * WHY: Requests from extension pages carry `Origin: chrome-extension://<id>`.
 * Ollama compares this against OLLAMA_ORIGINS and returns 403 if it does not
 * match — even in Brave where the origin or extension ID may differ from what
 * the user configured. Service workers have no browsing context and therefore
 * send no Origin header, so Ollama skips the check entirely.
 */
export class OllamaClient {
  async listModels(): Promise<OllamaModel[]> {
    const res = await chrome.runtime.sendMessage({ type: 'MULTIAI_OLLAMA_LIST_MODELS' });
    if (!res?.ok) throw new OllamaError(res?.error ?? 'listModels failed');
    return (res.models ?? []).map((m: { name: string; modified_at?: string; size?: number }) => ({
      name: m.name,
      modifiedAt: m.modified_at,
      sizeBytes: m.size
    }));
  }

  async listRunningModels(): Promise<OllamaModel[]> {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'MULTIAI_OLLAMA_LIST_RUNNING' });
      if (!res?.ok) return [];
      return (res.models ?? []).map((m: { name: string }) => ({ name: m.name }));
    } catch {
      return [];
    }
  }

  async generate(model: string, prompt: string, _signal?: AbortSignal): Promise<string> {
    const res = await chrome.runtime.sendMessage({
      type: 'MULTIAI_OLLAMA_GENERATE',
      model,
      prompt
    });
    if (!res?.ok) throw new OllamaError(res?.error ?? 'generate failed');
    return res.text ?? '';
  }

  async pickDefaultModel(): Promise<string | null> {
    const running = await this.listRunningModels();
    if (running.length > 0 && running[0]) return running[0].name;
    const all = await this.listModels();
    if (all.length === 0) return null;
    const sorted = [...all].sort((a, b) => {
      const ta = a.modifiedAt ? Date.parse(a.modifiedAt) : 0;
      const tb = b.modifiedAt ? Date.parse(b.modifiedAt) : 0;
      return tb - ta;
    });
    return sorted[0]?.name ?? null;
  }
}

export class OllamaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OllamaError';
  }
}

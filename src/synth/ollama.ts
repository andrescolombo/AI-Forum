import type { OllamaModel } from '@/types';

const OLLAMA_BASE = 'http://localhost:11434';

/**
 * Thin client over the Ollama HTTP API. Designed to fail loudly with useful
 * messages — most user issues with v1 were "Ollama is not running" or
 * "preferred model not pulled" surfacing as cryptic errors.
 */
export class OllamaClient {
  /** GET /api/tags — every installed model, including `:cloud` variants. */
  async listModels(): Promise<OllamaModel[]> {
    const res = await fetchWithTimeout(`${OLLAMA_BASE}/api/tags`, {}, 4000);
    if (!res.ok) throw new OllamaError(`tags failed: HTTP ${res.status}`);
    const data = (await res.json()) as { models?: Array<{ name: string; modified_at?: string; size?: number }> };
    return (data.models ?? []).map((m) => ({
      name: m.name,
      modifiedAt: m.modified_at,
      sizeBytes: m.size
    }));
  }

  /** GET /api/ps — currently loaded models. Useful as a smart default. */
  async listRunningModels(): Promise<OllamaModel[]> {
    try {
      const res = await fetchWithTimeout(`${OLLAMA_BASE}/api/ps`, {}, 3000);
      if (!res.ok) return [];
      const data = (await res.json()) as { models?: Array<{ name: string }> };
      return (data.models ?? []).map((m) => ({ name: m.name }));
    } catch {
      return [];
    }
  }

  /**
   * Stream a generation. Yields chunks of text as they arrive.
   * Throws OllamaError on transport failures.
   */
  async *streamGenerate(model: string, prompt: string, signal?: AbortSignal): AsyncIterable<string> {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: true }),
      signal
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new OllamaError(`generate failed: HTTP ${res.status} ${detail}`);
    }
    if (!res.body) throw new OllamaError('generate failed: no response body');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        const tail = buffer.trim();
        if (tail) {
          const obj = parseGenerateLine(tail);
          if (obj?.response) yield obj.response;
        }
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const obj = parseGenerateLine(trimmed);
        if (obj?.response) yield obj.response;
      }
    }
  }

  /**
   * Pick a sensible default model:
   *   1. A running model (from /api/ps)
   *   2. The most recently modified model (from /api/tags)
   *   3. null if nothing is installed.
   */
  async pickDefaultModel(): Promise<string | null> {
    const running = await this.listRunningModels();
    if (running.length > 0 && running[0]) return running[0].name;
    const all = await this.listModels();
    if (all.length === 0) return null;
    // /api/tags returns sorted by modified_at desc on most versions, but be safe.
    const sorted = [...all].sort((a, b) => {
      const ta = a.modifiedAt ? Date.parse(a.modifiedAt) : 0;
      const tb = b.modifiedAt ? Date.parse(b.modifiedAt) : 0;
      return tb - ta;
    });
    return sorted[0]?.name ?? null;
  }
}

function parseGenerateLine(line: string): { response?: string; done?: boolean } | null {
  try {
    return JSON.parse(line) as { response?: string; done?: boolean };
  } catch {
    return null;
  }
}

export class OllamaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OllamaError';
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new OllamaError(`request to ${url} timed out after ${ms}ms — is Ollama running?`);
    }
    throw new OllamaError(`request to ${url} failed: ${(err as Error).message}`);
  } finally {
    clearTimeout(id);
  }
}

import type { SiteAdapter, SiteId } from '@/types';
import { chatgptAdapter } from './chatgpt';
import { claudeAdapter } from './claude';
import { geminiAdapter } from './gemini';
import { perplexityAdapter } from './perplexity';

export const ADAPTERS: Record<SiteId, SiteAdapter> = {
  chatgpt: chatgptAdapter,
  claude: claudeAdapter,
  gemini: geminiAdapter,
  perplexity: perplexityAdapter
};

/** Find the adapter that claims this URL, if any. */
export function adapterForUrl(url: URL): SiteAdapter | null {
  for (const adapter of Object.values(ADAPTERS)) {
    if (adapter.matches(url)) return adapter;
  }
  return null;
}

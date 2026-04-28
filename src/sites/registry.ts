import type { SiteDescriptor, SiteId } from '@/types';

/**
 * Static descriptors for every supported AI. Keep this list small and curated —
 * each entry needs a matching adapter in `src/sites/<id>.ts`.
 */
export const SITES: Record<SiteId, SiteDescriptor> = {
  chatgpt: {
    id: 'chatgpt',
    displayName: 'ChatGPT',
    origin: 'https://chatgpt.com',
    newChatUrl: 'https://chatgpt.com/',
    iconUrl: 'icons/sites/chatgpt.png'
  },
  claude: {
    id: 'claude',
    displayName: 'Claude',
    origin: 'https://claude.ai',
    newChatUrl: 'https://claude.ai/new',
    iconUrl: 'icons/sites/claude.png'
  },
  gemini: {
    id: 'gemini',
    displayName: 'Gemini',
    origin: 'https://gemini.google.com',
    newChatUrl: 'https://gemini.google.com/app',
    iconUrl: 'icons/sites/gemini.png'
  },
  perplexity: {
    id: 'perplexity',
    displayName: 'Perplexity',
    origin: 'https://www.perplexity.ai',
    newChatUrl: 'https://www.perplexity.ai/',
    mirrorPanel: true,
    iconUrl: 'icons/sites/perplexity.png'
  }
};

export const SITE_IDS: SiteId[] = Object.keys(SITES) as SiteId[];

export function siteForOrigin(origin: string): SiteDescriptor | null {
  for (const site of Object.values(SITES)) {
    if (site.origin === origin) return site;
  }
  return null;
}

export function siteForUrl(url: URL): SiteDescriptor | null {
  return siteForOrigin(url.origin);
}

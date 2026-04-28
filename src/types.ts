/**
 * Shared types across the extension. This is the single source of truth
 * for message shapes, site identifiers, and the SiteAdapter contract.
 */

export type SiteId = 'chatgpt' | 'claude' | 'gemini' | 'perplexity';

export interface SiteDescriptor {
  id: SiteId;
  displayName: string;
  origin: string;       // e.g. 'https://chatgpt.com'
  newChatUrl: string;   // URL to start a fresh conversation
  /** URL with `{query}` placeholder, if the site supports query-via-URL submission. */
  queryUrlTemplate?: string;
  /** Render this site as an extension-owned mirror panel instead of an iframe. */
  mirrorPanel?: boolean;
  iconUrl: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Messages: parent (UI) ←→ child (content script in AI iframe)
// ─────────────────────────────────────────────────────────────────────────────

/** Sent by the parent UI to ask a child iframe to type & submit a query. */
export interface SubmitQueryMessage {
  type: 'MULTIAI_SUBMIT_QUERY';
  siteId: SiteId;
  query: string;
  requestId: string;
}

/** Sent by the parent UI to ask a child iframe for the latest visible answer text. */
export interface ExtractAnswerMessage {
  type: 'MULTIAI_EXTRACT_ANSWER';
  siteId: SiteId;
  requestId: string;
}

/** Reply from child: the extracted answer text (whatever is on-screen now). */
export interface AnswerExtractedMessage {
  type: 'MULTIAI_ANSWER_EXTRACTED';
  siteId: SiteId;
  requestId: string;
  text: string;
  /** True if the adapter believes the answer is fully done streaming. */
  stable: boolean;
}

/** Reply from child: the submit command was received and handled or ignored as a duplicate. */
export interface SubmitAckMessage {
  type: 'MULTIAI_SUBMIT_ACK';
  siteId: SiteId;
  requestId: string;
  ok: boolean;
}

/** Heartbeat from child: signals that the content script is alive on this site. */
export interface ContentReadyMessage {
  type: 'MULTIAI_CONTENT_READY';
  siteId: SiteId;
}

export type ChildToParentMessage = AnswerExtractedMessage | ContentReadyMessage | SubmitAckMessage;
export type ParentToChildMessage = SubmitQueryMessage | ExtractAnswerMessage;
export type AnyMessage = ChildToParentMessage | ParentToChildMessage;

// ─────────────────────────────────────────────────────────────────────────────
// SiteAdapter contract — every AI site implements this in src/sites/<id>.ts
// ─────────────────────────────────────────────────────────────────────────────

export interface SiteAdapter {
  readonly id: SiteId;
  /** True if this adapter handles the given URL (matches the live tab URL). */
  matches(url: URL): boolean;
  /** Type the query into the site's input and submit it. */
  submitQuery(query: string): Promise<void>;
  /**
   * Extract the most recent assistant answer's text content from the DOM.
   * Returns the text and whether the adapter believes streaming is finished.
   */
  extractAnswer(): { text: string; stable: boolean };
}

// ─────────────────────────────────────────────────────────────────────────────
// Synthesis types
// ─────────────────────────────────────────────────────────────────────────────

export interface OllamaModel {
  name: string;
  modifiedAt?: string;
  sizeBytes?: number;
}

export interface SiteResponse {
  siteId: SiteId;
  text: string;
}

export interface SynthesisRequest {
  query: string;
  responses: SiteResponse[];
  model: string;
}

export type DisplayMode = 'modal' | 'panel';

// Background bridge for Perplexity. The UI page talks to the service worker,
// which controls a real top-level Perplexity tab in the background.
export type BackgroundRequest =
  | { type: 'MULTIAI_PERPLEXITY_OPEN'; active?: boolean }
  | { type: 'MULTIAI_PERPLEXITY_SUBMIT'; query: string }
  | { type: 'MULTIAI_PERPLEXITY_EXTRACT'; query?: string };

export interface BackgroundResponse {
  ok: boolean;
  text?: string;
  stable?: boolean;
  tabId?: number;
  url?: string;
  error?: string;
  needsUserAction?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage schema (chrome.storage.sync + .local)
// ─────────────────────────────────────────────────────────────────────────────

export interface SyncedPrefs {
  enabledSites: Record<SiteId, boolean>;
  preferredModel?: string;
  displayMode: DisplayMode;
}

export const DEFAULT_PREFS: SyncedPrefs = {
  enabledSites: {
    chatgpt: true,
    claude: true,
    gemini: true,
    perplexity: true
  },
  displayMode: 'modal'
};

import type {
  AnswerExtractedMessage,
  ChildToParentMessage,
  ContentReadyMessage,
  ParentToChildMessage,
  SiteId
} from '@/types';

/**
 * Helper for the parent UI to talk to its iframes.
 * - postToFrame: wraps postMessage with a target origin
 * - awaitAnswer: returns a promise that resolves when the iframe replies
 *   with a matching requestId, or rejects on timeout.
 */

export function postToFrame(
  iframe: HTMLIFrameElement,
  origin: string,
  msg: ParentToChildMessage
): void {
  iframe.contentWindow?.postMessage(msg, origin);
}

export interface AwaitAnswerOptions {
  siteId: SiteId;
  requestId: string;
  expectedSource: Window;
  expectedOrigin: string;
  timeoutMs: number;
}

export function awaitAnswer(opts: AwaitAnswerOptions): Promise<AnswerExtractedMessage> {
  return new Promise((resolve, reject) => {
    const handler = (ev: MessageEvent<ChildToParentMessage>) => {
      if (ev.source !== opts.expectedSource) return;
      if (ev.origin !== opts.expectedOrigin) return;
      const m = ev.data;
      if (!m || typeof m !== 'object') return;
      if (m.type !== 'MULTIAI_ANSWER_EXTRACTED') return;
      if (m.siteId !== opts.siteId) return;
      if (m.requestId !== opts.requestId) return;
      cleanup();
      resolve(m);
    };
    const cleanup = () => {
      window.removeEventListener('message', handler);
      clearTimeout(timer);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`awaitAnswer: timeout for ${opts.siteId}`));
    }, opts.timeoutMs);
    window.addEventListener('message', handler);
  });
}

/** Listen for content-ready heartbeats; resolves the first time `siteId` reports in. */
export function awaitContentReady(siteId: SiteId, expectedOrigin: string, timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const handler = (ev: MessageEvent<ContentReadyMessage>) => {
      if (ev.origin !== expectedOrigin) return;
      const m = ev.data;
      if (!m || typeof m !== 'object') return;
      if (m.type !== 'MULTIAI_CONTENT_READY') return;
      if (m.siteId !== siteId) return;
      cleanup();
      resolve();
    };
    const cleanup = () => {
      window.removeEventListener('message', handler);
      clearTimeout(timer);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`awaitContentReady: ${siteId} did not report in within ${timeoutMs}ms`));
    }, timeoutMs);
    window.addEventListener('message', handler);
  });
}

let counter = 0;
export function newRequestId(): string {
  counter += 1;
  return `req-${Date.now().toString(36)}-${counter.toString(36)}`;
}

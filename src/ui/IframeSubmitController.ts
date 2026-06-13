import { SITES } from '@/sites/registry';
import type { SiteId } from '@/types';
import type { FrameRef } from './components/IframesGrid';

/**
 * Manages retried postMessage submissions to iframes that need DOM-driven input
 * (sites without a `queryUrlTemplate`). Holds the per-site retry timers and
 * cancels a site's pending retries once its content script ACKs the submit.
 */
export class IframeSubmitController {
  private timersBySite = new Map<SiteId, number[]>();

  /** Kick off retried submissions for every frame that submits via the DOM. */
  scheduleSubmissions(frames: readonly FrameRef[], query: string): void {
    for (const frame of frames) {
      const site = SITES[frame.siteId];
      if (site.queryUrlTemplate) continue;
      this.retrySubmitToFrame(frame.siteId, frame.origin, frame.iframe, query);
    }
  }

  private retrySubmitToFrame(
    siteId: SiteId,
    origin: string,
    iframe: HTMLIFrameElement,
    query: string
  ): void {
    const delays =
      siteId === 'claude' ? [700, 3000, 7000] : [250, 900, 1800, 3200, 5200, 8000, 12000];
    const requestId = `submit-${siteId}-${Date.now()}`;
    const timers: number[] = [];
    this.timersBySite.set(siteId, timers);
    for (const delay of delays) {
      const timer = window.setTimeout(() => {
        iframe.contentWindow?.postMessage(
          {
            type: 'MULTIAI_SUBMIT_QUERY',
            siteId,
            query,
            requestId
          },
          origin
        );
      }, delay);
      timers.push(timer);
    }
  }

  /** Cancel all pending retries across every site. */
  clearAll(): void {
    for (const timers of this.timersBySite.values()) {
      for (const timer of timers) window.clearTimeout(timer);
    }
    this.timersBySite.clear();
  }

  private clearFor(siteId: SiteId): void {
    const timers = this.timersBySite.get(siteId);
    if (!timers) return;
    for (const timer of timers) window.clearTimeout(timer);
    this.timersBySite.delete(siteId);
  }

  /** Handle a window `message` event; stops a site's retries on a successful ACK. */
  handleAck(ev: MessageEvent): void {
    const msg = ev.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type !== 'MULTIAI_SUBMIT_ACK') return;
    if (msg.ok !== true) return;
    this.clearFor(msg.siteId);
  }
}

import { SITES } from '@/sites/registry';
import type { BackgroundRequest, BackgroundResponse, SiteId, SiteResponse } from '@/types';
import type { IframesGrid } from './components/IframesGrid';

/**
 * Encapsulates all communication with the background service worker that drives
 * an iframe-hostile AI site (e.g. Perplexity) in a hidden browser tab. Owns the
 * captured response so both the submit flow and a later synthesis run can reuse
 * it without re-extracting. Parameterized by `siteId`, so any site registered as
 * an offscreen adapter in the service worker can be driven through one instance.
 */
export class OffscreenBridge {
  private response: SiteResponse | null = null;
  private readonly displayName: string;

  constructor(private grid: IframesGrid, private siteId: SiteId) {
    this.displayName = SITES[siteId].displayName;
  }

  /** Forget the last captured response (called at the start of a new submit). */
  reset(): void {
    this.response = null;
  }

  async submit(query: string): Promise<void> {
    this.grid.setMirrorStatus(
      this.siteId,
      `Opening ${this.displayName} in a background tab...`,
      'busy'
    );
    this.grid.setMirrorContent(this.siteId, `Waiting for ${this.displayName} response...`);

    const submit = await this.sendBackground({
      type: 'MULTIAI_OFFSCREEN_SUBMIT',
      siteId: this.siteId,
      query
    });

    if (!submit.ok) {
      this.showError(submit);
      return;
    }

    this.grid.setMirrorStatus(this.siteId, 'Query sent. Capturing visible response...', 'busy');
    await this.pollAnswer(query);
  }

  private async pollAnswer(query: string): Promise<SiteResponse | null> {
    const started = Date.now();
    let lastText = '';
    let stableCount = 0;
    const minCaptureMs = 12000;
    const stablePollsNeeded = 3;

    while (Date.now() - started < 90000) {
      await sleep(2500);
      const extracted = await this.sendBackground({
        type: 'MULTIAI_OFFSCREEN_EXTRACT',
        siteId: this.siteId,
        query
      });

      if (!extracted.ok) {
        if (extracted.needsUserAction) {
          this.showError(extracted);
          return null;
        }
        this.grid.setMirrorStatus(
          this.siteId,
          extracted.error ?? `Waiting for ${this.displayName} response...`,
          'busy'
        );
        continue;
      }

      const text = extracted.text?.trim() ?? '';
      if (!text) continue;

      const elapsed = Date.now() - started;
      const changed = text !== lastText;
      if (changed) stableCount = 0;
      else stableCount += 1;
      lastText = text;

      this.grid.setMirrorContent(this.siteId, text);
      const ready = elapsed >= minCaptureMs && stableCount >= stablePollsNeeded;
      this.grid.setMirrorStatus(
        this.siteId,
        ready
          ? 'Response ready to synthesize.'
          : `Capturing ${this.displayName}... ${text.length.toLocaleString()} characters`,
        ready ? 'ok' : 'busy'
      );

      if (ready) {
        this.response = { siteId: this.siteId, text };
        return this.response;
      }
    }

    if (lastText) {
      this.response = { siteId: this.siteId, text: lastText };
      this.grid.setMirrorStatus(this.siteId, 'Timeout; using partial response.', 'ok');
      return this.response;
    }

    this.grid.setMirrorStatus(this.siteId, `Could not capture ${this.displayName} response.`, 'fail');
    return null;
  }

  /**
   * Return the captured response for a synthesis run, extracting one on demand if
   * none was captured yet. Caller is responsible for checking that the site is
   * enabled before calling.
   */
  async responseForSynthesis(query?: string): Promise<SiteResponse[]> {
    if (this.response?.text) return [this.response];

    const extracted = await this.sendBackground({
      type: 'MULTIAI_OFFSCREEN_EXTRACT',
      siteId: this.siteId,
      query
    });
    if (extracted.ok && extracted.text?.trim()) {
      this.response = { siteId: this.siteId, text: extracted.text.trim() };
      this.grid.setMirrorContent(this.siteId, this.response.text);
      this.grid.setMirrorStatus(this.siteId, 'Response captured for synthesis.', 'ok');
      return [this.response];
    }
    return [];
  }

  async open(active: boolean): Promise<void> {
    const response = await this.sendBackground({
      type: 'MULTIAI_OFFSCREEN_OPEN',
      siteId: this.siteId,
      active
    });
    if (!response.ok) this.showError(response);
  }

  private showError(response: BackgroundResponse): void {
    const message = response.needsUserAction
      ? `${this.displayName} requires human verification. Use "Open", resolve it once, and return to the extension.`
      : response.error ?? `Could not use ${this.displayName}.`;
    this.grid.setMirrorStatus(this.siteId, message, 'fail');
    this.grid.setMirrorContent(this.siteId, message);
  }

  private async sendBackground(message: BackgroundRequest): Promise<BackgroundResponse> {
    try {
      return (await chrome.runtime.sendMessage(message)) as BackgroundResponse;
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        needsUserAction: false
      };
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

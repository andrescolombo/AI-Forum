import type { BackgroundRequest, BackgroundResponse, SiteResponse } from '@/types';
import type { IframesGrid } from './components/IframesGrid';

/**
 * Encapsulates all communication with the background service worker that drives
 * Perplexity in a hidden browser tab (Perplexity blocks iframe embedding). Owns
 * the captured response so both the submit flow and a later synthesis run can
 * reuse it without re-extracting.
 */
export class PerplexityBridge {
  private response: SiteResponse | null = null;

  constructor(private grid: IframesGrid) {}

  /** Forget the last captured response (called at the start of a new submit). */
  reset(): void {
    this.response = null;
  }

  async submit(query: string): Promise<void> {
    this.grid.setMirrorStatus(
      'perplexity',
      'Opening Perplexity in a background tab...',
      'busy'
    );
    this.grid.setMirrorContent('perplexity', 'Waiting for Perplexity response...');

    const submit = await this.sendBackground({
      type: 'MULTIAI_PERPLEXITY_SUBMIT',
      query
    });

    if (!submit.ok) {
      this.showError(submit);
      return;
    }

    this.grid.setMirrorStatus('perplexity', 'Query sent. Capturing visible response...', 'busy');
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
      const extracted = await this.sendBackground({ type: 'MULTIAI_PERPLEXITY_EXTRACT', query });

      if (!extracted.ok) {
        if (extracted.needsUserAction) {
          this.showError(extracted);
          return null;
        }
        this.grid.setMirrorStatus(
          'perplexity',
          extracted.error ?? 'Waiting for Perplexity response...',
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

      this.grid.setMirrorContent('perplexity', text);
      const ready = elapsed >= minCaptureMs && stableCount >= stablePollsNeeded;
      this.grid.setMirrorStatus(
        'perplexity',
        ready
          ? 'Response ready to synthesize.'
          : `Capturing Perplexity... ${text.length.toLocaleString()} characters`,
        ready ? 'ok' : 'busy'
      );

      if (ready) {
        this.response = { siteId: 'perplexity', text };
        return this.response;
      }
    }

    if (lastText) {
      this.response = { siteId: 'perplexity', text: lastText };
      this.grid.setMirrorStatus('perplexity', 'Timeout; using partial response.', 'ok');
      return this.response;
    }

    this.grid.setMirrorStatus('perplexity', 'Could not capture Perplexity response.', 'fail');
    return null;
  }

  /**
   * Return the captured Perplexity response for a synthesis run, extracting one
   * on demand if none was captured yet. Caller is responsible for checking that
   * Perplexity is enabled before calling.
   */
  async responseForSynthesis(query?: string): Promise<SiteResponse[]> {
    if (this.response?.text) return [this.response];

    const extracted = await this.sendBackground({
      type: 'MULTIAI_PERPLEXITY_EXTRACT',
      query
    });
    if (extracted.ok && extracted.text?.trim()) {
      this.response = { siteId: 'perplexity', text: extracted.text.trim() };
      this.grid.setMirrorContent('perplexity', this.response.text);
      this.grid.setMirrorStatus('perplexity', 'Response captured for synthesis.', 'ok');
      return [this.response];
    }
    return [];
  }

  async open(active: boolean): Promise<void> {
    const response = await this.sendBackground({ type: 'MULTIAI_PERPLEXITY_OPEN', active });
    if (!response.ok) this.showError(response);
  }

  private showError(response: BackgroundResponse): void {
    const message = response.needsUserAction
      ? 'Perplexity requires human verification. Use "Open", resolve it once, and return to the extension.'
      : response.error ?? 'Could not use Perplexity.';
    this.grid.setMirrorStatus('perplexity', message, 'fail');
    this.grid.setMirrorContent('perplexity', message);
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

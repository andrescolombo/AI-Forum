/**
 * Content script injected into every supported AI site.
 *
 * Lifecycle:
 *   1. On load, detect which adapter handles this URL.
 *   2. Tell the parent we're ready.
 *   3. Listen for SUBMIT_QUERY / EXTRACT_ANSWER messages from the parent
 *      and reply with results.
 *
 * Hardening notes (lessons from v1):
 *   - We DO NOT poll for "stable response" here. The parent decides when to
 *     extract; we just hand back what's on screen at that moment + a `stable`
 *     hint so the UI can show "still streaming".
 *   - We never throw out of a message handler — adapter errors become a
 *     message reply with empty text, so the parent's collection promise can
 *     resolve cleanly.
 */

import { adapterForUrl } from '@/sites';
import type {
  AnswerExtractedMessage,
  ContentReadyMessage,
  ParentToChildMessage,
  SubmitAckMessage
} from '@/types';

const adapter = adapterForUrl(new URL(location.href));

if (adapter) {
  const handledSubmits = new Set<string>();

  const reply = <M extends AnswerExtractedMessage | ContentReadyMessage | SubmitAckMessage>(msg: M) => {
    // The parent UI (extension page) is window.parent for an iframe.
    // We post to '*' because the parent's origin is chrome-extension://<id>
    // and we don't know the id at content-script time. The parent filters by
    // message.type before trusting any payload.
    window.parent.postMessage(msg, '*');
  };

  reply<ContentReadyMessage>({ type: 'MULTIAI_CONTENT_READY', siteId: adapter.id });

  window.addEventListener('message', async (ev: MessageEvent<ParentToChildMessage>) => {
    const msg = ev.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type !== 'MULTIAI_SUBMIT_QUERY' && msg.type !== 'MULTIAI_EXTRACT_ANSWER') return;
    if (msg.siteId !== adapter.id) return;

    if (msg.type === 'MULTIAI_SUBMIT_QUERY') {
      if (handledSubmits.has(msg.requestId)) {
        reply<SubmitAckMessage>({
          type: 'MULTIAI_SUBMIT_ACK',
          siteId: adapter.id,
          requestId: msg.requestId,
          ok: true
        });
        return;
      }
      let ok = true;
      try {
        await adapter.submitQuery(msg.query);
        handledSubmits.add(msg.requestId);
      } catch (err) {
        ok = false;
        console.warn('[multiai]', adapter.id, 'submitQuery failed:', err);
      }
      reply<SubmitAckMessage>({
        type: 'MULTIAI_SUBMIT_ACK',
        siteId: adapter.id,
        requestId: msg.requestId,
        ok
      });
      return;
    }

    // EXTRACT_ANSWER
    let text = '';
    let stable = false;
    try {
      const result = adapter.extractAnswer();
      text = result.text;
      stable = result.stable;
    } catch (err) {
      console.warn('[multiai]', adapter.id, 'extractAnswer failed:', err);
    }
    reply<AnswerExtractedMessage>({
      type: 'MULTIAI_ANSWER_EXTRACTED',
      siteId: adapter.id,
      requestId: msg.requestId,
      text,
      stable
    });
  });
}

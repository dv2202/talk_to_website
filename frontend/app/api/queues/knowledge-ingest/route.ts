import { handleCallback } from "@vercel/queue";
import {
    MAX_INGEST_DELIVERIES,
    runIngestJob,
    SourceBusyError,
    type IngestMessage,
} from "@/lib/ingest/queue";
import { STALE_LOCK_MS } from "@/lib/ingest/pipeline";

export const runtime = "nodejs";
// Large PDFs: parse + embed can take minutes. The queue lease is renewed while we run.
export const maxDuration = 300;

/**
 * Vercel Queue consumer for the `knowledge-ingest` topic (see vercel.json).
 * Invoked by Vercel only — the SDK verifies the callback request.
 */
const consume = handleCallback<IngestMessage>(
  async (message, metadata) => {
    if (!message?.sourceId) return; // malformed — acknowledge and drop
    await runIngestJob(message.sourceId, metadata.deliveryCount);
  },
  {
    visibilityTimeoutSeconds: 300,
    retry: (error, metadata) => {
      // Another worker holds it (or crashed holding it): wait for it to finish
      // or for the lock to go stale. Bounded by the message's 24h retention.
      if (error instanceof SourceBusyError) {
        return { afterSeconds: Math.ceil(STALE_LOCK_MS / 1000 / 2) };
      }
      if (metadata.deliveryCount >= MAX_INGEST_DELIVERIES) return { acknowledge: true };
      // 30s, 60s, 120s ...
      return { afterSeconds: Math.min(600, 30 * 2 ** (metadata.deliveryCount - 1)) };
    },
  },
);

// Next's route type checker wants a plain (request: Request) handler.
export async function POST(request: Request): Promise<Response> {
  return consume(request);
}

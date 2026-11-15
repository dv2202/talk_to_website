import type { Embeddings } from "@langchain/core/embeddings";

export const EMBED_BATCH_SIZE = Number(process.env.EMBED_BATCH_SIZE || 64);
const MAX_BATCH_RETRIES = 5;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(error: unknown): boolean {
  const e = error as { status?: number; code?: string | number; message?: string } | null;
  const status = Number(e?.status ?? e?.code);
  if (status === 429 || (status >= 500 && status < 600)) return true;
  const message = String(e?.message ?? "").toLowerCase();
  return /rate limit|quota|timeout|timed out|econnreset|socket hang up|unavailable|overloaded/.test(
    message,
  );
}

/**
 * Embeds texts in fixed-size batches with exponential backoff on rate limits
 * and transient provider errors. `onBatch` fires after each batch (for progress).
 */
export async function embedInBatches(
  embeddings: Embeddings,
  texts: string[],
  onBatch?: (done: number, total: number) => Promise<void>,
  options: { batchSize?: number; sleepFn?: (ms: number) => Promise<unknown> } = {},
): Promise<number[][]> {
  const batchSize = Math.max(1, options.batchSize ?? EMBED_BATCH_SIZE);
  const wait = options.sleepFn ?? sleep;
  const vectors: number[][] = [];

  for (let offset = 0; offset < texts.length; offset += batchSize) {
    const batch = texts.slice(offset, offset + batchSize);
    let attempt = 0;
    for (;;) {
      try {
        const result = await embeddings.embedDocuments(batch);
        if (result.length !== batch.length) {
          throw new Error(`Embedding provider returned ${result.length} vectors for ${batch.length} texts`);
        }
        vectors.push(...result);
        break;
      } catch (error) {
        attempt++;
        if (attempt > MAX_BATCH_RETRIES || !isRetryable(error)) throw error;
        const backoff = Math.min(30_000, 1000 * 2 ** (attempt - 1)) + Math.random() * 250;
        await wait(backoff);
      }
    }
    await onBatch?.(Math.min(offset + batch.length, texts.length), texts.length);
  }

  return vectors;
}

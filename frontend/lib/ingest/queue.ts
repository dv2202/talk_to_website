import { after } from "next/server";
import { send } from "@vercel/queue";
import {
  claimSource,
  markSourceFailed,
  markSourceRetrying,
  processKnowledgeSource,
} from "@/lib/ingest/pipeline";
import { IngestError } from "@/lib/ingest/parse";

export const INGEST_TOPIC = "knowledge-ingest";
/** Total deliveries (first try + retries) before a source is marked FAILED. */
export const MAX_INGEST_DELIVERIES = 4;

export type IngestMessage = { sourceId: string };

/** Thrown when another worker holds the source; the queue redelivers later. */
export class SourceBusyError extends Error {
  constructor(sourceId: string) {
    super(`Source ${sourceId} is being processed by another worker`);
    this.name = "SourceBusyError";
  }
}

/**
 * "vercel": durable Vercel Queue (default when deployed on Vercel).
 * "inline": runs after the response in the same process (local dev / self-hosted).
 */
function queueMode(): "vercel" | "inline" {
  const configured = process.env.KNOWLEDGE_QUEUE_MODE;
  if (configured === "vercel" || configured === "inline") return configured;
  return process.env.VERCEL ? "vercel" : "inline";
}

/**
 * Runs one ingest attempt. Never throws for terminal outcomes (so the queue
 * acknowledges the message); throws only when the queue should redeliver.
 */
export async function runIngestJob(sourceId: string, deliveryCount: number): Promise<void> {
  const claim = await claimSource(sourceId);
  if (claim === "skip") return; // duplicate delivery / already done / deleted
  if (claim === "busy") throw new SourceBusyError(sourceId);

  try {
    const { chunks } = await processKnowledgeSource(sourceId);
    console.info(`[ingest] ${sourceId} ready (${chunks} chunks, delivery ${deliveryCount})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const permanent = error instanceof IngestError && error.permanent;
    if (permanent || deliveryCount >= MAX_INGEST_DELIVERIES) {
      console.error(`[ingest] ${sourceId} failed permanently:`, error);
      await markSourceFailed(sourceId, message);
      return;
    }
    console.warn(`[ingest] ${sourceId} attempt ${deliveryCount} failed, will retry:`, message);
    await markSourceRetrying(sourceId, message);
    throw error;
  }
}

/** Queues sources for background ingestion. Returns immediately. */
export async function enqueueIngest(sourceIds: string[]): Promise<void> {
  if (sourceIds.length === 0) return;

  if (queueMode() === "vercel") {
    await Promise.all(
      sourceIds.map((sourceId) =>
        send<IngestMessage>(INGEST_TOPIC, { sourceId }, { retentionSeconds: 24 * 60 * 60 }),
      ),
    );
    return;
  }

  after(async () => {
    for (const sourceId of sourceIds) {
      try {
        await runIngestJob(sourceId, MAX_INGEST_DELIVERIES); // single attempt inline
      } catch (error) {
        console.error(`[ingest:inline] ${sourceId}`, error);
      }
    }
  });
}

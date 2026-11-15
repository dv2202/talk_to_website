import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

export const KNOWLEDGE_BLOB_PREFIX = "knowledge";

export function knowledgeBlobPrefix(botId: string) {
  return `${KNOWLEDGE_BLOB_PREFIX}/${botId}/`;
}

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

export async function findOwnedBot(botId: unknown, userId: string) {
  if (typeof botId !== "string" || !botId) return null;
  return prisma.bot.findFirst({ where: { id: botId, userId }, select: { id: true } });
}

/** Fields the dashboard needs to render a source + its ingest state. */
export const sourceStatusSelect = {
  id: true,
  type: true,
  name: true,
  status: true,
  progress: true,
  error: true,
  pageCount: true,
  chunkCount: true,
  fileSize: true,
  createdAt: true,
  updatedAt: true,
  processedAt: true,
} as const;

/** Best-effort removal of raw uploads from Blob storage. */
export async function deleteSourceFiles(urls: Array<string | null | undefined>) {
  const targets = urls.filter((u): u is string => Boolean(u));
  if (targets.length === 0 || !isBlobConfigured()) return;
  try {
    await del(targets);
  } catch (error) {
    console.error("[knowledge] failed to delete source files:", error);
  }
}

/**
 * Re-queues a bot's sources that failed or whose content changed since the
 * last successful ingest. Returns how many were queued.
 */
export async function requeueStaleSources(botId: string, onlyIds?: string[]): Promise<string[]> {
  const { createHash } = await import("node:crypto");
  const sources = await prisma.knowledgeSource.findMany({
    where: { botId, ...(onlyIds ? { id: { in: onlyIds } } : {}) },
    select: { id: true, status: true, content: true, contentHash: true, fileUrl: true },
  });

  const stale = sources.filter((s: (typeof sources)[number]) => {
    if (s.status === "FAILED") return true;
    if (s.status !== "READY") return false; // PENDING/PROCESSING already in the queue
    if (!s.content && s.fileUrl) return false;
    return createHash("sha256").update(s.content).digest("hex") !== s.contentHash;
  });
  const ids = stale.map((s: (typeof sources)[number]) => s.id);
  if (ids.length === 0) return [];

  await prisma.knowledgeSource.updateMany({
    where: { id: { in: ids } },
    data: { status: "PENDING", progress: 0, error: null },
  });
  return ids;
}

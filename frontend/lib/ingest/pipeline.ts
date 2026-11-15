import { createHash } from "node:crypto";
import { Document } from "@langchain/core/documents";
import { get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { createEmbeddings } from "@/lib/rag/embeddings";
import { chunkDocuments } from "@/lib/rag/chunking/textChunker";
import { loadDocument } from "@/lib/rag/loaders/documentLoader";
import { storeChunks } from "@/lib/rag/vector-store/repository";
import { cleanPages, normalizeText } from "@/lib/ingest/clean";
import { embedInBatches } from "@/lib/ingest/embed";
import { detectFileKind, IngestError, MAX_UPLOAD_BYTES, parseFile } from "@/lib/ingest/parse";
import { createProgressReporter } from "@/lib/ingest/progress";

/**
 * A PROCESSING row not updated for this long belongs to a crashed/timed-out
 * worker (function maxDuration is 300s and progress writes refresh updatedAt).
 */
export const STALE_LOCK_MS = 6 * 60 * 1000;
const PAGE_SEPARATOR = "\n\n";

function sha256(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

export type ClaimResult = "claimed" | "busy" | "skip";

/**
 * Atomically claims a source for processing. This makes at-least-once queue
 * delivery safe: duplicates of a finished job become no-ops ("skip"), and a
 * job another worker is running right now is reported as "busy".
 */
export async function claimSource(sourceId: string): Promise<ClaimResult> {
  const { count } = await prisma.knowledgeSource.updateMany({
    where: {
      id: sourceId,
      OR: [
        { status: { in: ["PENDING", "FAILED"] } },
        { status: "PROCESSING", updatedAt: { lt: new Date(Date.now() - STALE_LOCK_MS) } },
      ],
    },
    data: { status: "PROCESSING", progress: 0, error: null, attempts: { increment: 1 } },
  });
  if (count === 1) return "claimed";

  const current = await prisma.knowledgeSource.findUnique({
    where: { id: sourceId },
    select: { status: true },
  });
  return current?.status === "PROCESSING" ? "busy" : "skip";
}

async function downloadBlob(url: string): Promise<Buffer> {
  const result = await get(url, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new IngestError("Uploaded file is missing from storage", true);
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = result.stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_UPLOAD_BYTES) throw new IngestError("File exceeds the 20MB limit", true);
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** Drops chunks whose normalised text we've already seen (repeated boilerplate, duplicated pages). */
export function dedupeChunks(chunks: Document[]): Document[] {
  const seen = new Set<string>();
  return chunks.filter((chunk) => {
    const key = sha256(chunk.pageContent.toLowerCase().replace(/\s+/g, " ").trim());
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Full ingest for one KnowledgeSource:
 * download → parse → clean → chunk → embed (batched, retried) → store.
 * Caller must have claimed the source with `claimSource` first.
 */
export async function processKnowledgeSource(sourceId: string): Promise<{ chunks: number }> {
  const source = await prisma.knowledgeSource.findUnique({ where: { id: sourceId } });
  if (!source) throw new IngestError("Source was deleted", true);

  const report = createProgressReporter(async (step) => {
    await prisma.knowledgeSource.updateMany({
      where: { id: sourceId, status: "PROCESSING" },
      data: { progress: step },
    });
  });

  const metadata = { sourceType: source.type, title: source.name, name: source.name };
  let documents: Document[];
  let content = source.content;

  if (source.fileUrl && !content) {
    // ── File upload: download → parse → clean (content is persisted so retries skip this)
    const buffer = await downloadBlob(source.fileUrl);
    await report("download", 1);

    const kind = detectFileKind(source.name || "", buffer);
    if (!kind) throw new IngestError("Only PDF and TXT files are supported", true);
    const rawPages = await parseFile(kind, buffer);
    await report("parse", 1);

    const pages = cleanPages(rawPages);
    if (pages.length === 0) {
      throw new IngestError(
        "No readable text found. Scanned/image-only PDFs aren't supported yet.",
        true,
      );
    }
    content = pages.map((p) => p.text).join(PAGE_SEPARATOR);
    await prisma.knowledgeSource.update({
      where: { id: sourceId },
      data: { content, pageCount: rawPages.length },
    });
    await report("clean", 1);

    documents = pages.map(
      (page) =>
        new Document({
          pageContent: page.text,
          metadata: { ...metadata, sourceId, botId: source.botId, pageNumber: page.pageNumber },
        }),
    );
  } else {
    // ── URL / inline text: content already stored; split on markdown headings.
    content = normalizeText(content);
    if (!content) throw new IngestError("Source has no content", true);
    await report("clean", 1);
    documents = await loadDocument({ sourceId, botId: source.botId, content, metadata });
  }

  const chunks = dedupeChunks(await chunkDocuments(documents));
  await report("chunk", 1);

  const embeddings = await createEmbeddings();
  const vectors = await embedInBatches(
    embeddings,
    chunks.map((c) => c.pageContent),
    (done, total) => report("embed", done / total),
  );

  await storeChunks({ botId: source.botId, sourceId, chunks, embeddings: vectors });

  await prisma.knowledgeSource.update({
    where: { id: sourceId },
    data: {
      status: "READY",
      progress: 100,
      error: null,
      contentHash: sha256(content),
      chunkCount: chunks.length,
      processedAt: new Date(),
    },
  });

  return { chunks: chunks.length };
}

export async function markSourceFailed(sourceId: string, message: string) {
  await prisma.knowledgeSource.updateMany({
    where: { id: sourceId },
    data: { status: "FAILED", error: message.slice(0, 500) },
  });
}

/** Puts the source back to PENDING so the queue's redelivery can claim it again. */
export async function markSourceRetrying(sourceId: string, message: string) {
  await prisma.knowledgeSource.updateMany({
    where: { id: sourceId, status: "PROCESSING" },
    data: { status: "PENDING", progress: 0, error: `Retrying: ${message}`.slice(0, 500) },
  });
}

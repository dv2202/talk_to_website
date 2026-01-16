import { prisma, withAccelerateRetry } from '@/lib/prisma';
import { Document } from '@langchain/core/documents';
import { createHash, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { loadRAGConfig } from '../config';

interface StoreOptions {
  botId: string;
  sourceId: string;
  chunks: Document[];
  embeddings: number[][];
}

export interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  sourceId: string;
  chunkIndex: number;
  similarity: number;
}

interface SimilarityRow {
  id: string;
  content: string;
  metadata: Record<string, unknown> | null;
  sourceId: string;
  chunkIndex: number;
  similarity: number;
}

/** Format a number[] as a pgvector literal: [0.1,0.2,...] */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

function assertEmbeddingDimensions(embeddings: number[][]): number {
  const expected = loadRAGConfig().embedding.dimensions;
  for (let i = 0; i < embeddings.length; i++) {
    if (embeddings[i].length !== expected) {
      throw new Error(
        `Embedding at index ${i} has ${embeddings[i].length} dimensions; expected ${expected}`
      );
    }
  }
  return expected;
}

export async function storeChunks(options: StoreOptions): Promise<void> {
  const { botId, sourceId, chunks, embeddings } = options;

  if (chunks.length !== embeddings.length) {
    throw new Error('Chunks and embeddings arrays must have the same length');
  }

  if (chunks.length === 0) {
    await prisma.knowledgeChunk.deleteMany({
      where: { sourceId },
    });
    return;
  }

  assertEmbeddingDimensions(embeddings);

  // Avoid interactive $transaction — Prisma Accelerate often times out when
  // embedding sync holds a remote transaction open. Delete-then-insert is
  // still safe per sourceId; vector writes require raw SQL.
  await prisma.knowledgeChunk.deleteMany({
    where: { sourceId },
  });

  const now = new Date();
  const BATCH_SIZE = 25;

  for (let offset = 0; offset < chunks.length; offset += BATCH_SIZE) {
    const batchChunks = chunks.slice(offset, offset + BATCH_SIZE);
    const batchEmbeddings = embeddings.slice(offset, offset + BATCH_SIZE);

    const values = batchChunks.map((chunk, i) => {
      const id = randomUUID();
      const contentHash = computeHash(chunk.pageContent);
      const metadata = chunk.metadata || {};
      const vector = toVectorLiteral(batchEmbeddings[i]);

      return Prisma.sql`(
        ${id},
        ${botId},
        ${sourceId},
        ${chunk.pageContent},
        ${offset + i},
        ${JSON.stringify(metadata)}::jsonb,
        ${contentHash},
        ${vector}::vector,
        ${now},
        ${now}
      )`;
    });

    await prisma.$executeRaw`
      INSERT INTO "KnowledgeChunk" (
        "id", "botId", "sourceId", "content", "chunkIndex",
        "metadata", "contentHash", "embedding", "createdAt", "updatedAt"
      )
      VALUES ${Prisma.join(values)}
    `;
  }
}

export async function similaritySearch(
  botId: string,
  queryEmbedding: number[],
  topK: number,
  threshold: number
): Promise<SearchResult[]> {
  const expected = loadRAGConfig().embedding.dimensions;
  if (queryEmbedding.length !== expected) {
    throw new Error(
      `Query embedding has ${queryEmbedding.length} dimensions; expected ${expected}`
    );
  }

  const vector = toVectorLiteral(queryEmbedding);

  const rows = (await withAccelerateRetry(() =>
    prisma.$queryRaw`
      SELECT
        id,
        content,
        metadata,
        "sourceId",
        "chunkIndex",
        (1 - (embedding <=> ${vector}::vector))::float8 AS similarity
      FROM "KnowledgeChunk"
      WHERE "botId" = ${botId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vector}::vector
      LIMIT ${topK}
    `
  )) as SimilarityRow[];

  if (rows.length === 0) {
    return [];
  }

  const topResults: SearchResult[] = rows.map((row: SimilarityRow) => ({
    id: row.id,
    content: row.content,
    metadata: row.metadata ?? {},
    sourceId: row.sourceId,
    chunkIndex: Number(row.chunkIndex),
    similarity: Number(row.similarity),
  }));

  // Keep results near the best match. A hard absolute threshold alone drops
  // good factual hits (e.g. "founder email") when an unrelated chunk clears
  // the bar first.
  const best = topResults[0].similarity;
  const floor = Math.min(threshold, Math.max(0, best - 0.15));
  return topResults.filter((r) => r.similarity >= floor);
}

const KEYWORD_STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'am',
  'what', 'where', 'when', 'who', 'whom', 'which', 'how', 'why',
  'do', 'does', 'did', 'can', 'could', 'should', 'would', 'will',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its', 'this',
  'that', 'these', 'those', 'to', 'of', 'in', 'on', 'for', 'with',
  'about', 'from', 'as', 'at', 'by', 'or', 'and', 'if', 'then', 'please',
  'tell', 'me', 'give', 'show', 'find', 'get', 'need', 'want', 'know',
]);

export function extractSearchTerms(query: string): string[] {
  const emailMatches = query.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const words = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}@._+-]+/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !KEYWORD_STOP_WORDS.has(w));

  return Array.from(new Set([...emailMatches.map((e) => e.toLowerCase()), ...words]));
}

function scoreKeywordMatch(content: string, terms: string[]): number {
  const lower = content.toLowerCase();
  let hits = 0;
  let weighted = 0;

  for (const term of terms) {
    if (!lower.includes(term)) continue;
    hits++;
    // Longer / more specific terms (emails, "founder") weigh more
    weighted += Math.min(1, term.length / 8);
  }

  if (hits === 0) return 0;
  const coverage = hits / terms.length;
  return Math.min(0.95, 0.45 + coverage * 0.35 + (weighted / terms.length) * 0.15);
}

export async function keywordSearch(
  botId: string,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const terms = extractSearchTerms(query).slice(0, 6);
  if (terms.length === 0) {
    return [];
  }

  try {
    // ILIKE via raw SQL is lighter/more reliable through Accelerate than
    // Prisma `contains` + `mode: insensitive` with a large OR clause.
    const termFilters = terms.map(
      (term) => Prisma.sql`content ILIKE ${'%' + term + '%'}`
    );
    const take = Math.max(limit * 10, 40);

    const candidates = (await withAccelerateRetry(() =>
      prisma.$queryRaw`
        SELECT id, content, metadata, "sourceId", "chunkIndex"
        FROM "KnowledgeChunk"
        WHERE "botId" = ${botId}
          AND (${Prisma.join(termFilters, ' OR ')})
        LIMIT ${take}
      `
    )) as Array<{
      id: string;
      content: string;
      metadata: Record<string, unknown> | null;
      sourceId: string;
      chunkIndex: number;
    }>;

    const scored: SearchResult[] = candidates.map((chunk) => ({
      id: chunk.id,
      content: chunk.content,
      metadata: chunk.metadata ?? {},
      sourceId: chunk.sourceId,
      chunkIndex: Number(chunk.chunkIndex),
      similarity: scoreKeywordMatch(chunk.content, terms),
    }));

    return scored
      .filter((result) => result.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  } catch (error) {
    // Keyword search is complementary to vector search — don't fail chat.
    console.warn('keywordSearch failed; continuing with vector results:', error);
    return [];
  }
}

export async function deleteChunksBySource(sourceId: string): Promise<number> {
  const result = await prisma.knowledgeChunk.deleteMany({
    where: { sourceId },
  });

  return result.count;
}

export async function deleteChunksByBot(botId: string): Promise<number> {
  const result = await prisma.knowledgeChunk.deleteMany({
    where: { botId },
  });

  return result.count;
}

export async function getChunkCount(botId: string): Promise<number> {
  return prisma.knowledgeChunk.count({
    where: { botId },
  });
}

export async function getSourceChunkCount(sourceId: string): Promise<number> {
  return prisma.knowledgeChunk.count({
    where: { sourceId },
  });
}

function computeHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { createEmbeddings } from '../embeddings';
import { chunkDocuments } from '../chunking/textChunker';
import { storeChunks } from '../vector-store/repository';
import { loadDocument } from '../loaders/documentLoader';

interface SyncResult {
  processed: number;
  updated: number;
  deleted: number;
  skipped: number;
}

export async function syncKnowledgeBase(botId: string): Promise<SyncResult> {
  const sources = await prisma.knowledgeSource.findMany({
    where: { botId },
  });

  const embeddings = await createEmbeddings();
  const result: SyncResult = { processed: 0, updated: 0, deleted: 0, skipped: 0 };

  for (const source of sources) {
    result.processed++;

    const currentHash = computeContentHash(source.content);

    if (source.contentHash === currentHash) {
      result.skipped++;
      continue;
    }

    const documents = await loadDocument({
      sourceId: source.id,
      botId,
      content: source.content,
      metadata: {
        sourceType: source.type,
        title: source.name,
        name: source.name,
      },
    });

    const chunks = await chunkDocuments(documents);
    const chunkTexts = chunks.map((c) => c.pageContent);

    if (chunkTexts.length === 0) {
      result.skipped++;
      continue;
    }

    const chunkEmbeddings = await embeddings.embedDocuments(chunkTexts);

    await storeChunks({
      botId,
      sourceId: source.id,
      chunks,
      embeddings: chunkEmbeddings,
    });

    await prisma.knowledgeSource.update({
      where: { id: source.id },
      data: { contentHash: currentHash },
    });

    result.updated++;
  }

  const existingSourceIds = sources.map((s: { id: string }) => s.id);
  const deleted = await prisma.knowledgeChunk.deleteMany({
    where: {
      botId,
      sourceId: { notIn: existingSourceIds },
    },
  });
  result.deleted = deleted.count;

  return result;
}

export async function syncSingleSource(
  botId: string,
  sourceId: string
): Promise<{ success: boolean; chunksCreated: number }> {
  const source = await prisma.knowledgeSource.findUnique({
    where: { id: sourceId },
  });

  if (!source || source.botId !== botId) {
    throw new Error('Source not found');
  }

  const embeddings = await createEmbeddings();
  const currentHash = computeContentHash(source.content);
  
  const documents = await loadDocument({
    sourceId: source.id,
    botId,
    content: source.content,
    metadata: {
      sourceType: source.type,
      title: source.name,
      name: source.name,
    },
  });

  const chunks = await chunkDocuments(documents);
  const chunkTexts = chunks.map((c) => c.pageContent);

  if (chunkTexts.length === 0) {
    await prisma.knowledgeSource.update({
      where: { id: sourceId },
      data: { contentHash: currentHash },
    });
    return { success: true, chunksCreated: 0 };
  }

  const chunkEmbeddings = await embeddings.embedDocuments(chunkTexts);

  await storeChunks({
    botId,
    sourceId: source.id,
    chunks,
    embeddings: chunkEmbeddings,
  });

  await prisma.knowledgeSource.update({
    where: { id: sourceId },
    data: { contentHash: currentHash },
  });

  return { success: true, chunksCreated: chunks.length };
}

function computeContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

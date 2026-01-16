import { createEmbeddings } from '../embeddings';
import {
  similaritySearch,
  keywordSearch,
  SearchResult,
} from '../vector-store/repository';
import { loadRAGConfig } from '../config';

interface RetrieveOptions {
  botId: string;
  query: string;
  topK?: number;
  threshold?: number;
}

export interface RetrievedChunk {
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
  sourceId: string;
  chunkIndex: number;
}

const RRF_K = 60;

const CONTACT_QUERY_RE =
  /\b(contact|connect|reach|email|support|team|phone|call|get\s+in\s+touch|talk\s+to|speak\s+(?:to|with))\b/i;

/**
 * Merge vector + keyword hits with reciprocal rank fusion so short factual
 * queries ("founder email") still surface exact lexical matches.
 */
function mergeHybridResults(
  lists: Array<{ results: SearchResult[]; weight: number }>,
  topK: number
): SearchResult[] {
  const byId = new Map<string, SearchResult>();
  const scores = new Map<string, number>();

  for (const { results, weight } of lists) {
    results.forEach((result, index) => {
      byId.set(result.id, result);
      const rrf = weight / (RRF_K + index + 1);
      scores.set(result.id, (scores.get(result.id) || 0) + rrf);
    });
  }

  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([id, fusedScore]) => {
      const result = byId.get(id)!;
      return {
        ...result,
        // Keep the stronger signal for prompt transparency
        similarity: Math.max(result.similarity, fusedScore),
      };
    });
}

export async function retrieveRelevantChunks(
  options: RetrieveOptions
): Promise<RetrievedChunk[]> {
  try {
    const { botId, query, topK, threshold } = options;
    const config = loadRAGConfig();
    const k = topK ?? config.retrieval.topK;
    const simThreshold = threshold ?? config.retrieval.similarityThreshold;
    const isContactQuery = CONTACT_QUERY_RE.test(query);

    const embeddings = await createEmbeddings();
    const queryEmbedding = await embeddings.embedQuery(query);

    const settled = await Promise.allSettled([
      similaritySearch(botId, queryEmbedding, k, simThreshold),
      keywordSearch(botId, query, k),
      // Soft questions like "connect with your team" often miss the email chunk;
      // pull contact/email matches into the fusion set for those intents.
      isContactQuery
        ? keywordSearch(botId, 'contact support email', k)
        : Promise.resolve([] as SearchResult[]),
    ]);

    const [vectorResults, keywordResults, contactKeywordResults] = settled.map(
      (result, index) => {
        if (result.status === 'fulfilled') return result.value;
        console.warn(`RAG search branch ${index} failed:`, result.reason);
        return [] as SearchResult[];
      }
    );

    const fusionLists = [
      { results: vectorResults, weight: 1 },
      { results: keywordResults, weight: 1.25 },
      ...(contactKeywordResults.length > 0
        ? [{ results: contactKeywordResults, weight: 1.35 }]
        : []),
    ].filter((list) => list.results.length > 0);

    const results =
      fusionLists.length > 1
        ? mergeHybridResults(fusionLists, k)
        : vectorResults;

    return results.map((result) => ({
      content: result.content,
      metadata: result.metadata,
      similarity: result.similarity,
      sourceId: result.sourceId,
      chunkIndex: result.chunkIndex,
    }));
  } catch (error) {
    console.warn('retrieveRelevantChunks failed:', error);
    return [];
  }
}

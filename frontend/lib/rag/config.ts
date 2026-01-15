export interface RAGConfig {
  embedding: {
    provider: 'openai' | 'gemini';
    model: string;
    dimensions: number;
  };
  chunking: {
    size: number;
    overlap: number;
  };
  retrieval: {
    topK: number;
    similarityThreshold: number;
  };
}

export function loadRAGConfig(): RAGConfig {
  const provider = (process.env.EMBEDDING_PROVIDER as 'openai' | 'gemini') || 'openai';

  return {
    embedding: {
      provider,
      model:
        process.env.EMBEDDING_MODEL ||
        (provider === 'gemini' ? 'gemini-embedding-001' : 'text-embedding-3-small'),
      dimensions: parseInt(
        process.env.EMBEDDING_DIMENSIONS || '1536'
      ),
    },
    chunking: {
      size: parseInt(process.env.CHUNK_SIZE || '1000'),
      overlap: parseInt(process.env.CHUNK_OVERLAP || '150'),
    },
    retrieval: {
      topK: parseInt(process.env.TOP_K || '5'),
      similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD || '0.5'),
    },
  };
}

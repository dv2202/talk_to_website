# RAG Knowledge Base

This module implements a Retrieval-Augmented Generation (RAG) pipeline using LangChain and PostgreSQL with pgvector.

## Overview

The RAG system replaces the previous approach of injecting the entire knowledge base into every prompt. Instead, it:

1. Chunks knowledge sources into smaller pieces
2. Generates embeddings for each chunk
3. Stores chunks with embeddings in PostgreSQL with pgvector
4. Retrieves only the most relevant chunks per query
5. Constructs prompts with only the relevant context

## Architecture

```
Knowledge Sources (PDF/TXT/URL)
        ↓
Document Loader (LangChain)
        ↓
Markdown Parser + Text Splitter
        ↓
Embedding Generation (Configurable)
        ↓
PostgreSQL + pgvector (vector storage)
        ↓
Query Embedding → Similarity Search → Top-K Chunks
        ↓
Prompt Construction → LLM → Response + Sources
```

## Configuration

All configuration is via environment variables:

```bash
# Embedding Configuration
EMBEDDING_PROVIDER=gemini          # or 'openai'
EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIMENSIONS=3072

# Chunking Configuration
CHUNK_SIZE=1000                    # tokens
CHUNK_OVERLAP=150                  # tokens

# Retrieval Configuration
TOP_K=5                            # number of chunks to retrieve
SIMILARITY_THRESHOLD=0.75          # minimum similarity score
```

## API Endpoints

### Import Knowledge

```bash
POST /api/knowledge/import
Body: { "botId": "string" }
```

Triggers full sync of all knowledge sources for a bot. Only re-embeds changed sources.

### Sync Knowledge

```bash
POST /api/knowledge/sync
Body: { "botId": "string" }
```

Same as import - triggers incremental sync.

### Get Status

```bash
GET /api/knowledge/status?botId=string
```

Returns:
```json
{
  "sourceCount": 5,
  "chunkCount": 42,
  "lastSyncedAt": "2026-06-21T00:00:00.000Z"
}
```

## Migration

To migrate existing knowledge sources to RAG:

```bash
npx tsx scripts/migrate-to-rag.ts
```

This will:
1. Find all bots with knowledge sources
2. Generate embeddings for each source
3. Store chunks in the vector store

## How It Works

### 1. Knowledge Ingestion

When knowledge is added (via upload or URL scraping):
1. Content is parsed (markdown-aware splitting)
2. Documents are chunked (configurable size/overlap)
3. Embeddings are generated for each chunk
4. Chunks are stored in PostgreSQL with embeddings
5. Content hash is stored for incremental sync

### 2. Query Processing

When a user asks a question:
1. Query embedding is generated
2. Similarity search finds top-K relevant chunks
3. Chunks are filtered by similarity threshold
4. Prompt is constructed with only relevant context
5. LLM generates response grounded in the context

### 3. Incremental Sync

The system detects changes via content hashing:
- If content hash matches → skip (no re-embedding needed)
- If content hash differs → re-embed only that source
- If source is deleted → remove associated chunks

## Services

- `config.ts` - Configuration loading
- `embeddings/index.ts` - Embedding provider factory
- `loaders/documentLoader.ts` - Document loading
- `parsers/markdownParser.ts` - Markdown-aware parsing
- `chunking/textChunker.ts` - Text splitting
- `vector-store/repository.ts` - Database operations
- `retriever/retriever.ts` - Similarity search
- `prompt/promptBuilder.ts` - Prompt construction
- `sync/incrementalSync.ts` - Change detection
- `services/knowledgeBaseService.ts` - Knowledge management
- `services/ragService.ts` - Query orchestration

## Dependencies

- `@langchain/core` - LangChain core
- `@langchain/google-genai` - Gemini embeddings
- `@langchain/textsplitters` - Text splitting
- `langchain` - LangChain utilities

## Future Enhancements

- [ ] Hybrid search (vector + keyword/BM25)
- [ ] Reranking models
- [ ] Conversation memory
- [ ] Multi-tenant support
- [ ] Metadata filtering
- [ ] Streaming responses
- [ ] Caching layer

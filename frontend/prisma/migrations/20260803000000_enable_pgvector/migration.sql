-- Enable pgvector and migrate KnowledgeChunk.embedding from TEXT JSON to vector(1536)

CREATE EXTENSION IF NOT EXISTS vector;

-- Drop old TEXT embeddings (incompatible dimensions / format); re-embed via sync
ALTER TABLE "KnowledgeChunk" DROP COLUMN IF EXISTS "embedding";
ALTER TABLE "KnowledgeChunk" ADD COLUMN "embedding" vector(1536);

-- Force incremental sync to regenerate chunks + embeddings
UPDATE "KnowledgeSource" SET "contentHash" = NULL;

CREATE INDEX "KnowledgeChunk_embedding_hnsw_idx"
  ON "KnowledgeChunk"
  USING hnsw ("embedding" vector_cosine_ops);

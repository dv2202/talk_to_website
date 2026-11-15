-- Async knowledge ingestion: per-source status + progress for the queue worker.

CREATE TYPE "KnowledgeSourceStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

ALTER TABLE "KnowledgeSource"
  ALTER COLUMN "content" SET DEFAULT '',
  ADD COLUMN "status"      "KnowledgeSourceStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "progress"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "error"       TEXT,
  ADD COLUMN "attempts"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "fileUrl"     TEXT,
  ADD COLUMN "fileSize"    INTEGER,
  ADD COLUMN "pageCount"   INTEGER,
  ADD COLUMN "chunkCount"  INTEGER,
  ADD COLUMN "processedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: sources that were synced before this change are READY.
UPDATE "KnowledgeSource" s
SET "status" = 'READY',
    "progress" = 100,
    "processedAt" = s."createdAt",
    "chunkCount" = (SELECT COUNT(*) FROM "KnowledgeChunk" c WHERE c."sourceId" = s."id")
WHERE s."contentHash" IS NOT NULL;

-- Never synced (old inline sync failed): mark FAILED so the UI offers a retry.
UPDATE "KnowledgeSource"
SET "status" = 'FAILED',
    "error" = 'Not processed yet. Retry to index this source.'
WHERE "contentHash" IS NULL;

CREATE INDEX "KnowledgeSource_botId_updatedAt_idx" ON "KnowledgeSource"("botId", "updatedAt");
CREATE INDEX "KnowledgeSource_status_idx" ON "KnowledgeSource"("status");

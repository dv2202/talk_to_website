-- Objects that existed in schema.prisma (added via db push) but had no migration.
-- The HNSW index on KnowledgeChunk.embedding is managed by raw SQL and intentionally kept.

-- CreateEnum
CREATE TYPE "LiveChatRoomStatus" AS ENUM ('WAITING', 'ACTIVE', 'EXPIRED', 'CLOSED');

-- CreateEnum
CREATE TYPE "LiveChatSender" AS ENUM ('VISITOR', 'OWNER');

-- AlterTable
ALTER TABLE "Bot" ADD COLUMN     "humanChatEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "logoBgColor" TEXT DEFAULT '#ffffff',
ADD COLUMN     "quickQuestions" TEXT DEFAULT 'What do you do?,How can you help me?,Tell me more',
ADD COLUMN     "teaserDelay" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "teaserMessage" TEXT,
ADD COLUMN     "themeColor" TEXT DEFAULT '#0f172a',
ADD COLUMN     "welcomeSubtitle" TEXT,
ADD COLUMN     "welcomeTitle" TEXT,
ADD COLUMN     "widgetLogo" TEXT,
ADD COLUMN     "widgetLogoBgColor" TEXT DEFAULT '#2678FF';

-- CreateTable
CREATE TABLE "PendingSignup" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingSignup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveChatRoom" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "sessionId" TEXT,
    "status" "LiveChatRoomStatus" NOT NULL DEFAULT 'WAITING',
    "ownerJoinedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "visitorId" TEXT,

    CONSTRAINT "LiveChatRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveChatMessage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "sender" "LiveChatSender" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingSignup_email_key" ON "PendingSignup"("email");

-- CreateIndex
CREATE INDEX "PendingSignup_expiresAt_idx" ON "PendingSignup"("expiresAt");

-- CreateIndex
CREATE INDEX "LiveChatRoom_botId_status_idx" ON "LiveChatRoom"("botId", "status");

-- CreateIndex
CREATE INDEX "LiveChatRoom_botId_createdAt_idx" ON "LiveChatRoom"("botId", "createdAt");

-- CreateIndex
CREATE INDEX "LiveChatMessage_roomId_createdAt_idx" ON "LiveChatMessage"("roomId", "createdAt");

-- AddForeignKey
ALTER TABLE "LiveChatRoom" ADD CONSTRAINT "LiveChatRoom_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveChatRoom" ADD CONSTRAINT "LiveChatRoom_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveChatMessage" ADD CONSTRAINT "LiveChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "LiveChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

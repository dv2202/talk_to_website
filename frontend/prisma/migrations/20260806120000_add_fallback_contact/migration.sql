-- CreateEnum
CREATE TYPE "FallbackContactType" AS ENUM ('EMAIL', 'WHATSAPP', 'TELEGRAM', 'PHONE');

-- AlterTable
ALTER TABLE "Bot" ADD COLUMN "fallbackContactType" "FallbackContactType",
ADD COLUMN "fallbackContactValue" TEXT;

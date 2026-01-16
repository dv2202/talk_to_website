/**
 * Migration script to generate embeddings for existing knowledge sources.
 *
 * Usage:
 *   npx tsx scripts/migrate-to-rag.ts
 *
 * This script will:
 * 1. Find all bots with knowledge sources
 * 2. For each bot, sync all knowledge sources to generate embeddings
 * 3. Report the results
 */

import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { syncKnowledgeBase } from '../lib/rag';

async function main() {
  console.log('Starting RAG migration...\n');

  const bots = await prisma.bot.findMany({
    select: {
      id: true,
      name: true,
      botName: true,
      _count: {
        select: {
          knowledgeSources: true,
        },
      },
    },
  });

  console.log(`Found ${bots.length} bots\n`);

  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalDeleted = 0;

  for (const bot of bots) {
    if (bot._count.knowledgeSources === 0) {
      console.log(`[${bot.botName}] No knowledge sources, skipping`);
      continue;
    }

    console.log(`[${bot.botName}] Syncing ${bot._count.knowledgeSources} sources...`);

    try {
      const result = await syncKnowledgeBase(bot.id);
      totalProcessed += result.processed;
      totalUpdated += result.updated;
      totalSkipped += result.skipped;
      totalDeleted += result.deleted;

      console.log(`  ✓ Processed: ${result.processed}, Updated: ${result.updated}, Skipped: ${result.skipped}, Deleted: ${result.deleted}`);
    } catch (error) {
      console.error(`  ✗ Error:`, error);
    }
  }

  console.log('\n--- Migration Summary ---');
  console.log(`Total processed: ${totalProcessed}`);
  console.log(`Total updated: ${totalUpdated}`);
  console.log(`Total skipped: ${totalSkipped}`);
  console.log(`Total deleted: ${totalDeleted}`);
  console.log('\nDone!');
}

main()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

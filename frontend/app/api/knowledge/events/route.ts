import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import { findOwnedBot, sourceStatusSelect } from "@/lib/ingest/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** How often the stream checks for changes. Workers only write on 10% steps, so this is cheap. */
const TICK_MS = 1000;
const HEARTBEAT_MS = 15_000;
/** Close after this long with nothing PENDING/PROCESSING; the client reopens on the next upload. */
const IDLE_CLOSE_MS = 20_000;
/** Stay under maxDuration; EventSource reconnects automatically with Last-Event-ID. */
const MAX_STREAM_MS = 270_000;

type SourceRow = {
  id: string;
  status: string;
  progress: number;
  updatedAt: Date;
  [key: string]: unknown;
};

/**
 * Server-Sent Events stream of ingest progress for one bot.
 *
 * Events:
 * - `snapshot`: all sources (sent on connect)
 * - `progress`: one source changed status/progress (fires on each 10% step)
 * - `idle`:     nothing left in flight; stream closes
 *
 * Workers run in other function instances, so the stream tails the
 * KnowledgeSource rows for this bot (one indexed query per tick on
 * (botId, updatedAt)) and pushes only what changed.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorizedResponse();

  const bot = await findOwnedBot(req.nextUrl.searchParams.get("botId"), session.user.id);
  if (!bot) return new Response("Bot not found", { status: 404 });

  const encoder = new TextEncoder();
  const lastEventId = Number(req.headers.get("last-event-id"));
  let cursor = Number.isFinite(lastEventId) && lastEventId > 0 ? new Date(lastEventId) : null;
  const seen = new Map<string, string>(); // id -> `${status}:${progress}`

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const started = Date.now();
      let lastActivity = Date.now();
      let lastWrite = Date.now();
      let closed = false;
      let timer: ReturnType<typeof setInterval> | undefined;

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      req.signal.addEventListener("abort", close);

      const write = (event: string, data: unknown, id?: number) => {
        if (closed) return;
        let frame = `event: ${event}\n`;
        if (id) frame += `id: ${id}\n`;
        frame += `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(frame));
        lastWrite = Date.now();
      };

      const remember = (row: SourceRow) => {
        const key = `${row.status}:${row.progress}`;
        const changed = seen.get(row.id) !== key;
        seen.set(row.id, key);
        if (!cursor || row.updatedAt > cursor) cursor = row.updatedAt;
        return changed;
      };

      // Retry hint for EventSource reconnects.
      controller.enqueue(encoder.encode("retry: 3000\n\n"));

      const initial = (await prisma.knowledgeSource.findMany({
        where: { botId: bot.id },
        select: sourceStatusSelect,
        orderBy: { createdAt: "desc" },
      })) as SourceRow[];
      initial.forEach(remember);
      write("snapshot", initial, cursor?.getTime());

      let ticking = false;
      const tick = async () => {
        if (closed || ticking) return;
        ticking = true;
        try {
          const changed = (await prisma.knowledgeSource.findMany({
            where: { botId: bot.id, ...(cursor ? { updatedAt: { gte: cursor } } : {}) },
            select: sourceStatusSelect,
            orderBy: { updatedAt: "asc" },
          })) as SourceRow[];

          for (const row of changed) {
            if (remember(row)) write("progress", row, row.updatedAt.getTime());
          }

          const active = await prisma.knowledgeSource.count({
            where: { botId: bot.id, status: { in: ["PENDING", "PROCESSING"] } },
          });
          if (active > 0) lastActivity = Date.now();

          if (Date.now() - lastActivity > IDLE_CLOSE_MS) {
            write("idle", { active: 0 });
            close();
            return;
          }
          if (Date.now() - started > MAX_STREAM_MS) {
            close(); // client reconnects with Last-Event-ID
            return;
          }
          if (Date.now() - lastWrite > HEARTBEAT_MS) {
            controller.enqueue(encoder.encode(": keep-alive\n\n"));
            lastWrite = Date.now();
          }
        } catch (error) {
          console.error("[knowledge/events]", error);
          close();
        } finally {
          ticking = false;
        }
      };

      if (!closed) timer = setInterval(() => void tick(), TICK_MS);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

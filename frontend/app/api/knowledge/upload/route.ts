import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { head, put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import { cleanPages } from "@/lib/ingest/clean";
import { detectFileKind, IngestError, MAX_UPLOAD_BYTES, parseFile } from "@/lib/ingest/parse";
import { enqueueIngest } from "@/lib/ingest/queue";
import {
  findOwnedBot,
  isBlobConfigured,
  knowledgeBlobPrefix,
  sourceStatusSelect,
} from "@/lib/ingest/sources";

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function sourceType(name: string) {
  return name.toLowerCase().endsWith(".pdf") ? ("PDF" as const) : ("TXT" as const);
}

/**
 * Registers an uploaded document and queues it for background ingestion.
 * Responds 202 immediately; progress streams over /api/knowledge/events.
 *
 * - JSON `{ botId, blobUrl, name }`: file already uploaded straight to Blob
 *   via /api/knowledge/upload/token (preferred, any size up to 20MB).
 * - multipart `file` + `botId`: fallback for small files / no Blob configured.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const isJson = req.headers.get("content-type")?.includes("application/json");
    return isJson
      ? await registerBlobUpload(req, session.user.id)
      : await handleMultipartUpload(req, session.user.id);
  } catch (error) {
    if (error instanceof IngestError) return bad(error.message);
    console.error("Upload knowledge error:", error);
    return bad("Failed to upload knowledge source", 500);
  }
}

async function registerBlobUpload(req: NextRequest, userId: string) {
  const { botId, blobUrl, name } = (await req.json()) as {
    botId?: string;
    blobUrl?: string;
    name?: string;
  };
  const bot = await findOwnedBot(botId, userId);
  if (!bot) return bad("Bot not found", 404);
  if (typeof blobUrl !== "string" || typeof name !== "string" || !name.trim()) {
    return bad("blobUrl and name are required");
  }

  // Trust nothing from the client: confirm the blob exists in our store, under this bot.
  const blob = await head(blobUrl).catch(() => null);
  if (!blob || !blob.pathname.startsWith(knowledgeBlobPrefix(bot.id))) {
    return bad("Uploaded file not found");
  }
  if (blob.size > MAX_UPLOAD_BYTES) return bad("File must be 20MB or smaller");

  const duplicate = await prisma.knowledgeSource.findFirst({
    where: { botId: bot.id, fileUrl: blob.url },
    select: sourceStatusSelect,
  });
  if (duplicate) return NextResponse.json(duplicate, { status: 202 });

  const source = await prisma.knowledgeSource.create({
    data: {
      botId: bot.id,
      type: sourceType(name),
      name: name.trim().slice(0, 255),
      fileUrl: blob.url,
      fileSize: blob.size,
    },
    select: sourceStatusSelect,
  });
  await enqueueIngest([source.id]);
  return NextResponse.json(source, { status: 202 });
}

async function handleMultipartUpload(req: NextRequest, userId: string) {
  const formData = await req.formData();
  const bot = await findOwnedBot(formData.get("botId"), userId);
  if (!bot) return bad("Bot not found", 404);

  const file = formData.get("file");
  if (!(file instanceof File)) return bad("File is required");
  if (file.size > MAX_UPLOAD_BYTES) return bad("File must be 20MB or smaller");

  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = detectFileKind(file.name, buffer);
  if (!kind) return bad("Only PDF and TXT files are allowed");

  const base = { botId: bot.id, type: sourceType(file.name), name: file.name.slice(0, 255) };
  let source;

  if (isBlobConfigured()) {
    // Store the raw file; the worker downloads + parses it.
    const blob = await put(`${knowledgeBlobPrefix(bot.id)}${randomUUID()}.${kind}`, buffer, {
      access: "private",
      contentType: kind === "pdf" ? "application/pdf" : "text/plain",
    });
    source = await prisma.knowledgeSource.create({
      data: { ...base, fileUrl: blob.url, fileSize: file.size },
      select: sourceStatusSelect,
    });
  } else {
    // No Blob store (local dev): parse here, worker does chunk + embed.
    const rawPages = await parseFile(kind, buffer);
    const pages = cleanPages(rawPages);
    if (pages.length === 0) return bad("Could not extract any text from this file");
    source = await prisma.knowledgeSource.create({
      data: {
        ...base,
        fileSize: file.size,
        pageCount: rawPages.length,
        content: pages.map((p) => p.text).join("\n\n"),
      },
      select: sourceStatusSelect,
    });
  }

  await enqueueIngest([source.id]);
  return NextResponse.json(source, { status: 202 });
}

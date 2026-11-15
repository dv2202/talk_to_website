import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import { MAX_UPLOAD_BYTES } from "@/lib/ingest/parse";
import { findOwnedBot, isBlobConfigured, knowledgeBlobPrefix } from "@/lib/ingest/sources";

/**
 * Issues short-lived client tokens so the browser uploads straight to Vercel
 * Blob. Big PDFs never pass through a function (avoids the 4.5MB body limit).
 */
export async function POST(request: Request) {
  if (!isBlobConfigured()) {
    return NextResponse.json({ error: "Direct upload not configured" }, { status: 501 });
  }

  const session = await getSession();
  if (!session) return unauthorizedResponse();

  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const { botId } = JSON.parse(clientPayload || "{}") as { botId?: string };
        const bot = await findOwnedBot(botId, session.user.id);
        if (!bot) throw new Error("Bot not found");
        if (!pathname.startsWith(knowledgeBlobPrefix(bot.id))) {
          throw new Error("Invalid upload path");
        }
        if (!/\.(pdf|txt)$/i.test(pathname)) {
          throw new Error("Only PDF and TXT files are allowed");
        }
        return {
          allowedContentTypes: ["application/pdf", "text/plain"],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
          validUntil: Date.now() + 10 * 60 * 1000,
        };
      },
      // Registration happens in POST /api/knowledge/upload (works on localhost too,
      // where Blob can't call back), so nothing to do here.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload not allowed" },
      { status: 400 },
    );
  }
}

/** Lets the client decide between direct-to-Blob and multipart upload. */
export async function GET() {
  return NextResponse.json({ direct: isBlobConfigured() });
}

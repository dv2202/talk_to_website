import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import { parsePDF, parseTXT, getFileExtension } from "@/lib/services/fileParser";
import { syncSingleSource } from "@/lib/rag";
import fs from "fs";
import path from "path";
import os from "os";

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        const formData = await req.formData();
        const botId = formData.get("botId") as string;
        const file = formData.get("file") as File;

        if (!botId || !file) {
            return NextResponse.json({ error: "Bot ID and file are required" }, { status: 400 });
        }

        // Verify bot belongs to user
        const bot = await prisma.bot.findFirst({
            where: { id: botId, userId: session.user.id },
        });

        if (!bot) {
            return NextResponse.json({ error: "Bot not found" }, { status: 404 });
        }

        const ext = getFileExtension(file.name);
        if (ext !== "pdf" && ext !== "txt") {
            return NextResponse.json({ error: "Only PDF and TXT files are allowed" }, { status: 400 });
        }

        // Save to temporary file for parser (parsers currently expect a file path)
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, `${Date.now()}-${file.name}`);
        fs.writeFileSync(tempFilePath, buffer);

        let content: string;
        try {
            if (ext === "pdf") {
                content = await parsePDF(tempFilePath);
            } else {
                content = await parseTXT(tempFilePath);
            }
        } finally {
            // Clean up temp file if it still exists (parsers should handle it but just in case)
            if (fs.existsSync(tempFilePath)) {
                try { fs.unlinkSync(tempFilePath); } catch (e) {}
            }
        }

        if (!content || content.length === 0) {
            return NextResponse.json({ error: "Could not extract content from file" }, { status: 400 });
        }

        const knowledgeSource = await prisma.knowledgeSource.create({
            data: {
                type: ext === "pdf" ? "PDF" : "TXT",
                name: file.name,
                content,
                botId,
            },
        });

        // Trigger RAG sync for the new source
        try {
            await syncSingleSource(botId, knowledgeSource.id);
        } catch (syncError) {
            console.error("RAG sync failed for uploaded source:", syncError);
            // Don't fail the upload if sync fails
        }

        return NextResponse.json(knowledgeSource, { status: 201 });
    } catch (error) {
        console.error("Upload knowledge error:", error);
        return NextResponse.json({ error: "Failed to upload knowledge source" }, { status: 500 });
    }
}

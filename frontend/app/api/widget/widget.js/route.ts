import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getCorsHeaders } from "@/lib/chat-utils";

export async function OPTIONS(req: NextRequest) {
    const origin = req.headers.get("origin");
    return new NextResponse(null, {
        status: 204,
        headers: getCorsHeaders(origin, null),
    });
}

export async function GET(req: NextRequest) {
    const origin = req.headers.get("origin");
    try {
        const filePath = path.join(process.cwd(), "public", "widget.js");
        if (!fs.existsSync(filePath)) {
            return new NextResponse("Widget not found", {
                status: 404,
                headers: getCorsHeaders(origin, null),
            });
        }

        const content = fs.readFileSync(filePath, "utf-8");
        const headers: Record<string, string> = {
            "Content-Type": "application/javascript",
            "Cache-Control": "public, max-age=0",
            ...getCorsHeaders(origin, null),
        };

        return new NextResponse(content, { headers });
    } catch (error) {
        console.error("Error serving widget.js:", error);
        return new NextResponse("Internal server error", { status: 500 });
    }
}

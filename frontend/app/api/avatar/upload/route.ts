import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export async function POST(request: Request): Promise<NextResponse> {
    try {
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        const { searchParams } = new URL(request.url);
        const filename = searchParams.get("filename");

        if (!filename) {
            return NextResponse.json({ error: "Filename is required" }, { status: 400 });
        }

        if (!request.body) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const contentType = request.headers.get("content-type") || "";
        if (!ALLOWED_TYPES.has(contentType)) {
            return NextResponse.json(
                { error: "Only JPEG, PNG, WebP, and GIF images are allowed" },
                { status: 400 }
            );
        }

        const contentLength = Number(request.headers.get("content-length") || 0);
        if (contentLength > MAX_SIZE_BYTES) {
            return NextResponse.json(
                { error: "Image must be 2MB or smaller" },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await request.arrayBuffer());
        if (buffer.byteLength === 0) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }
        if (buffer.byteLength > MAX_SIZE_BYTES) {
            return NextResponse.json(
                { error: "Image must be 2MB or smaller" },
                { status: 400 }
            );
        }

        const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const pathname = `widget-logos/${session.user.id}/${safeName}`;

        const blob = await put(pathname, buffer, {
            access: "public",
            addRandomSuffix: true,
            contentType,
        });

        return NextResponse.json(blob);
    } catch (error) {
        console.error("Avatar upload error:", error);
        return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
    }
}

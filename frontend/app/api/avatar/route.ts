import { NextResponse } from "next/server";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import {
    isOwnedWidgetLogoBlobUrl,
    isWidgetLogoBlobUrl,
} from "@/lib/widget-logo-blob";
import { deleteWidgetLogoBlob } from "@/lib/widget-logo-blob-server";
import { isAdminEmail } from "@/lib/admin";

/**
 * DELETE /api/avatar
 * Body: { url: string }
 * Removes a widget logo from Vercel Blob when the caller owns it (or is admin).
 */
export async function DELETE(request: Request): Promise<NextResponse> {
    try {
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        const body = await request.json().catch(() => null);
        const url = typeof body?.url === "string" ? body.url.trim() : "";

        if (!url) {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        if (!isWidgetLogoBlobUrl(url)) {
            return NextResponse.json(
                { error: "URL is not a widget logo blob" },
                { status: 400 }
            );
        }

        const admin = isAdminEmail(session.user.email);
        if (!admin && !isOwnedWidgetLogoBlobUrl(url, session.user.id)) {
            return NextResponse.json(
                { error: "Not allowed to delete this logo" },
                { status: 403 }
            );
        }

        await deleteWidgetLogoBlob(url);
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Avatar delete error:", error);
        return NextResponse.json({ error: "Failed to delete image" }, { status: 500 });
    }
}

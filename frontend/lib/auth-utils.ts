import { isAdminEmail } from "@/lib/admin";
import { getSession } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export { getSession };

export async function requireAuth() {
    return await getSession();
}

export async function requireAdmin() {
    const session = await getSession();
    if (!session?.user?.email || !isAdminEmail(session.user.email)) {
        return null;
    }
    return session;
}

export function unauthorizedResponse() {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbiddenResponse() {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

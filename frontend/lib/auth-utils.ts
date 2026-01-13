import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function getSession() {
    return await auth.api.getSession({
        headers: await headers(),
    });
}

export async function requireAuth() {
    const session = await getSession();
    if (!session) {
        return null;
    }
    return session;
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

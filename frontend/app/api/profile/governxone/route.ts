import { NextRequest, NextResponse } from "next/server";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import {
    getUserGovernXOneProfile,
    saveUserGovernXOneCredentials,
} from "@/lib/governxone-credentials";

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        const profile = await getUserGovernXOneProfile(session.user.id);
        return NextResponse.json(profile);
    } catch (error) {
        console.error("Get GovernXOne credentials error:", error);
        return NextResponse.json(
            { error: "Failed to fetch GovernXOne credentials" },
            { status: 500 }
        );
    }
}

export async function PUT(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        const body = await req.json();
        const { apiKey, projectId, endpoint, clear } = body as {
            apiKey?: string;
            projectId?: string;
            endpoint?: string;
            clear?: boolean;
        };

        await saveUserGovernXOneCredentials(session.user.id, {
            apiKey,
            projectId,
            endpoint,
            clear: Boolean(clear),
        });

        const profile = await getUserGovernXOneProfile(session.user.id);
        return NextResponse.json(profile);
    } catch (error: any) {
        console.error("Save GovernXOne credentials error:", error);
        return NextResponse.json(
            { error: error?.message || "Failed to save GovernXOne credentials" },
            { status: 400 }
        );
    }
}

import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth/session";
import { exchangeGoogleCode, GoogleAuthError, upsertGoogleUser } from "@/lib/auth/google";

/** Google GIS popup: exchanges the auth code, upserts the user and starts a session. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
    const code = typeof body?.code === "string" ? body.code : "";
    if (!code) {
      return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
    }

    const { claims, tokens } = await exchangeGoogleCode(code);
    const user = await upsertGoogleUser(claims, tokens);

    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, image: user.image },
    });
    await createSession(response, user.id, request);
    return response;
  } catch (error) {
    if (error instanceof GoogleAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[auth/google]", error);
    return NextResponse.json({ error: "Google sign-in failed" }, { status: 500 });
  }
}

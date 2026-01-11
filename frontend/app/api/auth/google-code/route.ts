import { NextResponse } from "next/server";

/**
 * Exchanges a Google GIS popup auth code for tokens.
 * GIS popup mode uses redirect_uri "postmessage".
 */
export async function POST(request: Request) {
  try {
    const { code } = (await request.json()) as { code?: string };

    if (!code) {
      return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: "Google OAuth is not configured" }, { status: 500 });
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: "postmessage",
        grant_type: "authorization_code",
      }),
    });

    const tokens = (await tokenResponse.json()) as {
      id_token?: string;
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenResponse.ok || !tokens.id_token) {
      return NextResponse.json(
        {
          error: tokens.error_description || tokens.error || "Failed to exchange Google code",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      idToken: tokens.id_token,
      accessToken: tokens.access_token,
    });
  } catch {
    return NextResponse.json({ error: "Google sign-in failed" }, { status: 500 });
  }
}

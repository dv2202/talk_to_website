import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/auth/email";

export class GoogleAuthError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "GoogleAuthError";
    this.status = status;
  }
}

type GoogleTokenResponse = {
  id_token?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

export type GoogleIdTokenClaims = {
  iss: string;
  aud: string;
  sub: string;
  exp: number;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
};

function decodeJwtPayload(token: string): unknown {
  const parts = token.split(".");
  if (parts.length !== 3) throw new GoogleAuthError("Invalid Google ID token");
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    throw new GoogleAuthError("Invalid Google ID token");
  }
}

/**
 * Validates ID token claims. The token comes straight from Google's token
 * endpoint over TLS (server-to-server), so per OIDC Core §3.1.3.7 the
 * signature check may be skipped; issuer, audience and expiry are still checked.
 */
export function validateGoogleClaims(
  payload: unknown,
  clientId: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): GoogleIdTokenClaims & { email: string } {
  const claims = payload as Partial<GoogleIdTokenClaims> | null;
  if (!claims || typeof claims !== "object") throw new GoogleAuthError("Invalid Google ID token");
  if (claims.iss !== "https://accounts.google.com" && claims.iss !== "accounts.google.com") {
    throw new GoogleAuthError("Invalid Google token issuer");
  }
  if (claims.aud !== clientId) throw new GoogleAuthError("Google token audience mismatch");
  if (typeof claims.exp !== "number" || claims.exp < nowSeconds) {
    throw new GoogleAuthError("Google token expired");
  }
  if (!claims.sub) throw new GoogleAuthError("Invalid Google ID token");
  const verified = claims.email_verified === true || claims.email_verified === "true";
  if (!claims.email || !verified) {
    throw new GoogleAuthError("Your Google account email is not verified");
  }
  return claims as GoogleIdTokenClaims & { email: string };
}

/** Exchanges a GIS popup auth code (redirect_uri "postmessage") for verified Google claims. */
export async function exchangeGoogleCode(code: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new GoogleAuthError("Google OAuth is not configured", 500);
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

  const tokens = (await tokenResponse.json()) as GoogleTokenResponse;
  if (!tokenResponse.ok || !tokens.id_token) {
    throw new GoogleAuthError(
      tokens.error_description || tokens.error || "Failed to exchange Google code",
    );
  }

  const claims = validateGoogleClaims(decodeJwtPayload(tokens.id_token), clientId);
  return { claims, tokens };
}

/** Finds or creates the user for a Google identity and links the Google account. */
export async function upsertGoogleUser(
  claims: GoogleIdTokenClaims & { email: string },
  tokens: GoogleTokenResponse,
) {
  const email = normalizeEmail(claims.email);
  const tokenData = {
    accessToken: tokens.access_token ?? null,
    idToken: tokens.id_token ?? null,
    scope: tokens.scope ?? null,
    accessTokenExpiresAt: tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null,
  };

  const linked = await prisma.account.findFirst({
    where: { providerId: "google", accountId: claims.sub },
    include: { user: true },
  });
  if (linked) {
    await prisma.account.update({ where: { id: linked.id }, data: tokenData });
    return linked.user;
  }

  // Google verified the email, so it's safe to link to an existing account with that email.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.$transaction([
      prisma.account.create({
        data: { userId: existing.id, providerId: "google", accountId: claims.sub, ...tokenData },
      }),
      prisma.user.update({
        where: { id: existing.id },
        data: {
          emailVerified: true,
          image: existing.image ?? claims.picture ?? null,
        },
      }),
    ]);
    // Any half-finished email signup for this address is now moot.
    await prisma.pendingSignup.deleteMany({ where: { email } });
    return existing;
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: claims.name?.trim() || email.split("@")[0],
      emailVerified: true,
      image: claims.picture ?? null,
      accounts: {
        create: { providerId: "google", accountId: claims.sub, ...tokenData },
      },
    },
  });
  await prisma.pendingSignup.deleteMany({ where: { email } });
  return user;
}

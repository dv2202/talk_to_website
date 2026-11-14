import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_REFRESH_AFTER_MS = 24 * 60 * 60 * 1000; // extend at most once a day

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
};

export type AuthSession = {
  session: { id: string; expiresAt: Date };
  user: SessionUser;
};

/** Only a SHA-256 of the cookie token is stored, so a DB leak can't be replayed as cookies. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

/** Creates a DB session for the user and sets the session cookie on the response. */
export async function createSession(
  response: NextResponse,
  userId: string,
  request?: Request,
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      token: hashSessionToken(token),
      userId,
      expiresAt,
      ipAddress:
        request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request?.headers.get("x-real-ip") ||
        null,
      userAgent: request?.headers.get("user-agent")?.slice(0, 512) || null,
    },
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, cookieOptions(expiresAt));
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...cookieOptions(new Date(0)), maxAge: 0 });
}

/** Reads the session cookie from the current request and resolves the user. */
export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const record = await prisma.session.findUnique({
    where: { token: hashSessionToken(token) },
    include: {
      user: {
        select: { id: true, name: true, email: true, emailVerified: true, image: true },
      },
    },
  });
  if (!record) return null;

  const now = Date.now();
  if (record.expiresAt.getTime() <= now) {
    await prisma.session.delete({ where: { id: record.id } }).catch(() => undefined);
    return null;
  }

  // Sliding expiry: keep active users signed in.
  let expiresAt = record.expiresAt;
  if (now - record.updatedAt.getTime() > SESSION_REFRESH_AFTER_MS) {
    expiresAt = new Date(now + SESSION_TTL_MS);
    await prisma.session
      .update({ where: { id: record.id }, data: { expiresAt } })
      .catch(() => undefined);
    try {
      cookieStore.set(SESSION_COOKIE_NAME, token, cookieOptions(expiresAt));
    } catch {
      // cookies() is read-only outside route handlers / server actions.
    }
  }

  return { session: { id: record.id, expiresAt }, user: record.user };
}

/** Deletes the session behind the current request's cookie (if any). */
export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return;
  await prisma.session
    .deleteMany({ where: { token: hashSessionToken(token) } })
    .catch(() => undefined);
}

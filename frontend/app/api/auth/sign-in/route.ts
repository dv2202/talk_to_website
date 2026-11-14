import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/auth/email";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import {
  clearLoginFailures,
  isLoginLocked,
  recordLoginFailure,
} from "@/lib/services/login-throttle";

const INVALID = "Invalid email or password";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { email?: unknown; password?: unknown }
      | null;
    const email = normalizeEmail(String(body?.email ?? ""));
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    if (await isLoginLocked(email)) {
      return NextResponse.json(
        { error: "Too many failed attempts. Try again in 15 minutes or reset your password." },
        { status: 429 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { accounts: { where: { providerId: "credential" }, select: { password: true } } },
    });
    const hash = user?.accounts[0]?.password;

    if (!user || !hash || !(await verifyPassword(password, hash))) {
      await recordLoginFailure(email);
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }

    await clearLoginFailures(email);
    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, image: user.image },
    });
    await createSession(response, user.id, request);
    return response;
  } catch (error) {
    console.error("[auth/sign-in]", error);
    return NextResponse.json({ error: "Sign-in failed. Please try again." }, { status: 500 });
  }
}

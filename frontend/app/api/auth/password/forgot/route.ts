import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/services/password-reset";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
    await requestPasswordReset(String(body?.email ?? ""));
  } catch (error) {
    // Swallow so the response doesn't reveal whether the account exists.
    console.error("[auth/password/forgot]", error);
  }
  return NextResponse.json({
    success: true,
    message: "If an account exists for this email, a reset code has been sent.",
  });
}

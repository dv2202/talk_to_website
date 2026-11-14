import { NextResponse } from "next/server";
import { OtpServiceError } from "@/lib/services/otp";
import { resetPasswordWithOtp } from "@/lib/services/password-reset";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { email?: unknown; otp?: unknown; password?: unknown }
      | null;
    await resetPasswordWithOtp({
      email: String(body?.email ?? ""),
      otp: String(body?.otp ?? ""),
      password: String(body?.password ?? ""),
    });
    return NextResponse.json({ success: true, message: "Password updated" });
  } catch (error) {
    if (error instanceof OtpServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[auth/password/reset]", error);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}

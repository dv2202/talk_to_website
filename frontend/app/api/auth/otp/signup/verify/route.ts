import { NextResponse } from "next/server";
import { OtpServiceError, verifySignupOtpAndCreateAccount } from "@/lib/services/otp";
import { createSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, otp } = body ?? {};

    const result = await verifySignupOtpAndCreateAccount({
      email: String(email ?? ""),
      otp: String(otp ?? ""),
    });

    // Signed in straight away — the OTP already proved inbox ownership.
    const response = NextResponse.json({
      success: true,
      email: result.email,
      name: result.name,
      message: "Account created successfully",
    });
    await createSession(response, result.id, request);
    return response;
  } catch (error) {
    if (error instanceof OtpServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[signup/verify-otp]", error);
    return NextResponse.json(
      { error: "Failed to verify code. Please try again." },
      { status: 500 },
    );
  }
}

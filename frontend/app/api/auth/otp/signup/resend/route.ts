import { NextResponse } from "next/server";
import { OtpServiceError, resendSignupOtp } from "@/lib/services/otp";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body ?? {};

    const result = await resendSignupOtp(String(email ?? ""));

    return NextResponse.json({
      success: true,
      email: result.email,
      message: "A new verification code has been sent",
    });
  } catch (error) {
    if (error instanceof OtpServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[signup/resend-otp]", error);
    return NextResponse.json(
      { error: "Failed to resend verification code. Please try again." },
      { status: 500 },
    );
  }
}

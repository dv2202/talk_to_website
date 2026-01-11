import { NextResponse } from "next/server";
import { OtpServiceError, verifySignupOtpAndCreateAccount } from "@/lib/services/otp";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, otp } = body ?? {};

    const result = await verifySignupOtpAndCreateAccount({
      email: String(email ?? ""),
      otp: String(otp ?? ""),
    });

    return NextResponse.json({
      success: true,
      email: result.email,
      name: result.name,
      message: "Account created successfully",
    });
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

import { NextResponse } from "next/server";
import { createPendingSignup, OtpServiceError } from "@/lib/services/otp";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password } = body ?? {};

    const result = await createPendingSignup({
      name: String(name ?? ""),
      email: String(email ?? ""),
      password: String(password ?? ""),
    });

    return NextResponse.json({
      success: true,
      email: result.email,
      message: "Verification code sent to your email",
    });
  } catch (error) {
    if (error instanceof OtpServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[signup/request-otp]", error);
    return NextResponse.json(
      { error: "Failed to send verification code. Please try again." },
      { status: 500 },
    );
  }
}

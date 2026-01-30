import { NextResponse } from "next/server";
import { sendContactEmail } from "@/lib/services/email";
import { SUPPORT_EMAIL } from "@/lib/docs/siteDocumentation";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body?.name ?? "").trim();
    const email = String(body?.email ?? "").trim();
    const subject = String(body?.subject ?? "").trim();
    const message = String(body?.message ?? "").trim();

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "Name, email, subject, and message are required." },
        { status: 400 },
      );
    }

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    if (name.length > 120 || subject.length > 200 || message.length > 5000) {
      return NextResponse.json({ error: "One or more fields are too long." }, { status: 400 });
    }

    await sendContactEmail({
      name,
      email,
      subject,
      message,
      to: SUPPORT_EMAIL,
    });

    return NextResponse.json({
      success: true,
      message: "Message sent successfully.",
    });
  } catch (error) {
    console.error("[contact]", error);
    return NextResponse.json(
      { error: "Failed to send message. Please try again." },
      { status: 500 },
    );
  }
}

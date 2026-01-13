import { createHash, randomInt, timingSafeEqual } from "crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma";
import { sendOtpEmail, type OtpEmailType } from "@/lib/services/email";

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const MAX_OTP_ATTEMPTS = 5;

export function generateOtp(length = OTP_LENGTH): string {
  const max = 10 ** length;
  return String(randomInt(0, max)).padStart(length, "0");
}

export function hashOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex");
}

export function verifyOtpHash(otp: string, otpHash: string): boolean {
  const incoming = Buffer.from(hashOtp(otp));
  const stored = Buffer.from(otpHash);
  if (incoming.length !== stored.length) return false;
  return timingSafeEqual(incoming, stored);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function createPendingSignup(params: {
  name: string;
  email: string;
  password: string;
}): Promise<{ email: string }> {
  const email = normalizeEmail(params.email);
  const name = params.name.trim();

  if (!name) {
    throw new OtpServiceError("Name is required", 400);
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new OtpServiceError("Valid email is required", 400);
  }
  if (!params.password || params.password.length < 8) {
    throw new OtpServiceError("Password must be at least 8 characters", 400);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new OtpServiceError("An account with this email already exists", 409);
  }

  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const passwordHash = await hashPassword(params.password);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.pendingSignup.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash,
      otpHash,
      attempts: 0,
      expiresAt,
    },
    update: {
      name,
      passwordHash,
      otpHash,
      attempts: 0,
      expiresAt,
    },
  });

  // Fire-and-forget style: await so serverless doesn't drop the send, but caller can still respond.
  await sendOtpEmail({ email, otp, type: "sign-up" });

  return { email };
}

export async function resendSignupOtp(emailInput: string): Promise<{ email: string }> {
  const email = normalizeEmail(emailInput);
  const pending = await prisma.pendingSignup.findUnique({ where: { email } });

  if (!pending) {
    throw new OtpServiceError("No pending signup found for this email. Please sign up again.", 404);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.pendingSignup.delete({ where: { email } }).catch(() => undefined);
    throw new OtpServiceError("An account with this email already exists", 409);
  }

  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.pendingSignup.update({
    where: { email },
    data: { otpHash, attempts: 0, expiresAt },
  });

  await sendOtpEmail({ email, otp, type: "sign-up" });
  return { email };
}

export async function verifySignupOtpAndCreateAccount(params: {
  email: string;
  otp: string;
}): Promise<{ email: string; name: string }> {
  const email = normalizeEmail(params.email);
  const otp = params.otp.trim();

  if (!/^\d{6}$/.test(otp)) {
    throw new OtpServiceError("Enter the 6-digit code from your email", 400);
  }

  const pending = await prisma.pendingSignup.findUnique({ where: { email } });
  if (!pending) {
    throw new OtpServiceError("No pending signup found. Please sign up again.", 404);
  }

  if (pending.expiresAt.getTime() < Date.now()) {
    await prisma.pendingSignup.delete({ where: { email } }).catch(() => undefined);
    throw new OtpServiceError("OTP expired. Please request a new code.", 410);
  }

  if (pending.attempts >= MAX_OTP_ATTEMPTS) {
    await prisma.pendingSignup.delete({ where: { email } }).catch(() => undefined);
    throw new OtpServiceError("Too many invalid attempts. Please sign up again.", 429);
  }

  if (!verifyOtpHash(otp, pending.otpHash)) {
    await prisma.pendingSignup.update({
      where: { email },
      data: { attempts: { increment: 1 } },
    });
    throw new OtpServiceError("Invalid verification code", 400);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.pendingSignup.delete({ where: { email } }).catch(() => undefined);
    throw new OtpServiceError("An account with this email already exists", 409);
  }

  const user = await prisma.$transaction(async (tx: typeof prisma) => {
    const created = await tx.user.create({
      data: {
        name: pending.name,
        email,
        emailVerified: true,
      },
    });

    await tx.account.create({
      data: {
        userId: created.id,
        accountId: created.id,
        providerId: "credential",
        password: pending.passwordHash,
      },
    });

    await tx.pendingSignup.delete({ where: { email } });
    return created;
  });

  return { email: user.email, name: user.name };
}

/** Map Better Auth emailOTP types onto our mailer. */
export async function sendBetterAuthOtp(params: {
  email: string;
  otp: string;
  type: "sign-in" | "email-verification" | "forget-password" | "change-email";
}): Promise<void> {
  const typeMap: Record<typeof params.type, OtpEmailType> = {
    "sign-in": "sign-in",
    "email-verification": "email-verification",
    "forget-password": "forget-password",
    "change-email": "email-verification",
  };
  await sendOtpEmail({
    email: params.email,
    otp: params.otp,
    type: typeMap[params.type],
  });
}

export class OtpServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "OtpServiceError";
    this.status = status;
  }
}

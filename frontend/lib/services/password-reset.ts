import { prisma } from "@/lib/prisma";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { normalizeEmail } from "@/lib/auth/email";
import { sendOtpEmail } from "@/lib/services/email";
import {
  generateOtp,
  hashOtp,
  MAX_OTP_ATTEMPTS,
  OTP_TTL_MS,
  OtpServiceError,
  verifyOtpHash,
} from "@/lib/services/otp";

const RESEND_COOLDOWN_MS = 60 * 1000;

type ResetRecordValue = { otpHash: string; attempts: number };

function resetIdentifier(email: string) {
  return `password-reset:${email}`;
}

function parseValue(value: string): ResetRecordValue | null {
  try {
    const parsed = JSON.parse(value) as ResetRecordValue;
    return typeof parsed.otpHash === "string" && typeof parsed.attempts === "number"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

/**
 * Emails a reset OTP if the account exists. Always resolves the same way so the
 * endpoint can't be used to discover which emails are registered.
 */
export async function requestPasswordReset(emailInput: string): Promise<void> {
  const email = normalizeEmail(emailInput);
  if (!email) return;

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return;

  const identifier = resetIdentifier(email);
  const existing = await prisma.verification.findFirst({ where: { identifier } });
  if (existing && Date.now() - existing.updatedAt.getTime() < RESEND_COOLDOWN_MS) {
    return; // throttle resends silently
  }

  const otp = generateOtp();
  const value = JSON.stringify({ otpHash: hashOtp(otp), attempts: 0 } satisfies ResetRecordValue);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.$transaction([
    prisma.verification.deleteMany({ where: { identifier } }),
    prisma.verification.create({ data: { identifier, value, expiresAt } }),
  ]);

  await sendOtpEmail({ email, otp, type: "forget-password" });
}

/** Verifies the OTP, sets the new password and signs the user out everywhere. */
export async function resetPasswordWithOtp(params: {
  email: string;
  otp: string;
  password: string;
}): Promise<void> {
  const email = normalizeEmail(params.email);
  const otp = params.otp.trim();

  const passwordError = validatePassword(params.password);
  if (passwordError) throw new OtpServiceError(passwordError, 400);
  if (!/^\d{6}$/.test(otp)) throw new OtpServiceError("Enter the 6-digit code from your email", 400);

  const identifier = resetIdentifier(email);
  const record = await prisma.verification.findFirst({ where: { identifier } });
  const value = record ? parseValue(record.value) : null;
  if (!record || !value) {
    throw new OtpServiceError("Invalid or expired code. Please request a new one.", 400);
  }

  if (record.expiresAt.getTime() < Date.now() || value.attempts >= MAX_OTP_ATTEMPTS) {
    await prisma.verification.deleteMany({ where: { identifier } });
    throw new OtpServiceError("Invalid or expired code. Please request a new one.", 400);
  }

  if (!verifyOtpHash(otp, value.otpHash)) {
    await prisma.verification.update({
      where: { id: record.id },
      data: { value: JSON.stringify({ ...value, attempts: value.attempts + 1 }) },
    });
    throw new OtpServiceError("Invalid verification code", 400);
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    await prisma.verification.deleteMany({ where: { identifier } });
    throw new OtpServiceError("Invalid or expired code. Please request a new one.", 400);
  }

  const passwordHash = await hashPassword(params.password);
  const credential = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
    select: { id: true },
  });

  await prisma.$transaction([
    credential
      ? prisma.account.update({ where: { id: credential.id }, data: { password: passwordHash } })
      : // Google-only users can add a password this way; the OTP proves inbox ownership.
        prisma.account.create({
          data: {
            userId: user.id,
            accountId: user.id,
            providerId: "credential",
            password: passwordHash,
          },
        }),
    prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.verification.deleteMany({ where: { identifier } }),
  ]);
}

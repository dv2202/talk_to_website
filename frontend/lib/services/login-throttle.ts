import { prisma } from "@/lib/prisma";

/** Per-email brute-force guard, stored in the DB so it works across serverless instances. */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

function identifier(email: string) {
  return `login-failures:${email}`;
}

export async function isLoginLocked(email: string): Promise<boolean> {
  const record = await prisma.verification.findFirst({ where: { identifier: identifier(email) } });
  if (!record) return false;
  if (record.expiresAt.getTime() < Date.now()) {
    await prisma.verification.deleteMany({ where: { identifier: identifier(email) } });
    return false;
  }
  return Number(record.value) >= MAX_FAILURES;
}

export async function recordLoginFailure(email: string): Promise<void> {
  const id = identifier(email);
  const record = await prisma.verification.findFirst({ where: { identifier: id } });
  if (!record || record.expiresAt.getTime() < Date.now()) {
    await prisma.verification.deleteMany({ where: { identifier: id } });
    await prisma.verification.create({
      data: { identifier: id, value: "1", expiresAt: new Date(Date.now() + WINDOW_MS) },
    });
    return;
  }
  await prisma.verification.update({
    where: { id: record.id },
    data: { value: String(Number(record.value) + 1) },
  });
}

export async function clearLoginFailures(email: string): Promise<void> {
  await prisma.verification.deleteMany({ where: { identifier: identifier(email) } });
}

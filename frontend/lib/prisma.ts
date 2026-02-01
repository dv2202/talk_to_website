import type { PrismaClient as PrismaClientType } from "@prisma/client";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;
import { withAccelerate } from "@prisma/extension-accelerate";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClientType | undefined;
};

if (!process.env.DATABASE_URL) {
    console.warn("❌ DATABASE_URL is not set in environment variables.");
}

export const prisma = (globalForPrisma.prisma ?? (
    process.env.DATABASE_URL
        ? new (PrismaClient as any)({
            accelerateUrl: process.env.DATABASE_URL
          }).$extends(withAccelerate())
        : new Proxy({}, {
            get(target, prop) {
                if (prop === "$extends" || prop === "$disconnect" || prop === "$connect" || prop === "$on" || prop === "$use" || prop === "$transaction") {
                    return () => Promise.resolve();
                }
                if (typeof prop === "string") {
                    return new Proxy({}, {
                        get(modelTarget, modelProp) {
                            if (modelProp === "$name" || modelProp === "fields" || modelProp === "create" || modelProp === "createMany" || modelProp === "update" || modelProp === "updateMany" || modelProp === "delete" || modelProp === "deleteMany" || modelProp === "findUnique" || modelProp === "findFirst" || modelProp === "findMany" || modelProp === "count" || modelProp === "aggregate" || modelProp === "groupBy" || modelProp === "upsert") {
                                return () => { throw new Error("DATABASE_URL not configured"); };
                            }
                            return undefined;
                        }
                    });
                }
                return undefined;
            }
        })
)) as any;

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma as any;
}

/** Transient Prisma Accelerate / Prisma Postgres engine failures. */
export function isTransientAccelerateError(error: unknown): boolean {
    const e = error as { code?: string; message?: string } | null;
    if (!e) return false;
    if (e.code === "P6000" || e.code === "P6008" || e.code === "P5011") {
        return true;
    }
    const message = e.message || "";
    return (
        message.includes("communicating with your Query Engine") ||
        message.includes("Query timeout exceeded") ||
        message.includes("EngineStartError")
    );
}

/** Retry helper for flaky Accelerate Query Engine errors. */
export async function withAccelerateRetry<T>(
    operation: () => Promise<T>,
    options: { retries?: number; baseDelayMs?: number } = {}
): Promise<T> {
    const retries = options.retries ?? 2;
    const baseDelayMs = options.baseDelayMs ?? 200;
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (!isTransientAccelerateError(error) || attempt === retries) {
                throw error;
            }
            const delay =
                baseDelayMs * 2 ** attempt + Math.floor(Math.random() * 100);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

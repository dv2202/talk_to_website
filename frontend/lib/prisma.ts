import type { PrismaClient as PrismaClientType } from "@prisma/client";
import pkg from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { withAccelerate } from "@prisma/extension-accelerate";
const { PrismaClient } = pkg;

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClientType | undefined;
};

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.warn("❌ DATABASE_URL is not set in environment variables.");
}

/** prisma:// and prisma+postgres:// go through Prisma Accelerate; anything else is plain Postgres (e.g. Supabase). */
const usesAccelerate = Boolean(databaseUrl && /^prisma(\+postgres)?:\/\//.test(databaseUrl));

function createClient() {
    if (usesAccelerate) {
        return new (PrismaClient as any)({ accelerateUrl: databaseUrl }).$extends(withAccelerate());
    }
    // Serverless: keep the pool tiny; Supabase's transaction pooler (port 6543) does the real pooling.
    const adapter = new PrismaPg({
        connectionString: databaseUrl,
        max: Number(process.env.DATABASE_POOL_MAX ?? 3),
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: 10_000,
    });
    return new (PrismaClient as any)({ adapter });
}

export const prisma = (globalForPrisma.prisma ?? (
    databaseUrl
        ? createClient()
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

/** Transient database failures (Accelerate engine errors, dropped/timed-out Postgres connections). */
export function isTransientAccelerateError(error: unknown): boolean {
    const e = error as { code?: string; message?: string } | null;
    if (!e) return false;
    if (
        e.code === "P6000" || e.code === "P6008" || e.code === "P5011" ||
        e.code === "P1001" || e.code === "P1017" || e.code === "P2024" ||
        e.code === "ECONNRESET" || e.code === "ETIMEDOUT"
    ) {
        return true;
    }
    const message = e.message || "";
    return (
        message.includes("communicating with your Query Engine") ||
        message.includes("Query timeout exceeded") ||
        message.includes("EngineStartError") ||
        message.includes("Connection terminated unexpectedly")
    );
}

/** Retry helper for transient database errors. */
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

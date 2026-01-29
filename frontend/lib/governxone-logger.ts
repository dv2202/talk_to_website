import type { Environment, Logger } from "@governxone/ai-monitor";
import type { GovernXOneConfig } from "@/lib/governxone-credentials";

export type GovernXOneLogContext = {
    api: string;
    endpoint: string;
    projectId: string;
    environment: Environment;
    apiKey: string;
    source: "profile" | "env";
};

const PREFIX = "[governxone]";
export const GOVERNXONE_MAX_RETRIES = 3;

export function resolveGovernXOneEnvironment(): Environment {
    const value = process.env.GOVERNXONE_ENVIRONMENT?.trim();
    if (value === "development" || value === "staging" || value === "production") {
        return value;
    }
    return process.env.NODE_ENV === "development" ? "development" : "production";
}

export function governXOneMonitoringApi(endpoint: string): string {
    return `${endpoint.replace(/\/$/, "")}/api/v1/sdk/monitoring`;
}

export function buildGovernXOneLogContext(
    config: GovernXOneConfig,
    source: "profile" | "env"
): GovernXOneLogContext {
    const endpoint = config.endpoint?.trim() || process.env.GOVERNXONE_ENDPOINT?.trim() || "(sdk default)";
    return {
        api: governXOneMonitoringApi(endpoint),
        endpoint,
        projectId: config.projectId,
        environment: resolveGovernXOneEnvironment(),
        apiKey: config.apiKey,
        source,
    };
}

function httpFailureReason(status: number): string {
    if (status === 401) return "Unauthorized — API key is missing or invalid";
    if (status === 403) return "Forbidden — API key does not have access to this project";
    if (status === 404) return "Not found — project ID or monitoring endpoint is wrong";
    if (status === 413) return "Payload too large for the GovernXOne API";
    if (status === 429) return "Rate limited by GovernXOne";
    if (status >= 500) return `GovernXOne server error (HTTP ${status})`;
    return `GovernXOne rejected the batch (HTTP ${status})`;
}

function networkFailureReason(err: unknown): string | null {
    const code =
        err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code ?? "") : "";
    const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";

    if (code === "ENOTFOUND") return "DNS lookup failed — check GOVERNXONE_ENDPOINT";
    if (code === "ECONNREFUSED") return "Connection refused — GovernXOne API is not reachable";
    if (code === "ECONNRESET") return "Connection reset while talking to GovernXOne API";
    if (code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT") {
        return "Connection timed out reaching GovernXOne API";
    }
    if (/failed to fetch|network|fetch failed/i.test(message)) {
        return `Network error — could not reach GovernXOne API (${message})`;
    }
    return null;
}

export function deliveryFailureReason(err: unknown): string {
    const network = networkFailureReason(err);
    if (network) return network;

    const message = err instanceof Error ? err.message : err == null ? "" : String(err);
    const http = message.match(/HTTP\s+(\d+)\s*:\s*([\s\S]*)/);
    if (http) {
        const status = Number(http[1]);
        const body = http[2]?.trim();
        return body ? `${httpFailureReason(status)}. HTTP ${status}: ${body}` : `${httpFailureReason(status)}. HTTP ${status}`;
    }

    return message || "Unknown delivery failure";
}

function normalizeArg(arg: unknown): Record<string, unknown> | null {
    if (arg == null) return null;
    if (arg instanceof Error) {
        const extra: Record<string, unknown> = {
            reason: deliveryFailureReason(arg),
            error: arg.message,
            name: arg.name,
        };
        if ("code" in arg && (arg as NodeJS.ErrnoException).code) {
            extra.code = (arg as NodeJS.ErrnoException).code;
        }
        return extra;
    }
    if (typeof arg === "object" && !Array.isArray(arg)) {
        return arg as Record<string, unknown>;
    }
    return { detail: arg };
}

function emit(level: "debug" | "info" | "warn" | "error", message: string, args: unknown[], context: GovernXOneLogContext) {
    const merged: Record<string, unknown> = { ...context };
    for (const arg of args) {
        const normalized = normalizeArg(arg);
        if (normalized) Object.assign(merged, normalized);
    }

    const isDeliveryFailure = /delivery failed|batch delivery failed|not delivered/i.test(message);
    if (isDeliveryFailure && merged.reason == null) {
        merged.reason = deliveryFailureReason(args[0]);
    }

    let label = message;
    const retryMatch = message.match(/delivery failed \(attempt (\d+)\)/i);
    if (retryMatch) {
        label = `Not delivered, retrying (${retryMatch[1]}/${GOVERNXONE_MAX_RETRIES})`;
        merged.attempt = Number(retryMatch[1]);
        merged.maxRetries = GOVERNXONE_MAX_RETRIES;
    } else if (/batch delivery failed/i.test(message)) {
        label = `Not delivered after ${GOVERNXONE_MAX_RETRIES} retries — dropping batch`;
        merged.maxRetries = GOVERNXONE_MAX_RETRIES;
    }

    const log =
        level === "debug"
            ? console.debug
            : level === "info"
              ? console.info
              : level === "warn"
                ? console.warn
                : console.error;

    log(`${PREFIX} ${label}`, merged);
}

export function createGovernXOneLogger(context: GovernXOneLogContext): Logger {
    const debugEnabled = process.env.GOVERNXONE_DEBUG === "true";

    return {
        debug(msg, ...args) {
            if (!debugEnabled) return;
            emit("debug", msg, args, context);
        },
        info(msg, ...args) {
            emit("info", msg, args, context);
        },
        warn(msg, ...args) {
            emit("warn", msg, args, context);
        },
        error(msg, ...args) {
            emit("error", msg, args, context);
        },
    };
}

export function logGovernXOneSkipped(userId?: string) {
    const apiKey = process.env.GOVERNXONE_API_KEY?.trim();
    const projectId = process.env.GOVERNXONE_PROJECT_ID?.trim();
    const endpoint = process.env.GOVERNXONE_ENDPOINT?.trim();
    const missing: string[] = [];
    if (!apiKey) missing.push("API key");
    if (!projectId) missing.push("project ID");

    console.warn(`${PREFIX} Monitoring skipped`, {
        reason: userId
            ? `No profile credentials for this user, and env fallback is incomplete (missing ${missing.join(" and ") || "credentials"})`
            : `Missing ${missing.join(" and ") || "credentials"}`,
        api: endpoint ? governXOneMonitoringApi(endpoint) : "(not set)",
        endpoint: endpoint || "(not set)",
        projectId: projectId || "(not set)",
        environment: resolveGovernXOneEnvironment(),
        hasApiKey: Boolean(apiKey),
        hasProjectId: Boolean(projectId),
        userId: userId ?? null,
    });
}

import { ChatVertexAI } from "@langchain/google-vertexai";
import { HumanMessage, SystemMessage, type MessageContent } from "@langchain/core/messages";
import { GovernXOne } from "@governxone/ai-monitor";
import { resolveGovernXOneConfig } from "@/lib/governxone-credentials";
import {
    buildGovernXOneLogContext,
    createGovernXOneLogger,
    deliveryFailureReason,
    GOVERNXONE_MAX_RETRIES,
    logGovernXOneSkipped,
    resolveGovernXOneEnvironment,
} from "@/lib/governxone-logger";

const modelName = process.env.GEMINI_VOICE_MODEL || "gemini-2.5-flash";
const textModelName = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
const location = process.env.GOOGLE_CLOUD_LOCATION || process.env.VERTEX_LOCATION || "us-central1";

type MonitorOptions = {
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
};

function resolveApiKey(): string | undefined {
    return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
}

function ensureAuthConfigured() {
    const apiKey = resolveApiKey();
    const hasAdc =
        Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS) ||
        Boolean(process.env.GOOGLE_CLOUD_CREDENTIALS) ||
        Boolean(process.env.GOOGLE_WEB_CREDENTIALS);

    if (!apiKey && !hasAdc) {
        throw new Error(
            "Vertex AI auth is not configured. Set GOOGLE_API_KEY / GEMINI_API_KEY (Express Mode) or GOOGLE_APPLICATION_CREDENTIALS."
        );
    }

    return apiKey;
}

/**
 * Vertex AI is not in loadProvider()'s supported list yet, so we init the
 * SDK (without auto-instrument) and call track() ourselves around ChatVertexAI.
 */
async function ensureGovernXOne(userId?: string) {
    const config = await resolveGovernXOneConfig(userId);
    if (!config) {
        logGovernXOneSkipped(userId);
        return null;
    }

    const context = buildGovernXOneLogContext(config, config.source);

    // Shut down the existing singleton whenever credentials or maxRetries change.
    // GovernXOne.ensureInit() is a singleton — it silently ignores re-init calls
    // once a client already exists, so we must explicitly shut it down when the
    // active user (and therefore their apiKey / projectId) differs from the client
    // that is already initialised. Without this, requests from User B would silently
    // be tracked under User A's project.
    if (GovernXOne._client) {
        const activeConfig = GovernXOne._client.getConfig();
        const credentialsChanged =
            activeConfig.apiKey !== config.apiKey ||
            activeConfig.projectId !== config.projectId;
        const retriesChanged = activeConfig.maxRetries !== GOVERNXONE_MAX_RETRIES;
        if (credentialsChanged || retriesChanged) {
            await GovernXOne.shutdown();
        }
    }

    const client = GovernXOne.ensureInit({
        apiKey: config.apiKey,
        projectId: config.projectId,
        ...(config.endpoint ? { baseUrl: config.endpoint } : {}),
        environment: resolveGovernXOneEnvironment(),
        debug: process.env.GOVERNXONE_DEBUG === "true",
        logger: createGovernXOneLogger(context),
        maxRetries: GOVERNXONE_MAX_RETRIES,
        // Avoid monkey-patching unrelated optional peers (openai/ai/langchain paths).
        autoInstrument: false,
    });

    dropFailedGovernXOneBatches(client);
    return client;
}

type GovernXOneDeliverer = {
    __dropFailedBatches?: boolean;
    deliverBatch: (batch: unknown[], attempt: number) => Promise<unknown>;
    logger?: { error: (msg: string, err: unknown) => void };
};

/**
 * The SDK re-queues a batch after maxRetries, so the flush loop retries forever.
 * Swallow the final delivery error so the failed batch is dropped instead.
 */
function dropFailedGovernXOneBatches(client: ReturnType<typeof GovernXOne.ensureInit>) {
    if (!client) return;

    const internal = client as unknown as GovernXOneDeliverer;
    if (internal.__dropFailedBatches) return;
    internal.__dropFailedBatches = true;

    const originalDeliver = internal.deliverBatch.bind(client);
    internal.deliverBatch = async function (batch: unknown[], attempt: number) {
        try {
            return await originalDeliver(batch, attempt);
        } catch (err) {
            internal.logger?.error("Batch delivery failed after all retries", err);
            return { success: false };
        }
    };
}

function trackVertexInvocation(options: {
    model: string;
    prompt: string;
    response: string;
    latencyMs: number;
    inputTokens?: number;
    outputTokens?: number;
    error?: string;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
}) {
    try {
        const client = GovernXOne.ensureInit({ autoInstrument: false });
        if (!client) {
            return;
        }

        client.track({
            provider: "gemini",
            model: options.model,
            prompt: options.prompt,
            response: options.response,
            inputTokens: options.inputTokens ?? 0,
            outputTokens: options.outputTokens ?? 0,
            latencyMs: options.latencyMs,
            userId: options.userId,
            sessionId: options.sessionId,
            metadata: {
                transport: "vertex-ai",
                package: "@langchain/google-vertexai",
                ...options.metadata,
            },
            ...(options.error ? { status: "error" as const, error: options.error } : {}),
        });
    } catch (err) {
        console.error("[governxone] Failed to enqueue payload", {
            reason: deliveryFailureReason(err),
            environment: resolveGovernXOneEnvironment(),
            projectId: process.env.GOVERNXONE_PROJECT_ID?.trim() || "(not set)",
        });
    }
}

export function messageContentToText(content: MessageContent): string {
    if (typeof content === "string") {
        return content;
    }

    if (!Array.isArray(content)) {
        return "";
    }

    return content
        .map((part) => {
            if (typeof part === "string") {
                return part;
            }
            if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
                return part.text;
            }
            return "";
        })
        .join("");
}

function usageFromMessage(message: {
    usage_metadata?: { input_tokens?: number; output_tokens?: number } | null;
}) {
    return {
        inputTokens: message.usage_metadata?.input_tokens ?? 0,
        outputTokens: message.usage_metadata?.output_tokens ?? 0,
    };
}

export function getChatVertexAI(type: "default" | "text" = "default") {
    const apiKey = ensureAuthConfigured();
    const name = type === "text" ? textModelName : modelName;

    return new ChatVertexAI({
        model: name,
        temperature: 0,
        maxRetries: 2,
        location,
        ...(apiKey ? { apiKey } : {}),
    });
}

function buildTextPrompt(systemInstruction: string, userPrompt: string) {
    return JSON.stringify({
        systemInstruction,
        userPrompt,
    });
}

export async function invokeChatVertexAI(options: {
    systemInstruction: string;
    userPrompt: string;
    type?: "default" | "text";
} & MonitorOptions): Promise<string> {
    await ensureGovernXOne(options.userId);

    const type = options.type ?? "text";
    const model = type === "text" ? textModelName : modelName;
    const prompt = buildTextPrompt(options.systemInstruction, options.userPrompt);
    const started = Date.now();

    try {
        const llm = getChatVertexAI(type);
        const result = await llm.invoke([
            new SystemMessage(options.systemInstruction),
            new HumanMessage(options.userPrompt),
        ]);
        const response = messageContentToText(result.content).trim();
        const usage = usageFromMessage(result);

        trackVertexInvocation({
            model,
            prompt,
            response,
            latencyMs: Date.now() - started,
            ...usage,
            userId: options.userId,
            sessionId: options.sessionId,
            metadata: options.metadata,
        });

        return response;
    } catch (err) {
        trackVertexInvocation({
            model,
            prompt,
            response: "",
            latencyMs: Date.now() - started,
            error: err instanceof Error ? err.message : String(err),
            userId: options.userId,
            sessionId: options.sessionId,
            metadata: options.metadata,
        });
        throw err;
    }
}

export async function* streamChatVertexAI(options: {
    systemInstruction: string;
    userPrompt: string;
    type?: "default" | "text";
} & MonitorOptions): AsyncGenerator<string> {
    await ensureGovernXOne(options.userId);

    const type = options.type ?? "text";
    const model = type === "text" ? textModelName : modelName;
    const prompt = buildTextPrompt(options.systemInstruction, options.userPrompt);
    const started = Date.now();
    let fullResponse = "";
    let inputTokens = 0;
    let outputTokens = 0;

    try {
        const llm = getChatVertexAI(type);
        const stream = await llm.stream([
            new SystemMessage(options.systemInstruction),
            new HumanMessage(options.userPrompt),
        ]);

        for await (const chunk of stream) {
            const usage = usageFromMessage(chunk);
            if (usage.inputTokens) inputTokens = usage.inputTokens;
            if (usage.outputTokens) outputTokens = usage.outputTokens;

            const text = messageContentToText(chunk.content);
            if (text) {
                fullResponse += text;
                yield text;
            }
        }

        trackVertexInvocation({
            model,
            prompt,
            response: fullResponse.trim(),
            latencyMs: Date.now() - started,
            inputTokens,
            outputTokens,
            userId: options.userId,
            sessionId: options.sessionId,
            metadata: { ...options.metadata, streaming: true },
        });
    } catch (err) {
        trackVertexInvocation({
            model,
            prompt,
            response: fullResponse.trim(),
            latencyMs: Date.now() - started,
            inputTokens,
            outputTokens,
            error: err instanceof Error ? err.message : String(err),
            userId: options.userId,
            sessionId: options.sessionId,
            metadata: { ...options.metadata, streaming: true },
        });
        throw err;
    }
}

const WORD_GROUP_SIZE = 3;
const WORD_GROUP_DELAY_MS = 20;

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Re-chunk an LLM token stream into small word groups (default 3 words)
 * so the UI can render a smooth typewriter effect even when the model
 * emits large sentence-sized chunks.
 */
export async function* paceStreamByWords(
    source: AsyncIterable<string>,
    options?: { wordsPerChunk?: number; delayMs?: number }
): AsyncGenerator<string> {
    const wordsPerChunk = options?.wordsPerChunk ?? WORD_GROUP_SIZE;
    const delayMs = options?.delayMs ?? WORD_GROUP_DELAY_MS;
    let pending = "";

    const takeGroups = async function* (flushAll: boolean): AsyncGenerator<string> {
        const parts = pending.match(/\S+\s*/g) ?? [];
        if (parts.length === 0) {
            if (flushAll && pending) {
                yield pending;
                pending = "";
            }
            return;
        }

        let index = 0;
        while (index < parts.length) {
            const remaining = parts.length - index;
            if (!flushAll && remaining < wordsPerChunk) break;

            const size = Math.min(wordsPerChunk, remaining);
            yield parts.slice(index, index + size).join("");
            index += size;
            if (delayMs > 0) await sleep(delayMs);
        }

        pending = parts.slice(index).join("");
    };

    for await (const chunk of source) {
        pending += chunk;
        yield* takeGroups(false);
    }

    yield* takeGroups(true);
}

export async function invokeChatVertexAIMultimodal(options: {
    systemInstruction: string;
    text: string;
    media: { mimeType: string; data: string };
    type?: "default" | "text";
} & MonitorOptions): Promise<string> {
    await ensureGovernXOne(options.userId);

    const type = options.type ?? "default";
    const model = type === "text" ? textModelName : modelName;
    const prompt = JSON.stringify({
        systemInstruction: options.systemInstruction,
        text: options.text,
        media: { mimeType: options.media.mimeType, data: "[omitted]" },
    });
    const started = Date.now();

    try {
        const llm = getChatVertexAI(type);
        const result = await llm.invoke([
            new SystemMessage(options.systemInstruction),
            new HumanMessage({
                content: [
                    {
                        type: "media",
                        mimeType: options.media.mimeType,
                        data: options.media.data,
                    },
                    {
                        type: "text",
                        text: options.text,
                    },
                ],
            }),
        ]);
        const response = messageContentToText(result.content).trim();
        const usage = usageFromMessage(result);

        trackVertexInvocation({
            model,
            prompt,
            response,
            latencyMs: Date.now() - started,
            ...usage,
            userId: options.userId,
            sessionId: options.sessionId,
            metadata: { ...options.metadata, multimodal: true },
        });

        return response;
    } catch (err) {
        trackVertexInvocation({
            model,
            prompt,
            response: "",
            latencyMs: Date.now() - started,
            error: err instanceof Error ? err.message : String(err),
            userId: options.userId,
            sessionId: options.sessionId,
            metadata: { ...options.metadata, multimodal: true },
        });
        throw err;
    }
}

export { modelName, textModelName };

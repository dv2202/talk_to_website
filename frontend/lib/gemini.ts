import { ChatVertexAI } from "@langchain/google-vertexai";
import { HumanMessage, SystemMessage, type MessageContent } from "@langchain/core/messages";

const modelName = process.env.GEMINI_VOICE_MODEL || "gemini-2.5-flash";
const textModelName = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
const location = process.env.GOOGLE_CLOUD_LOCATION || process.env.VERTEX_LOCATION || "us-central1";

/** Request context passed by callers (kept for call-site compatibility and future logging). */
type CallContext = {
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

export async function invokeChatVertexAI(options: {
    systemInstruction: string;
    userPrompt: string;
    type?: "default" | "text";
} & CallContext): Promise<string> {
    const llm = getChatVertexAI(options.type ?? "text");
    const result = await llm.invoke([
        new SystemMessage(options.systemInstruction),
        new HumanMessage(options.userPrompt),
    ]);
    return messageContentToText(result.content).trim();
}

export async function* streamChatVertexAI(options: {
    systemInstruction: string;
    userPrompt: string;
    type?: "default" | "text";
} & CallContext): AsyncGenerator<string> {
    const llm = getChatVertexAI(options.type ?? "text");
    const stream = await llm.stream([
        new SystemMessage(options.systemInstruction),
        new HumanMessage(options.userPrompt),
    ]);

    for await (const chunk of stream) {
        const text = messageContentToText(chunk.content);
        if (text) yield text;
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
} & CallContext): Promise<string> {
    const llm = getChatVertexAI(options.type ?? "default");
    const result = await llm.invoke([
        new SystemMessage(options.systemInstruction),
        new HumanMessage({
            content: [
                { type: "media", mimeType: options.media.mimeType, data: options.media.data },
                { type: "text", text: options.text },
            ],
        }),
    ]);
    return messageContentToText(result.content).trim();
}

export { modelName, textModelName };

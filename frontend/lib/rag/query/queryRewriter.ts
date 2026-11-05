/**
 * Rewrites a follow-up question into a standalone search query before RAG
 * retrieval. The chat LLM already sees conversation history, but retrieval
 * embeds only the query, so "what's its price?" would otherwise search for
 * nothing specific. This module has no LLM dependency: the caller injects the
 * model call, which keeps it testable and lets any provider be used.
 */

export type HistoryTurn = { userMessage: string; aiResponse: string };

export type RewriteInvoke = (input: {
  systemInstruction: string;
  userPrompt: string;
}) => Promise<string>;

/** Only the latest turns matter for resolving references like "it". */
export const REWRITE_HISTORY_TURNS = 4;
/** Assistant replies can be long; their opening usually names the subject. */
const MAX_ANSWER_CHARS = 400;
const MAX_QUERY_CHARS = 300;
export const REWRITE_TIMEOUT_MS = 3000;

export const REWRITE_SYSTEM_INSTRUCTION = [
  "You rewrite a user's latest chat message into a standalone search query for a knowledge base.",
  "Resolve pronouns and references (it, that, they, this plan, the second one) using the conversation.",
  "Keep the user's language and intent. Do not answer the question. Do not add facts that are not in the conversation.",
  "If the message is already standalone, return it unchanged.",
  "Output only the rewritten query on a single line, with no quotes, labels or explanation.",
].join("\n");

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

export function buildRewritePrompt(history: HistoryTurn[], message: string): string {
  const turns = history
    .slice(-REWRITE_HISTORY_TURNS)
    .map((turn) => `User: ${truncate(turn.userMessage, MAX_ANSWER_CHARS)}\nAssistant: ${truncate(turn.aiResponse, MAX_ANSWER_CHARS)}`)
    .join("\n\n");
  return `Conversation:\n${turns}\n\nLatest message: ${message}\n\nStandalone search query:`;
}

/** Returns the cleaned query, or null when the model output is unusable. */
export function sanitizeRewrittenQuery(raw: string): string | null {
  const firstLine = raw.trim().split(/\r?\n/)[0] ?? "";
  const cleaned = firstLine
    .replace(/^(standalone )?(search )?query:\s*/i, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();
  if (!cleaned || cleaned.length > MAX_QUERY_CHARS) return null;
  return cleaned;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`query rewrite timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Returns a standalone query for retrieval. Never throws: with no history, or
 * on model error, timeout or bad output, it falls back to the original message
 * so a rewrite problem can only make retrieval no better, never break chat.
 */
export async function rewriteQueryForRetrieval(options: {
  message: string;
  history: HistoryTurn[];
  invoke: RewriteInvoke;
  timeoutMs?: number;
}): Promise<string> {
  const { message, history, invoke, timeoutMs = REWRITE_TIMEOUT_MS } = options;
  if (history.length === 0) return message;

  try {
    const raw = await withTimeout(
      invoke({
        systemInstruction: REWRITE_SYSTEM_INSTRUCTION,
        userPrompt: buildRewritePrompt(history, message),
      }),
      timeoutMs
    );
    return sanitizeRewrittenQuery(raw) ?? message;
  } catch (err) {
    console.warn("[rag] query rewrite failed, using original message:", err);
    return message;
  }
}

export const FALLBACK_CONTACT_TYPES = [
  "EMAIL",
  "WHATSAPP",
  "TELEGRAM",
  "PHONE",
] as const;

export type FallbackContactTypeValue = (typeof FALLBACK_CONTACT_TYPES)[number];

export type FallbackContactEntry = {
  type: FallbackContactTypeValue;
  value: string;
};

/** Shown for out-of-knowledge and contact-request replies. */
export const SHOW_CONTACT_MARKER = "[[SHOW_CONTACT]]";
/** Legacy marker from the single-contact launch — still stripped if the model emits it. */
export const NO_KNOWLEDGE_MARKER = "[[NO_KNOWLEDGE]]";

const CONTACT_MARKERS = [SHOW_CONTACT_MARKER, NO_KNOWLEDGE_MARKER] as const;

export const FALLBACK_CONTACT_LABELS: Record<FallbackContactTypeValue, string> = {
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
  TELEGRAM: "Telegram",
  PHONE: "Call",
};

export const FALLBACK_CONTACT_PLACEHOLDERS: Record<FallbackContactTypeValue, string> = {
  EMAIL: "support@example.com",
  WHATSAPP: "+919898989898",
  TELEGRAM: "username",
  PHONE: "+919898989898",
};

export const CONTACT_INTENT_RE =
  /\b(contact|connect|reach|email|support|team|phone|call|get\s+in\s+touch|talk\s+to|speak\s+(?:to|with)|whatsapp|telegram|human|agent|representative)\b/i;

export function isFallbackContactType(value: unknown): value is FallbackContactTypeValue {
  return typeof value === "string" && FALLBACK_CONTACT_TYPES.includes(value as FallbackContactTypeValue);
}

export function isContactIntentMessage(message: string): boolean {
  return CONTACT_INTENT_RE.test(message);
}

function normalizeOneContact(
  type: FallbackContactTypeValue,
  value: unknown
): { entry?: FallbackContactEntry; error?: string } {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    return { error: `${FALLBACK_CONTACT_LABELS[type]} value is required` };
  }

  if (type === "EMAIL") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { error: "Enter a valid email address" };
    }
    return { entry: { type, value: trimmed } };
  }

  if (type === "TELEGRAM") {
    const username = trimmed.replace(/^@/, "");
    if (!/^[a-zA-Z0-9_]{5,32}$/.test(username)) {
      return { error: "Enter a valid Telegram username" };
    }
    return { entry: { type, value: username } };
  }

  const phone = trimmed.replace(/[^\d+]/g, "");
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) {
    return { error: `Enter a valid ${FALLBACK_CONTACT_LABELS[type].toLowerCase()} number` };
  }

  return {
    entry: { type, value: phone.startsWith("+") ? `+${digits}` : digits },
  };
}

/** Normalize a list of contacts from the API / form. Empty array clears. */
export function normalizeFallbackContacts(
  input: unknown
): { contacts: FallbackContactEntry[]; error?: string } {
  if (input === null || input === undefined) {
    return { contacts: [] };
  }

  if (!Array.isArray(input)) {
    return { contacts: [], error: "Fallback contacts must be an array" };
  }

  if (input.length === 0) {
    return { contacts: [] };
  }

  const seen = new Set<FallbackContactTypeValue>();
  const contacts: FallbackContactEntry[] = [];

  for (const item of input) {
    if (!item || typeof item !== "object") {
      return { contacts: [], error: "Invalid fallback contact entry" };
    }
    const type = (item as { type?: unknown }).type;
    const value = (item as { value?: unknown }).value;
    if (!isFallbackContactType(type)) {
      return { contacts: [], error: "Invalid fallback contact type" };
    }
    if (seen.has(type)) {
      return { contacts: [], error: `Duplicate ${FALLBACK_CONTACT_LABELS[type]} contact` };
    }
    seen.add(type);
    const result = normalizeOneContact(type, value);
    if (result.error || !result.entry) {
      return { contacts: [], error: result.error || "Invalid fallback contact" };
    }
    contacts.push(result.entry);
  }

  return { contacts };
}

/** Read contacts from bot JSON field, with legacy single-field fallback. */
export function parseBotFallbackContacts(bot: {
  fallbackContacts?: unknown;
  fallbackContactType?: unknown;
  fallbackContactValue?: unknown;
}): FallbackContactEntry[] {
  const fromJson = normalizeFallbackContacts(bot.fallbackContacts);
  if (!fromJson.error && fromJson.contacts.length > 0) {
    return fromJson.contacts;
  }

  if (isFallbackContactType(bot.fallbackContactType) && typeof bot.fallbackContactValue === "string") {
    const legacy = normalizeOneContact(bot.fallbackContactType, bot.fallbackContactValue);
    if (legacy.entry) return [legacy.entry];
  }

  return [];
}

export function buildFallbackContactHref(
  type: FallbackContactTypeValue,
  value: string
): string {
  if (type === "EMAIL") {
    return `mailto:${value}`;
  }
  if (type === "WHATSAPP") {
    const digits = value.replace(/\D/g, "");
    return `https://wa.me/${digits}`;
  }
  if (type === "TELEGRAM") {
    const username = value.replace(/^@/, "");
    return `https://t.me/${username}`;
  }
  return `tel:${value}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function stripContactMarkers(text: string): {
  cleaned: string;
  shouldShowContact: boolean;
} {
  let shouldShowContact = false;
  let cleaned = text;
  for (const marker of CONTACT_MARKERS) {
    if (cleaned.includes(marker)) {
      shouldShowContact = true;
      cleaned = cleaned.replace(new RegExp(`\\s*${escapeRegExp(marker)}\\s*`, "g"), " ");
    }
  }
  cleaned = cleaned
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/ {2,}/g, " ")
    .trim();
  return { cleaned, shouldShowContact };
}

/** @deprecated Use stripContactMarkers */
export function stripNoKnowledgeMarker(text: string): {
  cleaned: string;
  hasNoKnowledge: boolean;
} {
  const { cleaned, shouldShowContact } = stripContactMarkers(text);
  return { cleaned, hasNoKnowledge: shouldShowContact };
}

/** Hide complete and trailing-incomplete contact markers while streaming. */
export function getStreamableResponse(text: string): string {
  let result = text;
  for (const marker of CONTACT_MARKERS) {
    result = result.replace(new RegExp(escapeRegExp(marker), "g"), "");
  }
  for (const marker of CONTACT_MARKERS) {
    for (let len = Math.min(marker.length - 1, result.length); len >= 1; len--) {
      if (marker.startsWith(result.slice(-len))) {
        result = result.slice(0, -len);
        break;
      }
    }
  }
  return result.replace(/\s+$/g, "");
}

export function buildContactPromptRule(hasFallbackContact: boolean): string {
  if (!hasFallbackContact) {
    return "";
  }

  return [
    "\n\nCONTACT BUTTON RULE (critical):",
    "\n- When the visitor asks to contact, connect with, reach, speak with, call, email, or get in touch with the team/support/a human, reply with exactly: \"You can contact our team here:\"",
    `\n- Then on a new line write only the marker ${SHOW_CONTACT_MARKER}.`,
    "\n\nOUT-OF-KNOWLEDGE RULE (critical):",
    '\n- If the answer is not in the knowledge, reply with exactly: "I don\'t have any knowledge about your question. You can contact us here:"',
    `\n- Then on a new line write only the marker ${SHOW_CONTACT_MARKER} (never explain or mention this marker to the visitor).`,
    "\n- Do not invent facts. Do not add the marker when you answered from the knowledge and the visitor was not asking to contact the team.",
  ].join("");
}

/** @deprecated Use buildContactPromptRule */
export function buildNoKnowledgePromptRule(hasFallbackContact: boolean): string {
  return buildContactPromptRule(hasFallbackContact);
}

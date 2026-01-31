const API_URL = process.env.NEXT_PUBLIC_APP_URL || "";

type FetchOptions = RequestInit & {
    params?: Record<string, string>;
};

async function fetchApi(endpoint: string, options: FetchOptions = {}) {
    const { params, ...fetchOptions } = options;

    let url = `${API_URL}${endpoint}`;

    if (params) {
        const searchParams = new URLSearchParams(params);
        url += `?${searchParams.toString()}`;
    }

    const response = await fetch(url, {
        ...fetchOptions,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...fetchOptions.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
}

export const api = {
    // Bots
    getBots: () => fetchApi("/api/bots"),
    getBot: (id: string) => fetchApi(`/api/bots/${id}`),
    createBot: (data: Record<string, unknown>) =>
        fetchApi("/api/bots", { method: "POST", body: JSON.stringify(data) }),
    updateBot: (id: string, data: Record<string, unknown>) =>
        fetchApi(`/api/bots/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteBot: (id: string) =>
        fetchApi(`/api/bots/${id}`, { method: "DELETE" }),
    checkBotName: (name: string, excludeBotId?: string) =>
        fetchApi(`/api/bots/check-name/${name}`, {
            params: excludeBotId ? { excludeBotId } : undefined,
        }),
    getBotApiKeys: () => fetchApi("/api/bots/api-keys"),
    regenerateBotApiKey: (id: string) =>
        fetchApi(`/api/bots/${id}/api-key/regenerate`, {
            method: "POST",
        }),

    // Profile
    getGovernXOneCredentials: () => fetchApi("/api/profile/governxone"),
    saveGovernXOneCredentials: (data: {
        apiKey?: string;
        projectId?: string;
        endpoint?: string;
        clear?: boolean;
    }) =>
        fetchApi("/api/profile/governxone", {
            method: "PUT",
            body: JSON.stringify(data),
        }),

    // Knowledge Sources
    getKnowledge: (botId: string) =>
        fetchApi(`/api/knowledge/${botId}`),
    uploadKnowledge: async (botId: string, file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("botId", botId);

        const response = await fetch(`${API_URL}/api/knowledge/upload`, {
            method: "POST",
            credentials: "include",
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: "Upload failed" }));
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        return response.json();
    },
    uploadAvatar: async (file: File) => {
        const { compressAvatarImage } = await import("@/lib/compress-avatar");
        const compressed = await compressAvatarImage(file);

        const response = await fetch(
            `${API_URL}/api/avatar/upload?filename=${encodeURIComponent(compressed.name)}`,
            {
                method: "POST",
                credentials: "include",
                headers: {
                    "content-type": compressed.type || "application/octet-stream",
                },
                body: compressed,
            }
        );

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: "Upload failed" }));
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        return response.json() as Promise<{ url: string }>;
    },
    deleteAvatar: async (url: string) => {
        const response = await fetch(`${API_URL}/api/avatar`, {
            method: "DELETE",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: "Delete failed" }));
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        return response.json() as Promise<{ ok: boolean }>;
    },
    // URL Knowledge — multi-step flow
    discoverUrls: (url: string) =>
        fetchApi("/api/knowledge/url/discover", {
            method: "POST",
            body: JSON.stringify({ url }),
        }),
    scrapeUrlContents: (urls: string[]) =>
        fetchApi("/api/knowledge/url/scrape-batch", {
            method: "POST",
            body: JSON.stringify({ urls }),
        }),
    saveUrlKnowledgeBatch: (botId: string, sources: { name: string; content: string }[]) =>
        fetchApi("/api/knowledge/url/save-batch", {
            method: "POST",
            body: JSON.stringify({ botId, sources }),
        }),

    // Legacy single-URL knowledge (deprecated, use the multi-step flow above)
    addUrlKnowledge: (botId: string, url: string) =>
        fetchApi("/api/knowledge/url", {
            method: "POST",
            body: JSON.stringify({ botId, url }),
        }),
    deleteKnowledge: (id: string) =>
        fetchApi(`/api/knowledge/${id}`, { method: "DELETE" }),
    deleteAllKnowledge: (botId: string) =>
        fetchApi("/api/knowledge/clear", {
            method: "POST",
            body: JSON.stringify({ botId }),
        }),

    // Chat
    sendMessage: (data: {
        botId?: string;
        botName?: string;
        message: string;
        sessionId?: string;
        visitorId?: string;
        visitorToken?: string;
        visitorProfile?: Record<string, unknown>;
    }) =>
        fetchApi("/api/chat", { method: "POST", body: JSON.stringify(data) }),

    streamMessage: async (
        data: {
            botId?: string;
            botName?: string;
            message: string;
            sessionId?: string;
            visitorId?: string;
            visitorToken?: string;
            visitorProfile?: Record<string, unknown>;
        },
        handlers: {
            onToken?: (text: string) => void;
            onDone?: (result: {
                id: string;
                response: string;
                createdAt: string;
                visitorId: string | null;
                fallbackContact?: {
                    type: "EMAIL" | "WHATSAPP" | "TELEGRAM" | "PHONE";
                    value: string;
                } | null;
                fallbackContacts?: Array<{
                    type: "EMAIL" | "WHATSAPP" | "TELEGRAM" | "PHONE";
                    value: string;
                }> | null;
            }) => void;
            onError?: (error: string) => void;
        } = {}
    ) => {
        const response = await fetch(`${API_URL}/api/chat`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: "Request failed" }));
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        if (!response.body) {
            throw new Error("Streaming is not supported in this browser");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalResult: {
            id: string;
            response: string;
            createdAt: string;
            visitorId: string | null;
            fallbackContact?: {
                type: "EMAIL" | "WHATSAPP" | "TELEGRAM" | "PHONE";
                value: string;
            } | null;
            fallbackContacts?: Array<{
                type: "EMAIL" | "WHATSAPP" | "TELEGRAM" | "PHONE";
                value: string;
            }> | null;
        } | null = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split("\n\n");
            buffer = parts.pop() || "";

            for (const part of parts) {
                const line = part
                    .split("\n")
                    .map((l) => l.trim())
                    .find((l) => l.startsWith("data:"));
                if (!line) continue;

                let payload: {
                    type?: string;
                    text?: string;
                    error?: string;
                    id?: string;
                    response?: string;
                    createdAt?: string;
                    visitorId?: string | null;
                    fallbackContact?: {
                        type: "EMAIL" | "WHATSAPP" | "TELEGRAM" | "PHONE";
                        value: string;
                    } | null;
                    fallbackContacts?: Array<{
                        type: "EMAIL" | "WHATSAPP" | "TELEGRAM" | "PHONE";
                        value: string;
                    }> | null;
                };
                try {
                    payload = JSON.parse(line.slice(5).trim());
                } catch {
                    continue;
                }

                if (payload.type === "token" && payload.text) {
                    handlers.onToken?.(payload.text);
                } else if (payload.type === "done") {
                    finalResult = {
                        id: payload.id || "",
                        response: payload.response || "",
                        createdAt: payload.createdAt || "",
                        visitorId: payload.visitorId ?? null,
                        fallbackContacts:
                            payload.fallbackContacts ??
                            (payload.fallbackContact ? [payload.fallbackContact] : null),
                    };
                    handlers.onDone?.(finalResult);
                } else if (payload.type === "error") {
                    const message = payload.error || "Failed to generate response";
                    handlers.onError?.(message);
                    throw new Error(message);
                }
            }
        }

        if (!finalResult) {
            throw new Error("Stream ended without a response");
        }

        return finalResult;
    },
    registerVisitor: (data: {
        botId?: string;
        botName?: string;
        visitorId?: string;
        visitorToken: string;
        sessionId?: string;
        profile?: Record<string, unknown>;
    }) => fetchApi("/api/chat/visitor/register", {
        method: "POST",
        body: JSON.stringify(data),
    }),
    getConversations: (botId: string, params?: { sessionId?: string; visitorId?: string }) =>
        fetchApi(`/api/chat/${botId}`, { params }),
    getAdminConversations: (botId: string) =>
        fetchApi(`/api/chat/admin/${botId}`),
    getAdminConversationDetails: (botId: string, visitorId: string) => {
        // Params from the URL may already be percent-encoded (e.g. legacy%3A...).
        // Decode first so we don't double-encode into legacy%253A...
        let decodedVisitorId = visitorId;
        try {
            decodedVisitorId = decodeURIComponent(visitorId);
        } catch {
            decodedVisitorId = visitorId;
        }
        return fetchApi(
            `/api/chat/admin/${botId}/visitors/${encodeURIComponent(decodedVisitorId)}`
        );
    },

    // Widget
    getBotConfig: (botName: string) =>
        fetchApi(`/api/widget/config/${botName}`),

    // Live human chat
    createLiveRoom: (data: {
        botId?: string;
        botName?: string;
        sessionId?: string;
        visitorId?: string;
        visitorToken?: string;
        visitorProfile?: Record<string, unknown>;
        widgetApiKey?: string;
    }) =>
        fetchApi("/api/live/rooms", {
            method: "POST",
            body: JSON.stringify(data),
            headers: data.widgetApiKey ? { "X-Widget-Api-Key": data.widgetApiKey } : undefined,
        }),
    getLiveRoom: (roomId: string, params?: { visitorId?: string; widgetApiKey?: string }) =>
        fetchApi(`/api/live/rooms/${roomId}`, {
            params: params ? { visitorId: params.visitorId || "" } : undefined,
            headers: params?.widgetApiKey ? { "X-Widget-Api-Key": params.widgetApiKey } : undefined,
        }),
    acceptLiveRoom: (roomId: string) =>
        fetchApi(`/api/live/rooms/${roomId}/accept`, { method: "POST" }),
    expireLiveRoom: (roomId: string, data?: { visitorId?: string; widgetApiKey?: string; reason?: string }) =>
        fetchApi(`/api/live/rooms/${roomId}/expire`, {
            method: "POST",
            body: JSON.stringify(data || {}),
            headers: data?.widgetApiKey ? { "X-Widget-Api-Key": data.widgetApiKey } : undefined,
        }),
    sendLiveMessage: (roomId: string, data: { content: string; visitorId?: string; widgetApiKey?: string }) =>
        fetchApi(`/api/live/rooms/${roomId}/messages`, {
            method: "POST",
            body: JSON.stringify(data),
            headers: data.widgetApiKey ? { "X-Widget-Api-Key": data.widgetApiKey } : undefined,
        }),
    sendLiveTyping: (
        roomId: string,
        data: { isTyping: boolean; visitorId?: string; widgetApiKey?: string }
    ) =>
        fetchApi(`/api/live/rooms/${roomId}/typing`, {
            method: "POST",
            body: JSON.stringify(data),
            headers: data.widgetApiKey ? { "X-Widget-Api-Key": data.widgetApiKey } : undefined,
        }),
    suggestLiveReply: (roomId: string) =>
        fetchApi(`/api/live/rooms/${roomId}/suggest`, { method: "POST" }),
    getOwnerLiveTokens: () => fetchApi("/api/live/owner-token"),
    listLiveRooms: (params?: { status?: string }) =>
        fetchApi("/api/live/rooms", { params }),

    // Billing & Payments (Razorpay)
    getBilling: () => fetchApi("/api/billing"),
    getBillingHistory: () => fetchApi("/api/billing/history"),
    cancelSubscription: () =>
        fetchApi("/api/billing/cancel", { method: "POST" }),
    createOrder: (data: { planId: string; currency?: string }) =>
        fetchApi("/api/create-order", {
            method: "POST",
            body: JSON.stringify(data),
        }),
    verifyPayment: (data: {
        razorpay_subscription_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
    }) =>
        fetchApi("/api/verify-payment", {
            method: "POST",
            body: JSON.stringify(data),
        }),

    // Platform admin
    getAdminUsers: () => fetchApi("/api/admin/users"),
    getAdminUser: (userId: string) => fetchApi(`/api/admin/users/${userId}`),
    deleteAdminUser: (userId: string) =>
        fetchApi(`/api/admin/users/${userId}`, { method: "DELETE" }),
    setAdminUserPlan: (userId: string, planId: string) =>
        fetchApi(`/api/admin/users/${userId}/plan`, {
            method: "PATCH",
            body: JSON.stringify({ planId }),
        }),
    getAdminBot: (botId: string) => fetchApi(`/api/admin/bots/${botId}`),
    updateAdminBot: (botId: string, data: Record<string, unknown>) =>
        fetchApi(`/api/admin/bots/${botId}`, {
            method: "PUT",
            body: JSON.stringify(data),
        }),
    getAdminBotConversations: (botId: string) =>
        fetchApi(`/api/admin/bots/${botId}/conversations`),
    getAdminBotConversationDetails: (botId: string, visitorId: string) => {
        let decodedVisitorId = visitorId;
        try {
            decodedVisitorId = decodeURIComponent(visitorId);
        } catch {
            decodedVisitorId = visitorId;
        }
        return fetchApi(
            `/api/admin/bots/${botId}/conversations/${encodeURIComponent(decodedVisitorId)}`
        );
    },
};

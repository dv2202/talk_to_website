"use client";

import { use, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import {
    ConversationsWhatsAppView,
    type VisitorEntry,
} from "@/components/conversations/ConversationsWhatsAppView";
import { Loader2 } from "lucide-react";

interface ConversationListResponse {
    bot: {
        id: string;
        name: string;
        botName: string;
    };
    visitors: VisitorEntry[];
}

export default function ConversationsBotLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const routeParams = useParams<{ id: string; visitorId?: string }>();
    const [data, setData] = useState<ConversationListResponse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        void api
            .getAdminConversations(id)
            .then((response: ConversationListResponse) => {
                if (!cancelled) setData(response);
            })
            .catch((error) => {
                console.error("Failed to fetch conversations:", error);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [id]);

    if (loading) {
        return (
            <div className="flex h-[calc(100dvh-4rem)] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    let selectedVisitorId = routeParams.visitorId;
    if (selectedVisitorId) {
        try {
            selectedVisitorId = decodeURIComponent(selectedVisitorId);
        } catch {
            // keep raw param if decoding fails
        }
    }

    return (
        <>
            <ConversationsWhatsAppView
                botId={id}
                botName={data?.bot.name || "Conversations"}
                botHandle={data?.bot.botName}
                visitors={data?.visitors || []}
                selectedVisitorId={selectedVisitorId}
            />
            {/* Route segments stay for URL/history; UI lives in the persistent layout above. */}
            <div hidden>{children}</div>
        </>
    );
}

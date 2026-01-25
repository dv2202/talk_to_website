"use client";

import { useEffect, useState, use } from "react";
import { api } from "@/lib/api";
import {
    AssistantForm,
    type AssistantFormBot,
} from "@/components/AssistantForm";
import { Loader2 } from "lucide-react";

export default function EditAssistantPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const [bot, setBot] = useState<AssistantFormBot | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBot = async () => {
            try {
                const data = await api.getBot(id);
                setBot(data);
            } catch (error) {
                console.error("Failed to fetch bot:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchBot();
    }, [id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!bot) {
        return (
            <div className="text-center py-16">
                <p className="text-muted-foreground">Assistant not found</p>
            </div>
        );
    }

    return <AssistantForm mode="edit" initialBot={bot} />;
}

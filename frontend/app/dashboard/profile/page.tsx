"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";

type BotApiKeyRecord = {
    id: string;
    name: string;
    botName: string;
    widgetApiKey: string;
    updatedAt: string;
};

export default function ProfilePage() {
    const [records, setRecords] = useState<BotApiKeyRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
    const [copiedValue, setCopiedValue] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                setRecords(await api.getBotApiKeys());
            } catch (error) {
                console.error("Failed to load profile data:", error);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, []);

    const getEmbedCode = (record: BotApiKeyRecord) => {
        const apiUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        return `<script src="${apiUrl}/api/widget/widget.js" data-bot="${record.botName}" data-api-key="${record.widgetApiKey}"></script>`;
    };

    const copyText = async (key: string, value: string) => {
        await navigator.clipboard.writeText(value);
        setCopiedValue(key);
        setTimeout(() => setCopiedValue(null), 2000);
    };

    const regenerate = async (record: BotApiKeyRecord) => {
        setRegeneratingId(record.id);
        try {
            const updated = await api.regenerateBotApiKey(record.id);
            setRecords((prev) =>
                prev.map((item) =>
                    item.id === record.id
                        ? {
                            ...item,
                            widgetApiKey: updated.widgetApiKey,
                            updatedAt: updated.updatedAt,
                        }
                        : item
                )
            );
        } catch (error) {
            console.error("Failed to regenerate API key:", error);
        } finally {
            setRegeneratingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin text-black/60 dark:text-white/60" />
            </div>
        );
    }

    return (
        <div className="space-y-7">
            <div className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-[0_20px_60px_-38px_rgba(0,0,0,0.5)] dark:border-white/15 dark:bg-white/5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/55 dark:text-white/55">
                    Dashboard
                </p>
                <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
                <p className="text-black/60 dark:text-white/65 mt-1">
                    Manage widget API keys for your assistants.
                </p>
            </div>

            {records.length === 0 ? (
                <Card className="border-dashed border-black/20 bg-white/70 dark:border-white/20 dark:bg-white/5">
                    <CardHeader>
                        <CardTitle>No assistants yet</CardTitle>
                        <CardDescription>
                            Create an assistant first to get an API key-enabled widget embed script.
                        </CardDescription>
                    </CardHeader>
                </Card>
            ) : (
                <div className="space-y-4">
                    {records.map((record) => (
                        <Card key={record.id} className="rounded-3xl border-black/10 bg-white/85 dark:border-white/15 dark:bg-white/5">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <CardTitle className="text-lg">{record.name}</CardTitle>
                                        <CardDescription className="text-black/55 dark:text-white/55">@{record.botName}</CardDescription>
                                    </div>
                                    <Badge variant="secondary" className="rounded-full border border-black/10 bg-black/5 text-black dark:border-white/15 dark:bg-white/10 dark:text-white">Widget API Key</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-black/55 dark:text-white/55">Current API Key</p>
                                    <div className="flex gap-2">
                                        <Input readOnly value={record.widgetApiKey} className="bg-white/70 dark:bg-white/5 border-black/15 dark:border-white/20" />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => copyText(`key:${record.id}`, record.widgetApiKey)}
                                        >
                                            {copiedValue === `key:${record.id}` ? (
                                                <Check className="h-4 w-4" />
                                            ) : (
                                                <Copy className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-black/55 dark:text-white/55">Embed Script</p>
                                    <div className="relative">
                                        <pre className="p-3 pr-12 bg-black/[0.04] dark:bg-white/[0.07] rounded-md overflow-x-auto text-xs text-black/70 dark:text-white/75 whitespace-pre-wrap break-all">
                                            <code>{getEmbedCode(record)}</code>
                                        </pre>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="icon"
                                            className="absolute top-2 right-2 h-7 w-7"
                                            onClick={() => copyText(`embed:${record.id}`, getEmbedCode(record))}
                                        >
                                            {copiedValue === `embed:${record.id}` ? (
                                                <Check className="h-4 w-4" />
                                            ) : (
                                                <Copy className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                <div className="pt-1">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="gap-2 rounded-full border-black/15 bg-white/80 dark:border-white/20 dark:bg-white/5"
                                        onClick={() => regenerate(record)}
                                        disabled={regeneratingId === record.id}
                                    >
                                        {regeneratingId === record.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <RefreshCw className="h-4 w-4" />
                                        )}
                                        Regenerate API Key
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

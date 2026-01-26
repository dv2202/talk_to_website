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

type GovernXOneProfile = {
    projectId: string | null;
    endpoint: string | null;
    hasApiKey: boolean;
    apiKey: string | null;
};

export default function ProfilePage() {
    const [records, setRecords] = useState<BotApiKeyRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
    const [copiedValue, setCopiedValue] = useState<string | null>(null);

    const [governxoneProfile, setGovernxoneProfile] = useState<GovernXOneProfile | null>(null);
    const [governxoneApiKey, setGovernxoneApiKey] = useState("");
    const [governxoneProjectId, setGovernxoneProjectId] = useState("");
    const [governxoneEndpoint, setGovernxoneEndpoint] = useState("");
    const [governxoneLoading, setGovernxoneLoading] = useState(true);
    const [governxoneSaving, setGovernxoneSaving] = useState(false);
    const [governxoneClearing, setGovernxoneClearing] = useState(false);
    const [governxoneMessage, setGovernxoneMessage] = useState<string | null>(null);
    const [governxoneError, setGovernxoneError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const [apiKeys, governxone] = await Promise.all([
                    api.getBotApiKeys(),
                    api.getGovernXOneCredentials(),
                ]);
                setRecords(apiKeys);
                setGovernxoneProfile(governxone);
                setGovernxoneProjectId(governxone.projectId || "");
                setGovernxoneEndpoint(governxone.endpoint || "");
            } catch (error) {
                console.error("Failed to load profile data:", error);
            } finally {
                setLoading(false);
                setGovernxoneLoading(false);
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

    const saveGovernxone = async () => {
        setGovernxoneSaving(true);
        setGovernxoneMessage(null);
        setGovernxoneError(null);
        try {
            const updated = await api.saveGovernXOneCredentials({
                apiKey: governxoneApiKey || undefined,
                projectId: governxoneProjectId,
                endpoint: governxoneEndpoint,
            });
            setGovernxoneProfile(updated);
            setGovernxoneProjectId(updated.projectId || "");
            setGovernxoneEndpoint(updated.endpoint || "");
            setGovernxoneApiKey("");
            setGovernxoneMessage("GovernXOne credentials saved.");
        } catch (error: any) {
            setGovernxoneError(error?.message || "Failed to save GovernXOne credentials.");
        } finally {
            setGovernxoneSaving(false);
        }
    };

    const clearGovernxone = async () => {
        setGovernxoneClearing(true);
        setGovernxoneMessage(null);
        setGovernxoneError(null);
        try {
            const updated = await api.saveGovernXOneCredentials({ clear: true });
            setGovernxoneProfile(updated);
            setGovernxoneProjectId("");
            setGovernxoneEndpoint("");
            setGovernxoneApiKey("");
            setGovernxoneMessage("GovernXOne credentials removed.");
        } catch (error: any) {
            setGovernxoneError(error?.message || "Failed to clear GovernXOne credentials.");
        } finally {
            setGovernxoneClearing(false);
        }
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

            {/* Card for GovernXOne */}
            {/* <Card className="rounded-3xl border-black/10 bg-white/85 dark:border-white/15 dark:bg-white/5">
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <CardTitle className="text-lg">GovernXOne Monitoring</CardTitle>
                            <CardDescription className="text-black/55 dark:text-white/55">
                                Save your GovernXOne API key, project ID, and endpoint to monitor AI usage for all assistants on this account. If not set, the server falls back to shared env credentials.
                            </CardDescription>
                        </div>
                        <Badge variant="secondary" className="rounded-full border border-black/10 bg-black/5 text-black dark:border-white/15 dark:bg-white/10 dark:text-white">
                            GovernXOne
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {governxoneLoading ? (
                        <div className="flex items-center gap-2 text-sm text-black/55 dark:text-white/55">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading credentials...
                        </div>
                    ) : (
                        <>
                            {governxoneProfile?.hasApiKey && governxoneProfile.apiKey && (
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-black/55 dark:text-white/55">Saved API Key</p>
                                    <p className="text-sm font-mono text-black/70 dark:text-white/75">{governxoneProfile.apiKey}</p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <p className="text-xs font-medium text-black/55 dark:text-white/55">API Key</p>
                                <Input
                                    type="password"
                                    value={governxoneApiKey}
                                    onChange={(e) => setGovernxoneApiKey(e.target.value)}
                                    placeholder={governxoneProfile?.hasApiKey ? "Leave blank to keep current key" : "Enter GovernXOne API key"}
                                    className="bg-white/70 dark:bg-white/5 border-black/15 dark:border-white/20"
                                />
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs font-medium text-black/55 dark:text-white/55">Project ID</p>
                                <Input
                                    value={governxoneProjectId}
                                    onChange={(e) => setGovernxoneProjectId(e.target.value)}
                                    placeholder="Enter GovernXOne project ID"
                                    className="bg-white/70 dark:bg-white/5 border-black/15 dark:border-white/20"
                                />
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs font-medium text-black/55 dark:text-white/55">Endpoint</p>
                                <Input
                                    value={governxoneEndpoint}
                                    onChange={(e) => setGovernxoneEndpoint(e.target.value)}
                                    placeholder="https://dev.governxone.com"
                                    className="bg-white/70 dark:bg-white/5 border-black/15 dark:border-white/20"
                                />
                            </div>

                            {governxoneMessage && (
                                <p className="text-sm text-emerald-700 dark:text-emerald-300">{governxoneMessage}</p>
                            )}
                            {governxoneError && (
                                <p className="text-sm text-red-600 dark:text-red-300">{governxoneError}</p>
                            )}

                            <div className="flex flex-wrap gap-2 pt-1">
                                <Button
                                    type="button"
                                    className="rounded-full"
                                    onClick={saveGovernxone}
                                    disabled={governxoneSaving || governxoneClearing}
                                >
                                    {governxoneSaving ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            Saving...
                                        </>
                                    ) : (
                                        "Save Credentials"
                                    )}
                                </Button>
                                {(governxoneProfile?.hasApiKey || governxoneProfile?.projectId || governxoneProfile?.endpoint) && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="rounded-full border-black/15 bg-white/80 dark:border-white/20 dark:bg-white/5"
                                        onClick={clearGovernxone}
                                        disabled={governxoneSaving || governxoneClearing}
                                    >
                                        {governxoneClearing ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                Clearing...
                                            </>
                                        ) : (
                                            "Clear Credentials"
                                        )}
                                    </Button>
                                )}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card> */}

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

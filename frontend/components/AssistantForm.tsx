"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { DEFAULT_BOT_LANGUAGE } from "@/lib/languages";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    normalizeFallbackContacts,
    parseBotFallbackContacts,
    type FallbackContactEntry,
} from "@/lib/fallback-contact";
import { ChatWidgetPreview } from "@/components/ChatWidgetPreview";
import { IdentityTab } from "@/components/create/IdentityTab";
import { AppearanceTab } from "@/components/create/AppearanceTab";
import {
    KnowledgeTab,
    type KnowledgeSource,
} from "@/components/create/KnowledgeTab";
import { SettingsTab } from "@/components/create/SettingsTab";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
    ArrowLeft,
    ArrowRight,
    BookOpen,
    Check,
    Loader2,
    Palette,
    Settings,
    User,
} from "lucide-react";

type TabId = "identity" | "appearance" | "knowledge" | "settings";

const TABS: { id: TabId; label: string; icon: typeof User }[] = [
    { id: "identity", label: "Identity", icon: User },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "knowledge", label: "Knowledge", icon: BookOpen },
    { id: "settings", label: "Settings", icon: Settings },
];

export interface AssistantFormBot {
    id: string;
    name: string;
    botName: string;
    description: string | null;
    systemPrompt: string;
    defaultLanguage: string;
    mode: string;
    widgetPosition: string;
    allowedOrigin: string | null;
    logo: string | null;
    themeColor: string | null;
    logoBgColor?: string | null;
    widgetLogo?: string | null;
    widgetLogoBgColor?: string | null;
    welcomeTitle: string | null;
    welcomeSubtitle: string | null;
    quickQuestions: string | null;
    teaserMessage: string | null;
    teaserDelay: number | null;
    fallbackContacts?: unknown;
    humanChatEnabled?: boolean;
    knowledgeSources?: Array<{
        id: string;
        type: string;
        name: string | null;
        content?: string | null;
    }>;
}

interface AssistantFormProps {
    mode: "create" | "edit";
    initialBot?: AssistantFormBot;
}

export function AssistantForm({ mode, initialBot }: AssistantFormProps) {
    const isEdit = mode === "edit";
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabId>("identity");
    const [loading, setLoading] = useState(false);
    const [creatingBot, setCreatingBot] = useState(false);
    const [knowledgeGateError, setKnowledgeGateError] = useState<string | null>(
        null
    );

    // Identity
    const [name, setName] = useState("");
    const [botName, setBotName] = useState("");
    const [botNameStatus, setBotNameStatus] = useState<
        "idle" | "checking" | "available" | "taken"
    >("idle");
    const [description, setDescription] = useState("");
    const [systemPrompt, setSystemPrompt] = useState(
        "Answer users politely and help them understand our services."
    );
    const [defaultLanguage, setDefaultLanguage] = useState(DEFAULT_BOT_LANGUAGE);
    const [fallbackContacts, setFallbackContacts] = useState<
        FallbackContactEntry[]
    >([]);
    const [fallbackContactError, setFallbackContactError] = useState<
        string | null
    >(null);

    // Appearance
    const [logo, setLogo] = useState<string | null>(null);
    const [persistedLogo, setPersistedLogo] = useState<string | null>(null);
    const [themeColor, setThemeColor] = useState("#2563eb");
    const [logoBgColor, setLogoBgColor] = useState("#ffffff");
    const [widgetLogo, setWidgetLogo] = useState<string | null>(null);
    const [persistedWidgetLogo, setPersistedWidgetLogo] = useState<string | null>(null);
    const [widgetLogoBgColor, setWidgetLogoBgColor] = useState("#2678FF");
    const [welcomeTitle, setWelcomeTitle] = useState("");
    const [welcomeSubtitle, setWelcomeSubtitle] = useState("");
    const [quickQuestions, setQuickQuestions] = useState(
        "What do you do?,How can you help me?,Tell me more"
    );
    const [teaserMessage, setTeaserMessage] = useState("");
    const [teaserDelay, setTeaserDelay] = useState(5);

    // Settings
    const [widgetPosition, setWidgetPosition] = useState("BOTTOM_RIGHT");
    const [allowedOrigin, setAllowedOrigin] = useState("");
    const [humanChatEnabled, setHumanChatEnabled] = useState(false);

    // Knowledge
    const [createdBotId, setCreatedBotId] = useState<string | null>(null);
    const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>(
        []
    );
    const [uploading, setUploading] = useState(false);

    // Populate from an existing bot in edit mode
    useEffect(() => {
        if (!isEdit || !initialBot) return;
        const bot = initialBot;
        setName(bot.name);
        setBotName(bot.botName);
        setBotNameStatus("idle");
        setDescription(bot.description || "");
        setSystemPrompt(bot.systemPrompt);
        setDefaultLanguage(bot.defaultLanguage || DEFAULT_BOT_LANGUAGE);
        setWidgetPosition(bot.widgetPosition);
        setAllowedOrigin(bot.allowedOrigin || "");
        setHumanChatEnabled(Boolean(bot.humanChatEnabled));
        setLogo(bot.logo || null);
        setPersistedLogo(bot.logo || null);
        setThemeColor(bot.themeColor || "#2563eb");
        setLogoBgColor(bot.logoBgColor || "#ffffff");
        setWidgetLogo(bot.widgetLogo || null);
        setPersistedWidgetLogo(bot.widgetLogo || null);
        // Old default was #ffffff which makes the shared SVG look blank — normalize to shared blue
        {
            const raw = bot.widgetLogoBgColor || "#2678FF";
            const normalized = raw.trim().toLowerCase();
            setWidgetLogoBgColor(
                !bot.widgetLogo && (normalized === "#fff" || normalized === "#ffffff")
                    ? "#2678FF"
                    : raw
            );
        }
        setWelcomeTitle(bot.welcomeTitle || "");
        setWelcomeSubtitle(bot.welcomeSubtitle || "");
        setQuickQuestions(
            bot.quickQuestions ||
                "What do you do?,How can you help me?,Tell me more"
        );
        setTeaserMessage(bot.teaserMessage || "");
        setTeaserDelay(bot.teaserDelay ?? 5);
        setFallbackContacts(parseBotFallbackContacts(bot));
        setFallbackContactError(null);
        setCreatedBotId(bot.id);
        setKnowledgeSources(
            (bot.knowledgeSources ?? []).map((s) => ({
                id: s.id,
                type: s.type,
                name: s.name || "Unnamed",
                content: s.content ?? undefined,
            }))
        );
    }, [isEdit, initialBot]);

    // Check bot name availability with debounce
    const checkBotName = useCallback(
        async (value: string) => {
            const originalSlug = isEdit ? initialBot?.botName : undefined;
            if (value === originalSlug || value.length < 3) {
                setBotNameStatus("idle");
                return;
            }
            setBotNameStatus("checking");
            try {
                const result = await api.checkBotName(
                    value,
                    isEdit ? initialBot?.id : undefined
                );
                setBotNameStatus(result.available ? "available" : "taken");
            } catch {
                setBotNameStatus("idle");
            }
        },
        [isEdit, initialBot]
    );

    useEffect(() => {
        const timer = setTimeout(() => {
            if (botName.length >= 3) {
                checkBotName(botName);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [botName, checkBotName]);

    const slugValid = botName.trim().length >= 3;
    const slugTaken = botNameStatus === "taken";
    const slugChecking = botNameStatus === "checking";
    const identityComplete = Boolean(
        name.trim() &&
            slugValid &&
            (isEdit ? !slugTaken : botNameStatus === "available")
    );

    const buildBotPayload = () => {
        const normalized = normalizeFallbackContacts(fallbackContacts);
        return {
            name,
            botName: botName.toLowerCase(),
            description,
            systemPrompt,
            defaultLanguage,
            mode: "CHAT",
            widgetPosition,
            allowedOrigin: allowedOrigin || null,
            logo,
            themeColor,
            logoBgColor,
            widgetLogo,
            widgetLogoBgColor,
            welcomeTitle,
            welcomeSubtitle,
            quickQuestions,
            teaserMessage,
            teaserDelay,
            fallbackContacts: normalized.error ? [] : normalized.contacts,
            humanChatEnabled,
        };
    };

    const ensureBotCreated = async (): Promise<string | null> => {
        if (createdBotId) return createdBotId;

        if (!identityComplete) {
            setKnowledgeGateError(
                "Fill in the required Identity fields first (Assistant Name and an available Bot Name)."
            );
            return null;
        }

        const normalized = normalizeFallbackContacts(fallbackContacts);
        if (normalized.error) {
            setFallbackContactError(normalized.error);
            setKnowledgeGateError(normalized.error);
            setActiveTab("identity");
            return null;
        }

        setCreatingBot(true);
        try {
            const bot = await api.createBot(buildBotPayload());
            setCreatedBotId(bot.id);
            setPersistedLogo(bot.logo || null);
            setKnowledgeGateError(null);
            return bot.id;
        } catch (error) {
            console.error("Failed to create bot:", error);
            setKnowledgeGateError(
                error instanceof Error
                    ? error.message
                    : "Failed to create your assistant."
            );
            return null;
        } finally {
            setCreatingBot(false);
        }
    };

    const goToTab = async (tab: TabId) => {
        setActiveTab(tab);
        if (tab === "knowledge" && !isEdit) {
            await ensureBotCreated();
        }
    };

    const handleUploadFile = async (file: File) => {
        const botId = await ensureBotCreated();
        if (!botId) return;

        setUploading(true);
        try {
            const result = await api.uploadKnowledge(botId, file);
            setKnowledgeSources((prev) => [
                ...prev,
                {
                    id: result.id,
                    type: result.type,
                    name: result.name || file.name,
                },
            ]);
        } catch (error) {
            console.error("Upload failed:", error);
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteKnowledge = async (id: string) => {
        try {
            await api.deleteKnowledge(id);
            setKnowledgeSources((prev) => prev.filter((s) => s.id !== id));
        } catch (error) {
            console.error("Delete failed:", error);
        }
    };

    const handleDeleteAllKnowledge = async () => {
        if (!createdBotId) return;
        await api.deleteAllKnowledge(createdBotId);
        setKnowledgeSources([]);
    };

    const handleSave = async () => {
        const normalized = normalizeFallbackContacts(fallbackContacts);
        if (normalized.error) {
            setFallbackContactError(normalized.error);
            setActiveTab("identity");
            return;
        }
        setFallbackContactError(null);
        setLoading(true);
        try {
            const payload = buildBotPayload();
            if (createdBotId) {
                await api.updateBot(createdBotId, payload);
            } else {
                await api.createBot(payload);
            }
            if (isEdit) {
                toast.success("Assistant saved");
            } else {
                router.push("/dashboard");
            }
        } catch (error) {
            console.error("Failed to save assistant:", error);
            toast.error("Failed to save assistant");
        } finally {
            setLoading(false);
        }
    };

    const tabIndex = TABS.findIndex((t) => t.id === activeTab);
    const isFirstTab = tabIndex === 0;
    const isLastTab = tabIndex === TABS.length - 1;

    const canSave =
        !loading &&
        !creatingBot &&
        Boolean(
            name.trim() &&
                slugValid &&
                !slugTaken &&
                !slugChecking &&
                (isEdit || botNameStatus === "available")
        );

    const nextTab = async () => {
        if (isLastTab) return;
        await goToTab(TABS[tabIndex + 1].id);
    };

    const prevTab = () => {
        if (isFirstTab) return;
        goToTab(TABS[tabIndex - 1].id);
    };

    const nextDisabled =
        activeTab === "identity" &&
        (!identityComplete || slugChecking || slugTaken);

    return (
        <TooltipProvider delayDuration={100}>
        <div className="-mx-4 sm:-mx-6 lg:-mx-8 ">
            {/* Sticky header + tab bar — negative margins stay on the wrapper above, not here */}
            <div className="sticky top-0 z-30 px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 pb-2 bg-[#f7f7f3] dark:bg-[#0e0f11] border-b border-black/5 dark:border-white/5">
                <div className="max-w-[1400px] mx-auto">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.back()}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">
                                {isEdit
                                    ? "Edit Assistant"
                                    : "Create AI Assistant"}
                            </h1>
                            <p className="text-muted-foreground text-sm">
                                {isEdit
                                    ? "Update your assistant settings"
                                    : "Set up your assistant section by section, then create it when you're ready."}
                            </p>
                        </div>
                    </div>

                    {/* Tab bar */}
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-xl border bg-muted/40 p-1">
                        {TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            const isDone =
                                tab.id === "identity" && identityComplete;
                            const sourceCount =
                                tab.id === "knowledge"
                                    ? knowledgeSources.length
                                    : 0;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => goToTab(tab.id)}
                                    className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                                        isActive
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    <Icon className="h-4 w-4 shrink-0" />
                                    <span className="hidden sm:inline">
                                        {tab.label}
                                    </span>
                                    {isDone && (
                                        <Check className="h-3.5 w-3.5 text-green-500" />
                                    )}
                                    {sourceCount > 0 && (
                                        <span className="inline-flex items-center justify-center rounded-full bg-primary px-1.5 min-w-5 h-5 text-[11px] font-semibold text-primary-foreground">
                                            {sourceCount}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
                {/* items-stretch so the preview column matches form height — required for sticky to work */}
                <div className="flex items-stretch gap-6 lg:gap-8">
                {/* Form column: 75% */}
                <div className="w-full lg:w-[70%] min-w-0 space-y-6">
                {/* Tab content */}
            {activeTab === "identity" && (
                <Card>
                    <CardHeader>
                        <CardTitle>Identity</CardTitle>
                        <CardDescription>
                            Name your assistant and set its personality and
                            language.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <IdentityTab
                            name={name}
                            onNameChange={setName}
                            botName={botName}
                            onBotNameChange={setBotName}
                            botNameStatus={botNameStatus}
                            botNameHint={
                                isEdit
                                    ? `Public page: /bot/${botName || initialBot?.botName}`
                                    : undefined
                            }
                            description={description}
                            onDescriptionChange={setDescription}
                            systemPrompt={systemPrompt}
                            onSystemPromptChange={setSystemPrompt}
                            defaultLanguage={defaultLanguage}
                            onDefaultLanguageChange={setDefaultLanguage}
                            fallbackContacts={fallbackContacts}
                            fallbackContactError={fallbackContactError}
                            onFallbackContactsChange={(contacts) => {
                                setFallbackContacts(contacts);
                                setFallbackContactError(null);
                            }}
                        />
                    </CardContent>
                </Card>
            )}

            {activeTab === "appearance" && (
                <Card>
                    <CardHeader>
                        <CardTitle>Appearance</CardTitle>
                        <CardDescription>
                            Style the chat widget so it matches your brand. See
                            the live preview on the right.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <AppearanceTab
                            name={name}
                            themeColor={themeColor}
                            onThemeColorChange={setThemeColor}
                            logoBgColor={logoBgColor}
                            onLogoBgColorChange={setLogoBgColor}
                            logo={logo}
                            onLogoChange={setLogo}
                            persistedLogo={persistedLogo}
                            widgetLogo={widgetLogo}
                            onWidgetLogoChange={setWidgetLogo}
                            widgetLogoBgColor={widgetLogoBgColor}
                            onWidgetLogoBgColorChange={setWidgetLogoBgColor}
                            persistedWidgetLogo={persistedWidgetLogo}
                            welcomeTitle={welcomeTitle}
                            onWelcomeTitleChange={setWelcomeTitle}
                            welcomeSubtitle={welcomeSubtitle}
                            onWelcomeSubtitleChange={setWelcomeSubtitle}
                            quickQuestions={quickQuestions}
                            onQuickQuestionsChange={setQuickQuestions}
                            teaserMessage={teaserMessage}
                            onTeaserMessageChange={setTeaserMessage}
                            teaserDelay={teaserDelay}
                            onTeaserDelayChange={setTeaserDelay}
                        />
                    </CardContent>
                </Card>
            )}

            {activeTab === "knowledge" && (
                <Card>
                    <CardHeader>
                        <CardTitle>Knowledge Base</CardTitle>
                        <CardDescription>
                            Train your AI with documents and website content so
                            it can answer accurately.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <KnowledgeTab
                            botId={createdBotId}
                            creatingBot={creatingBot}
                            gateError={knowledgeGateError}
                            sources={knowledgeSources}
                            uploading={uploading}
                            onSourcesChange={setKnowledgeSources}
                            onUploadFile={handleUploadFile}
                            onDeleteSource={handleDeleteKnowledge}
                            onDeleteAll={handleDeleteAllKnowledge}
                            onGoToIdentity={() => goToTab("identity")}
                        />
                    </CardContent>
                </Card>
            )}

            {activeTab === "settings" && (
                <Card>
                    <CardHeader>
                        <CardTitle>Settings</CardTitle>
                        <CardDescription>
                            Configure widget position and domain restrictions.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <SettingsTab
                            widgetPosition={widgetPosition}
                            onWidgetPositionChange={setWidgetPosition}
                            allowedOrigin={allowedOrigin}
                            onAllowedOriginChange={setAllowedOrigin}
                            humanChatEnabled={humanChatEnabled}
                            onHumanChatEnabledChange={setHumanChatEnabled}
                        />
                    </CardContent>
                </Card>
            )}

            {/* Footer navigation */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <Button
                    variant="outline"
                    onClick={prevTab}
                    disabled={isFirstTab || loading}
                    className="w-full sm:w-auto"
                >
                    Back
                </Button>

                {isLastTab ? (
                    <Button
                        onClick={handleSave}
                        disabled={!canSave}
                        className="gap-2 w-full sm:w-auto"
                    >
                        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isEdit ? "Save Changes" : "Create Assistant"}
                        <Check className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button
                        onClick={nextTab}
                        disabled={nextDisabled}
                        className="gap-2 w-full sm:w-auto"
                    >
                        Next
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {activeTab === "identity" && !identityComplete && (
                <p className="text-center text-xs text-muted-foreground">
                    Add an Assistant Name and a unique, available Bot Name to
                    continue.
                </p>
            )}

                </div>

                {/* Preview column — stretches with the form so sticky has room to pin in place */}
                <div className="hidden lg:block lg:w-[30%] min-w-0 shrink-0">
                    <div className="lg:sticky lg:top-[11rem] flex justify-center">
                        <div className="w-[380px] h-[520px] max-w-full shrink-0">
                            <ChatWidgetPreview
                                name={name}
                                logo={logo}
                                themeColor={themeColor}
                                logoBgColor={logoBgColor}
                                widgetLogo={widgetLogo}
                                widgetLogoBgColor={widgetLogoBgColor}
                                welcomeTitle={welcomeTitle}
                                welcomeSubtitle={welcomeSubtitle}
                                quickQuestions={quickQuestions}
                                teaserMessage={teaserMessage}
                                teaserDelay={teaserDelay}
                                knowledgeSourcesCount={knowledgeSources.length}
                                botId={createdBotId}
                                botName={botName}
                                widgetPosition={widgetPosition}
                                inline
                            />
                        </div>
                    </div>
                </div>
                </div>
            </div>
        </div>
        </TooltipProvider>
    );
}

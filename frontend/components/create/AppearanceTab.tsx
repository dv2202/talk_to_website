"use client";

import { useState } from "react";
import { Bot, Loader2, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FieldInfo } from "@/components/FieldInfo";
import { WidgetLauncherLogo } from "@/components/WidgetLauncherLogo";
import { api } from "@/lib/api";
import { isWidgetLogoBlobUrl } from "@/lib/widget-logo-blob";
import Image from "next/image";

const PRESET_COLORS = [
    { name: "Slate", hex: "#0f172a" },
    { name: "Blue", hex: "#2563eb" },
    { name: "Indigo", hex: "#4f46e5" },
    { name: "Emerald", hex: "#059669" },
    { name: "Violet", hex: "#7c3aed" },
    { name: "Rose", hex: "#e11d48" },
];

const PRESET_LOGO_BG_COLORS = [
    { name: "White", hex: "#ffffff" },
    { name: "Slate Light", hex: "#f1f5f9" },
    { name: "Dark Slate", hex: "#0f172a" },
    { name: "Launcher Blue", hex: "#2678FF" },
    { name: "Blue", hex: "#2563eb" },
    { name: "Indigo", hex: "#4f46e5" },
    { name: "Emerald", hex: "#059669" },
    { name: "Rose", hex: "#e11d48" },
];

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Expand #rgb → #rrggbb for the native color input. */
function toColorPickerValue(value: string): string {
    const match = value.match(HEX_COLOR_RE);
    if (!match) return "#2563eb";
    const hex = match[1];
    if (hex.length === 3) {
        return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
    }
    return `#${hex}`;
}

function normalizeHexInput(raw: string): string {
    const withoutHash = raw.replace(/^#/, "").replace(/[^0-9a-fA-F]/g, "");
    return `#${withoutHash.slice(0, 6)}`;
}

/** Best-effort cleanup for unsaved Vercel Blob uploads (never the persisted logo). */
function deleteOrphanBlobLogo(
    url: string | null | undefined,
    persistedLogo: string | null | undefined
) {
    if (!url || url === persistedLogo || !isWidgetLogoBlobUrl(url)) return;
    void api.deleteAvatar(url).catch((error) => {
        console.error("Failed to delete orphan logo blob:", error);
    });
}

interface AppearanceTabProps {
    name?: string;
    themeColor: string;
    onThemeColorChange: (value: string) => void;
    logoBgColor: string;
    onLogoBgColorChange: (value: string) => void;
    logo: string | null;
    onLogoChange: (value: string | null) => void;
    /** Logo URL currently saved on the bot (if any). Used to avoid deleting it before save. */
    persistedLogo?: string | null;
    // Widget launcher logo (separate from chat logo)
    widgetLogo: string | null;
    onWidgetLogoChange: (value: string | null) => void;
    widgetLogoBgColor: string;
    onWidgetLogoBgColorChange: (value: string) => void;
    persistedWidgetLogo?: string | null;
    welcomeTitle: string;
    onWelcomeTitleChange: (value: string) => void;
    welcomeSubtitle: string;
    onWelcomeSubtitleChange: (value: string) => void;
    quickQuestions: string;
    onQuickQuestionsChange: (value: string) => void;
    teaserMessage: string;
    onTeaserMessageChange: (value: string) => void;
    teaserDelay: number;
    onTeaserDelayChange: (value: number) => void;
}

export function AppearanceTab({
    name = "",
    themeColor,
    onThemeColorChange,
    logoBgColor,
    onLogoBgColorChange,
    logo,
    onLogoChange,
    persistedLogo = null,
    widgetLogo,
    onWidgetLogoChange,
    widgetLogoBgColor,
    onWidgetLogoBgColorChange,
    persistedWidgetLogo = null,
    welcomeTitle,
    onWelcomeTitleChange,
    welcomeSubtitle,
    onWelcomeSubtitleChange,
    quickQuestions,
    onQuickQuestionsChange,
    teaserMessage,
    onTeaserMessageChange,
    teaserDelay,
    onTeaserDelayChange,
}: AppearanceTabProps) {
    const [logoUploading, setLogoUploading] = useState(false);
    const [widgetLogoUploading, setWidgetLogoUploading] = useState(false);

    const handleRemoveLogo = () => {
        deleteOrphanBlobLogo(logo, persistedLogo);
        onLogoChange(null);
    };

    const handleRemoveWidgetLogo = () => {
        deleteOrphanBlobLogo(widgetLogo, persistedWidgetLogo);
        onWidgetLogoChange(null);
    };

    return (
        <div className="space-y-5">
            <div className="space-y-2.5">
                <Label className="inline-flex items-center gap-1">
                    Theme Color{" "}
                    <FieldInfo content="The accent color used for buttons, highlights and chat bubbles in the widget so it matches your brand. Pick a preset or enter a hex code like #2563eb." />
                </Label>
                <div className="flex flex-wrap items-center gap-3">
                    <input
                        type="color"
                        value={toColorPickerValue(themeColor)}
                        onChange={(e) => onThemeColorChange(e.target.value)}
                        className="w-10 h-10 rounded-md border border-border cursor-pointer bg-transparent"
                    />
                    <Input
                        type="text"
                        value={themeColor}
                        onChange={(e) =>
                            onThemeColorChange(normalizeHexInput(e.target.value))
                        }
                        placeholder="#2563eb"
                        spellCheck={false}
                        className="w-[7.5rem] font-mono text-sm h-10"
                        aria-label="Theme color hex code"
                    />
                    <div className="flex flex-wrap gap-2">
                        {PRESET_COLORS.map((color) => (
                            <button
                                key={color.hex}
                                type="button"
                                onClick={() => onThemeColorChange(color.hex)}
                                className="w-8 h-8 rounded-full border border-black/10 dark:border-white/10 relative transition-transform hover:scale-105 active:scale-95"
                                style={{ backgroundColor: color.hex }}
                                title={color.name}
                            >
                                {toColorPickerValue(themeColor).toLowerCase() ===
                                    color.hex.toLowerCase() && (
                                    <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-xs">
                                        ✓
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>


            {/* ── Chat Logo ── */}
            <div className="space-y-2">
                <Label className="inline-flex items-center gap-1">
                    Chat Logo (Header &amp; Bubbles){" "}
                    <FieldInfo content="The avatar shown in the chat header and message bubbles. Upload an image (max 2MB) or provide a direct image URL." />
                </Label>
                <div className="flex items-center gap-4">
                    <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                            <label
                                htmlFor="logo-file-upload"
                                className={`flex items-center justify-center gap-2 cursor-pointer rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors ${logoUploading ? "pointer-events-none opacity-60" : ""}`}
                            >
                                {logoUploading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Upload className="h-3.5 w-3.5" />
                                )}
                                {logoUploading ? "Uploading..." : "Upload image"}
                            </label>
                            <span className="text-[10px] text-muted-foreground">
                                Max 2MB
                            </span>
                            <Input
                                id="logo-file-upload"
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                className="hidden"
                                disabled={logoUploading}
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = "";
                                    if (!file) return;
                                    setLogoUploading(true);
                                    try {
                                        const previousLogo = logo;
                                        const blob = await api.uploadAvatar(file);
                                        deleteOrphanBlobLogo(previousLogo, persistedLogo);
                                        onLogoChange(blob.url);
                                    } catch (error) {
                                        console.error("Logo upload failed:", error);
                                        alert(
                                            error instanceof Error
                                                ? error.message
                                                : "Failed to upload logo"
                                        );
                                    } finally {
                                        setLogoUploading(false);
                                    }
                                }}
                            />
                            <span className="text-[10px] text-muted-foreground">
                                Or direct URL:
                            </span>
                        </div>
                        <Input
                            placeholder="https://example.com/logo.png"
                            value={logo || ""}
                            onChange={(e) => {
                                const next = e.target.value || null;
                                if (!next) {
                                    deleteOrphanBlobLogo(logo, persistedLogo);
                                }
                                onLogoChange(next);
                            }}
                            className="text-xs h-8"
                        />
                    </div>
                    {/* Chat Logo Preview */}
                    <div
                        className="relative w-14 h-14 rounded-full border border-border overflow-hidden shrink-0 flex items-center justify-center shadow-xs transition-colors"
                        style={{ backgroundColor: logoBgColor || "#ffffff" }}
                    >
                        {logo ? (
                            <>
                                <Image
                                    width={56}
                                    height={56}
                                    src={logo}
                                    alt="Chat Logo Preview"
                                    className="w-full h-full object-cover"
                                />
                                <button
                                    type="button"
                                    onClick={handleRemoveLogo}
                                    className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-medium"
                                >
                                    Remove
                                </button>
                            </>
                        ) : (
                            <div className="flex items-center justify-center w-full h-full text-slate-700 dark:text-slate-200 font-bold text-xl">
                                {name ? name.substring(0, 1).toUpperCase() : <Bot className="w-7 h-7" />}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Chat Logo Background Color ── */}
            <div className="space-y-2.5">
                <Label className="inline-flex items-center gap-1">
                    Chat Logo Background Color{" "}
                    <FieldInfo content="Background color for the chat logo in the header and message bubbles." />
                </Label>
                <div className="flex flex-wrap items-center gap-3">
                    <input
                        type="color"
                        value={toColorPickerValue(logoBgColor || "#ffffff")}
                        onChange={(e) => onLogoBgColorChange(e.target.value)}
                        className="w-10 h-10 rounded-md border border-border cursor-pointer bg-transparent"
                    />
                    <Input
                        type="text"
                        value={logoBgColor || "#ffffff"}
                        onChange={(e) =>
                            onLogoBgColorChange(normalizeHexInput(e.target.value))
                        }
                        placeholder="#ffffff"
                        spellCheck={false}
                        className="w-[7.5rem] font-mono text-sm h-10"
                        aria-label="Chat logo background color hex code"
                    />
                    <div className="flex flex-wrap gap-2">
                        {PRESET_LOGO_BG_COLORS.map((color) => (
                            <button
                                key={color.hex}
                                type="button"
                                onClick={() => onLogoBgColorChange(color.hex)}
                                className="w-8 h-8 rounded-full border border-black/10 dark:border-white/10 relative transition-transform hover:scale-105 active:scale-95 shadow-xs"
                                style={{ backgroundColor: color.hex }}
                                title={color.name}
                            >
                                {toColorPickerValue(logoBgColor || "#ffffff").toLowerCase() ===
                                    color.hex.toLowerCase() && (
                                    <span className={`absolute inset-0 flex items-center justify-center font-bold text-xs ${
                                        color.hex.toLowerCase() === "#ffffff" || color.hex.toLowerCase() === "#f1f5f9"
                                            ? "text-slate-900"
                                            : "text-white"
                                    }`}>
                                        ✓
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Widget Launcher Logo ── */}
            <div className="space-y-2">
                <Label className="inline-flex items-center gap-1">
                    Widget Launcher Logo{" "}
                    <FieldInfo content="Optional custom logo shown inside the widget launcher button. If not set, the shared chat-card SVG is used." />
                </Label>
                <div className="flex items-center gap-4">
                    <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                            <label
                                htmlFor="widget-logo-file-upload"
                                className={`flex items-center justify-center gap-2 cursor-pointer rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors ${widgetLogoUploading ? "pointer-events-none opacity-60" : ""}`}
                            >
                                {widgetLogoUploading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Upload className="h-3.5 w-3.5" />
                                )}
                                {widgetLogoUploading ? "Uploading..." : "Upload image"}
                            </label>
                            <span className="text-[10px] text-muted-foreground">
                                Max 2MB
                            </span>
                            <Input
                                id="widget-logo-file-upload"
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                className="hidden"
                                disabled={widgetLogoUploading}
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = "";
                                    if (!file) return;
                                    setWidgetLogoUploading(true);
                                    try {
                                        const previousLogo = widgetLogo;
                                        const blob = await api.uploadAvatar(file);
                                        deleteOrphanBlobLogo(previousLogo, persistedWidgetLogo);
                                        onWidgetLogoChange(blob.url);
                                    } catch (error) {
                                        console.error("Widget logo upload failed:", error);
                                        alert(
                                            error instanceof Error
                                                ? error.message
                                                : "Failed to upload widget logo"
                                        );
                                    } finally {
                                        setWidgetLogoUploading(false);
                                    }
                                }}
                            />
                            <span className="text-[10px] text-muted-foreground">
                                Or direct URL:
                            </span>
                        </div>
                        <Input
                            placeholder="https://example.com/widget-logo.png (optional)"
                            value={widgetLogo || ""}
                            onChange={(e) => {
                                const next = e.target.value || null;
                                if (!next) {
                                    deleteOrphanBlobLogo(widgetLogo, persistedWidgetLogo);
                                }
                                onWidgetLogoChange(next);
                            }}
                            className="text-xs h-8"
                        />
                    </div>
                    {/* Widget Logo Preview — dynamic SVG bubble + center logo */}
                    <div className="relative shrink-0">
                        <WidgetLauncherLogo
                            size={56}
                            bgColor={widgetLogoBgColor || "#2678FF"}
                            logoUrl={widgetLogo}
                        />
                        {widgetLogo ? (
                            <button
                                type="button"
                                onClick={handleRemoveWidgetLogo}
                                className="absolute inset-0 rounded-full bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-medium"
                            >
                                Remove
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* ── Widget Launcher Background Color ── */}
            <div className="space-y-2.5">
                <Label className="inline-flex items-center gap-1">
                    Widget Launcher Background Color{" "}
                    <FieldInfo content="Background color for the widget launcher button (the bubble in the bottom corner)." />
                </Label>
                <div className="flex flex-wrap items-center gap-3">
                    <input
                        type="color"
                        value={toColorPickerValue(widgetLogoBgColor || "#2678FF")}
                        onChange={(e) => onWidgetLogoBgColorChange(e.target.value)}
                        className="w-10 h-10 rounded-md border border-border cursor-pointer bg-transparent"
                    />
                    <Input
                        type="text"
                        value={widgetLogoBgColor || "#2678FF"}
                        onChange={(e) =>
                            onWidgetLogoBgColorChange(normalizeHexInput(e.target.value))
                        }
                        placeholder="#2678FF"
                        spellCheck={false}
                        className="w-[7.5rem] font-mono text-sm h-10"
                        aria-label="Widget launcher background color hex code"
                    />
                    <div className="flex flex-wrap gap-2">
                        {PRESET_LOGO_BG_COLORS.map((color) => (
                            <button
                                key={color.hex}
                                type="button"
                                onClick={() => onWidgetLogoBgColorChange(color.hex)}
                                className="w-8 h-8 rounded-full border border-black/10 dark:border-white/10 relative transition-transform hover:scale-105 active:scale-95 shadow-xs"
                                style={{ backgroundColor: color.hex }}
                                title={color.name}
                            >
                                {toColorPickerValue(widgetLogoBgColor || "#2678FF").toLowerCase() ===
                                    color.hex.toLowerCase() && (
                                    <span className={`absolute inset-0 flex items-center justify-center font-bold text-xs ${
                                        color.hex.toLowerCase() === "#ffffff" || color.hex.toLowerCase() === "#f1f5f9"
                                            ? "text-slate-900"
                                            : "text-white"
                                    }`}>
                                        ✓
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="welcome-title" className="inline-flex items-center gap-1">
                    Custom Greeting Title{" "}
                    <FieldInfo content="The bold headline shown at the top of the chat widget's home screen. Leave empty to use the default greeting." />
                </Label>
                <Input
                    id="welcome-title"
                    placeholder="e.g., Hi, I'm your agent 👋"
                    value={welcomeTitle}
                    onChange={(e) => onWelcomeTitleChange(e.target.value)}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="welcome-subtitle" className="inline-flex items-center gap-1">
                    Custom Greeting Subtitle{" "}
                    <FieldInfo content="The supporting text shown under the greeting title on the widget's home screen. Leave empty to use the default subtitle." />
                </Label>
                <Textarea
                    id="welcome-subtitle"
                    placeholder="e.g., I can answer anything about how we work..."
                    value={welcomeSubtitle}
                    onChange={(e) => onWelcomeSubtitleChange(e.target.value)}
                    rows={2}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="quick-questions" className="inline-flex items-center gap-1">
                    Suggested Questions (comma-separated){" "}
                    <FieldInfo content="Pre-written questions shown as clickable options on the widget's home screen. Visitors can tap one to start a conversation. Separate each question with a comma." />
                </Label>
                <Input
                    id="quick-questions"
                    placeholder="Question 1, Question 2, Question 3"
                    value={quickQuestions}
                    onChange={(e) => onQuickQuestionsChange(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                    Shown as clickable options in the widget home screen.
                </p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="teaser-message" className="inline-flex items-center gap-1">
                    Teaser Message (Pop-up bubble){" "}
                    <FieldInfo content="A small attention-grabbing bubble that pops up next to the widget launcher to invite visitors to chat. Leave empty to disable it." />
                </Label>
                <Input
                    id="teaser-message"
                    placeholder="e.g., Got a question? Just ask..."
                    value={teaserMessage}
                    onChange={(e) => onTeaserMessageChange(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                    A small bubble shown above the widget launcher to grab
                    attention. Leave empty to disable.
                </p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="teaser-delay" className="inline-flex items-center gap-1">
                    Teaser Delay (seconds){" "}
                    <FieldInfo content="How many seconds the widget waits after a visitor lands on your page before showing the teaser bubble (0–60 seconds)." />
                </Label>
                <Input
                    id="teaser-delay"
                    type="number"
                    min={0}
                    max={60}
                    value={teaserDelay}
                    onChange={(e) =>
                        onTeaserDelayChange(
                            Math.max(0, parseInt(e.target.value) || 0)
                        )
                    }
                />
                <p className="text-[10px] text-muted-foreground">
                    How many seconds to wait before showing the teaser bubble.
                </p>
            </div>
        </div>
    );
}

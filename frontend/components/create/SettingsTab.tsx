"use client";

import { Shield, Headset } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldInfo } from "@/components/FieldInfo";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface SettingsTabProps {
    widgetPosition: string;
    onWidgetPositionChange: (value: string) => void;
    allowedOrigin: string;
    onAllowedOriginChange: (value: string) => void;
    humanChatEnabled: boolean;
    onHumanChatEnabledChange: (value: boolean) => void;
}

export function SettingsTab({
    widgetPosition,
    onWidgetPositionChange,
    allowedOrigin,
    onAllowedOriginChange,
    humanChatEnabled,
    onHumanChatEnabledChange,
}: SettingsTabProps) {
    return (
        <div className="space-y-5">
            <div className="space-y-2">
                <Label className="inline-flex items-center gap-1">
                    Widget Position{" "}
                    <FieldInfo content="Where the chat widget launcher appears on your website: bottom-right, bottom-left or centered on the bottom edge." />
                </Label>
                <Select
                    value={widgetPosition}
                    onValueChange={onWidgetPositionChange}
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="BOTTOM_RIGHT">
                            Bottom Right
                        </SelectItem>
                        <SelectItem value="BOTTOM_LEFT">Bottom Left</SelectItem>
                        <SelectItem value="CENTER">Center</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5" />
                    Restrict to Website Origin{" "}
                    <FieldInfo content="If set, the widget will only load and work on this exact domain (e.g. https://example.com). Requests from other websites are rejected. Leave empty to allow any website." />
                </Label>
                <Input
                    placeholder="https://example.com"
                    value={allowedOrigin}
                    onChange={(e) => onAllowedOriginChange(e.target.value)}
                />
            </div>

            <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                    <Headset className="h-3.5 w-3.5" />
                    Human Live Chat{" "}
                    <FieldInfo content="Let visitors request a chat with a real person. You'll hear an alarm and get a notification anywhere in the dashboard (Pro plan). If no one joins within 30 seconds, visitors are shown your fallback contact options." />
                </Label>
                <button
                    type="button"
                    role="switch"
                    aria-checked={humanChatEnabled}
                    onClick={() => onHumanChatEnabledChange(!humanChatEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        humanChatEnabled ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
                    }`}
                >
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            humanChatEnabled ? "translate-x-6" : "translate-x-1"
                        }`}
                    />
                </button>
                <p className="text-xs text-muted-foreground">
                    {humanChatEnabled
                        ? "Visitors can request a live human chat on your widget."
                        : "Disabled — visitors only chat with the AI assistant."}
                </p>
            </div>
        </div>
    );
}

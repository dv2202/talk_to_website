"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { WORLD_LANGUAGES } from "@/lib/languages";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { FallbackContactPicker } from "@/components/FallbackContactPicker";
import { FieldInfo } from "@/components/FieldInfo";
import type { FallbackContactEntry } from "@/lib/fallback-contact";

type BotNameStatus = "idle" | "checking" | "available" | "taken";

interface IdentityTabProps {
    name: string;
    onNameChange: (value: string) => void;
    botName: string;
    onBotNameChange: (value: string) => void;
    botNameStatus: BotNameStatus;
    botNameHint?: string;
    description: string;
    onDescriptionChange: (value: string) => void;
    systemPrompt: string;
    onSystemPromptChange: (value: string) => void;
    defaultLanguage: string;
    onDefaultLanguageChange: (value: string) => void;
    fallbackContacts: FallbackContactEntry[];
    fallbackContactError: string | null;
    onFallbackContactsChange: (contacts: FallbackContactEntry[]) => void;
}

export function IdentityTab({
    name,
    onNameChange,
    botName,
    onBotNameChange,
    botNameStatus,
    botNameHint,
    description,
    onDescriptionChange,
    systemPrompt,
    onSystemPromptChange,
    defaultLanguage,
    onDefaultLanguageChange,
    fallbackContacts,
    fallbackContactError,
    onFallbackContactsChange,
}: IdentityTabProps) {
    const [languageQuery, setLanguageQuery] = useState("");
    const debouncedLanguageQuery = useDebouncedValue(languageQuery, 250);

    const filteredLanguages = useMemo(() => {
        const query = debouncedLanguageQuery.trim().toLowerCase();
        if (!query) {
            return WORLD_LANGUAGES;
        }

        return WORLD_LANGUAGES.filter(
            (language) =>
                language.name.toLowerCase().includes(query) ||
                language.code.toLowerCase().includes(query)
        );
    }, [debouncedLanguageQuery]);

    const languageOptions = useMemo(() => {
        const hasSelected = filteredLanguages.some(
            (language) => language.name === defaultLanguage
        );

        if (hasSelected || !defaultLanguage.trim()) {
            return filteredLanguages;
        }

        return [{ code: "custom", name: defaultLanguage }, ...filteredLanguages];
    }, [defaultLanguage, filteredLanguages]);

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="assistant-name">
                    Assistant Name <span className="text-destructive">*</span>{" "}
                    <FieldInfo content="The display name of your assistant shown to visitors in the chat widget and on its public page." />
                </Label>
                <Input
                    id="assistant-name"
                    placeholder="My Company Support"
                    value={name}
                    onChange={(e) => onNameChange(e.target.value)}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="bot-name">
                    Bot Name <span className="text-destructive">*</span>{" "}
                    <span className="text-muted-foreground font-normal">
                        (unique identifier)
                    </span>{" "}
                    <FieldInfo content="A unique lowercase identifier (letters, numbers and hyphens only) used in your assistant's public URL, e.g. /bot/mycompanybot. It must be unique and at least 3 characters." />
                </Label>
                <div className="relative">
                    <Input
                        id="bot-name"
                        placeholder="mycompanybot"
                        value={botName}
                        onChange={(e) =>
                            onBotNameChange(
                                e.target.value
                                    .toLowerCase()
                                    .replace(/[^a-z0-9-]/g, "")
                            )
                        }
                        className="pr-10"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {botNameStatus === "checking" && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        {botNameStatus === "available" && (
                            <Check className="h-4 w-4 text-green-500" />
                        )}
                        {botNameStatus === "taken" && (
                            <X className="h-4 w-4 text-destructive" />
                        )}
                    </div>
                </div>
                {botNameStatus === "taken" && (
                    <p className="text-xs text-destructive">
                        Bot name already taken. Please choose another.
                    </p>
                )}
                {botName && botName.length < 3 && (
                    <p className="text-xs text-destructive">
                        Bot name must be at least 3 characters.
                    </p>
                )}
                {botNameHint && botNameStatus !== "taken" && (
                    <p className="text-xs text-muted-foreground">{botNameHint}</p>
                )}
                {botNameStatus === "checking" && (
                    <p className="flex items-center text-xs text-muted-foreground">
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Checking
                        availability...
                    </p>
                )}
                {botNameStatus === "available" && (
                    <p className="flex items-center text-xs text-green-600">
                        <Check className="mr-1.5 h-3 w-3" /> Bot name is available!
                    </p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="description">
                    About Website / Business{" "}
                    <FieldInfo content="A brief description of your business or website. This helps the AI understand the context it is answering questions about." />
                </Label>
                <Textarea
                    id="description"
                    placeholder="A brief description of your business or website..."
                    value={description}
                    onChange={(e) => onDescriptionChange(e.target.value)}
                    rows={3}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="system-prompt">
                    System Prompt{" "}
                    <FieldInfo content="Instructions that define how the AI behaves, its tone, boundaries and how it should respond to users. This takes priority over the assistant's default behaviour." />
                </Label>
                <Textarea
                    id="system-prompt"
                    placeholder="Instructions for the AI assistant..."
                    value={systemPrompt}
                    onChange={(e) => onSystemPromptChange(e.target.value)}
                    rows={4}
                />
                <p className="text-xs text-muted-foreground">
                    This tells the AI how to behave and respond to users.
                </p>
            </div>

            <FallbackContactPicker
                contacts={fallbackContacts}
                error={fallbackContactError}
                onChange={onFallbackContactsChange}
            />

            <div className="space-y-2">
                <Label htmlFor="language-search">
                    Default Response Language{" "}
                    <FieldInfo content="The language the AI replies in by default. It can still switch to the visitor's language if they write in a different one." />
                </Label>
                <Input
                    id="language-search"
                    placeholder="Type to find a language (e.g. English, Hindi, Spanish)"
                    value={languageQuery}
                    onChange={(e) => setLanguageQuery(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            const customValue = languageQuery.trim();
                            if (customValue) {
                                e.preventDefault();
                                onDefaultLanguageChange(customValue);
                            }
                        }
                    }}
                />
                <Select
                    value={defaultLanguage}
                    onValueChange={onDefaultLanguageChange}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select a default language" />
                    </SelectTrigger>
                    <SelectContent>
                        {languageOptions.length > 0 ? (
                            languageOptions.map((language) => (
                                <SelectItem key={language.code} value={language.name}>
                                    {language.name} ({language.code})
                                </SelectItem>
                            ))
                        ) : (
                            <SelectItem value={defaultLanguage} disabled>
                                No language match found
                            </SelectItem>
                        )}
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                    AI defaults to this language, but can still answer in another
                    language when the user writes in it.
                </p>
            </div>
        </div>
    );
}

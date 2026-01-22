"use client";

import type { ComponentType } from "react";
import { Mail, MessageCircle, Phone, Send } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FieldInfo } from "@/components/FieldInfo";
import {
  FALLBACK_CONTACT_LABELS,
  FALLBACK_CONTACT_PLACEHOLDERS,
  FALLBACK_CONTACT_TYPES,
  type FallbackContactEntry,
  type FallbackContactTypeValue,
} from "@/lib/fallback-contact";

const TYPE_ICONS: Record<
  FallbackContactTypeValue,
  ComponentType<{ className?: string }>
> = {
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  TELEGRAM: Send,
  PHONE: Phone,
};

function valueLabel(type: FallbackContactTypeValue): string {
  if (type === "EMAIL") return "Email address";
  if (type === "TELEGRAM") return "Telegram username";
  if (type === "WHATSAPP") return "WhatsApp number";
  return "Phone number";
}

interface FallbackContactPickerProps {
  contacts: FallbackContactEntry[];
  onChange: (contacts: FallbackContactEntry[]) => void;
  error?: string | null;
}

export function FallbackContactPicker({
  contacts,
  onChange,
  error,
}: FallbackContactPickerProps) {
  const selected = new Map(contacts.map((c) => [c.type, c.value]));

  const toggleType = (type: FallbackContactTypeValue) => {
    if (selected.has(type)) {
      onChange(contacts.filter((c) => c.type !== type));
      return;
    }
    // Add with empty value — each type keeps its own independent value
    onChange([...contacts, { type, value: "" }]);
  };

  const setValue = (type: FallbackContactTypeValue, value: string) => {
    onChange(
      contacts.map((c) => (c.type === type ? { ...c, value } : c))
    );
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="inline-flex items-center gap-1">
          Contact options{" "}
          <FieldInfo content="Shown when the bot cannot answer from your knowledge base, or when a visitor asks to contact your team. Select one or more. Optional." />
        </Label>
        <p className="text-xs text-muted-foreground">
          Shown when the bot cannot answer from your knowledge base, or when a
          visitor asks to contact your team. Select one or more. Optional.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FALLBACK_CONTACT_TYPES.map((option) => {
          const Icon = TYPE_ICONS[option];
          const isSelected = selected.has(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggleType(option)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs transition-colors",
                isSelected
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-muted-foreground hover:border-foreground/40"
              )}
            >
              <Icon className="h-4 w-4" />
              {FALLBACK_CONTACT_LABELS[option]}
            </button>
          );
        })}
      </div>

      {contacts.length > 0 && (
        <div className="space-y-3">
          {contacts.map((contact) => (
            <div key={contact.type} className="space-y-2">
              <Label htmlFor={`fallback-contact-${contact.type}`}>
                {valueLabel(contact.type)}{" "}
                <FieldInfo content="The contact detail shown to visitors when the bot hands off to your team." />
              </Label>
              <Input
                id={`fallback-contact-${contact.type}`}
                placeholder={FALLBACK_CONTACT_PLACEHOLDERS[contact.type]}
                value={contact.value}
                onChange={(e) => setValue(contact.type, e.target.value)}
              />
            </div>
          ))}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}

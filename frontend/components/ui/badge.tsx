"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function Badge({
    className,
    variant = "default",
    ...props
}: React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "secondary" | "destructive" | "outline";
}) {
    const variantClasses = {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground border",
    };

    return (
        <div
            className={cn(
                "inline-flex items-center rounded-md border border-transparent px-2.5 py-0.5 text-xs font-semibold transition-colors",
                variantClasses[variant],
                className
            )}
            {...props}
        />
    );
}

export { Badge };

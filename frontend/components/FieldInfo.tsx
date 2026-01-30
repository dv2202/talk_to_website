import { Info } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface FieldInfoProps {
    content: string;
}

export function FieldInfo({ content }: FieldInfoProps) {
    return (
        <TooltipProvider delayDuration={100}>
            <Tooltip>
                <TooltipTrigger type="button" asChild>
                    <span className="inline-flex cursor-help items-center text-muted-foreground hover:text-foreground">
                        <Info className="h-3.5 w-3.5" />
                    </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-left font-normal normal-case">
                    {content}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

"use client";

import { useState } from "react";
import {
    AlertCircle,
    Eye,
    FileText,
    Globe,
    Loader2,
    Trash2,
    Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { UrlKnowledgeFlow } from "@/components/UrlKnowledgeFlow";
import { FieldInfo } from "@/components/FieldInfo";

export interface KnowledgeSource {
    id: string;
    type: string;
    name: string;
    content?: string;
}

interface KnowledgeTabProps {
    botId: string | null;
    creatingBot: boolean;
    gateError: string | null;
    sources: KnowledgeSource[];
    uploading: boolean;
    onSourcesChange: (sources: KnowledgeSource[]) => void;
    onUploadFile: (file: File) => void;
    onDeleteSource: (id: string) => void;
    onDeleteAll: () => Promise<void>;
    onGoToIdentity: () => void;
}

export function KnowledgeTab({
    botId,
    creatingBot,
    gateError,
    sources,
    uploading,
    onSourcesChange,
    onUploadFile,
    onDeleteSource,
    onDeleteAll,
    onGoToIdentity,
}: KnowledgeTabProps) {
    const [viewingContent, setViewingContent] = useState<{
        name: string;
        content: string;
    } | null>(null);
    const [showDeleteAll, setShowDeleteAll] = useState(false);
    const [deletingAll, setDeletingAll] = useState(false);

    const handleDeleteAllClick = async () => {
        setDeletingAll(true);
        try {
            await onDeleteAll();
            setShowDeleteAll(false);
        } catch {
            // Errors are logged by the page
        } finally {
            setDeletingAll(false);
        }
    };

    if (creatingBot) {
        return (
            <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Setting up your assistant...</span>
            </div>
        );
    }

    if (gateError || !botId) {
        return (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
                <AlertCircle className="h-8 w-8 text-destructive/70" />
                <div>
                    <p className="text-sm font-medium">
                        {gateError || "Your assistant isn't ready yet"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Fill in the Identity tab first so we can create your
                        assistant before adding knowledge.
                    </p>
                </div>
                <Button variant="outline" onClick={onGoToIdentity}>
                    Go to Identity
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <Label className="inline-flex items-center gap-1">
                    Upload Files{" "}
                    <FieldInfo content="Upload PDF or TXT files with your website's content, FAQs, policies or docs. The assistant will use these to answer questions accurately." />
                </Label>
                <div className="flex items-center gap-3">
                    <label
                        htmlFor="file-upload"
                        className={`flex items-center gap-2 cursor-pointer rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground hover:bg-muted/50 transition-colors flex-1 ${
                            uploading ? "pointer-events-none opacity-60" : ""
                        }`}
                    >
                        <Upload className="h-4 w-4" />
                        {uploading ? "Uploading..." : "Upload PDF or TXT file"}
                    </label>
                    <input
                        id="file-upload"
                        type="file"
                        accept=".pdf,.txt"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) onUploadFile(file);
                        }}
                        disabled={uploading}
                    />
                </div>
            </div>

            <Separator />

            {botId && (
                <UrlKnowledgeFlow
                    botId={botId}
                    onSaveComplete={(saved) => {
                        onSourcesChange([...sources, ...saved]);
                    }}
                />
            )}

            {sources.length > 0 && (
                <>
                    <Separator />
                    <div className="flex items-center justify-between">
                        <Label>Added Sources ({sources.length})</Label>
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive gap-1.5"
                            onClick={() => setShowDeleteAll(true)}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete All
                        </Button>
                    </div>
                    <div className="space-y-2">
                        {sources.map((source) => (
                            <div
                                key={source.id}
                                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    {source.type === "URL" ? (
                                        <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    ) : (
                                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    )}
                                    <span className="text-sm truncate">
                                        {source.name}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {source.content && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-blue-600"
                                            onClick={() =>
                                                setViewingContent({
                                                    name: source.name,
                                                    content: source.content!,
                                                })
                                            }
                                        >
                                            <Eye className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                        onClick={() => onDeleteSource(source.id)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            <Dialog open={showDeleteAll} onOpenChange={setShowDeleteAll}>
                <DialogContent className="rounded-3xl border-black/15 bg-[#faf9f5] dark:border-white/20 dark:bg-zinc-950">
                    <DialogHeader>
                        <DialogTitle>Delete All Knowledge Sources</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete all {sources.length}{" "}
                            knowledge source
                            {sources.length !== 1 ? "s" : ""}? This will also
                            remove all embedded chunks. This action cannot be
                            undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowDeleteAll(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteAllClick}
                            disabled={deletingAll}
                        >
                            {deletingAll && (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            )}
                            Delete All
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!viewingContent}
                onOpenChange={(open) => !open && setViewingContent(null)}
            >
                <DialogContent className="rounded-3xl border-black/15 bg-[#faf9f5] dark:border-white/20 dark:bg-zinc-950 max-h-[80vh]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Scraped Content
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            {viewingContent?.name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="overflow-y-auto max-h-[55vh] pr-2">
                        <pre className="whitespace-pre-wrap text-sm text-black/70 dark:text-white/75 leading-relaxed">
                            {viewingContent?.content || "No content available."}
                        </pre>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setViewingContent(null)}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

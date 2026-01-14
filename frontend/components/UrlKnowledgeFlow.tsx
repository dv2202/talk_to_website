"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { FieldInfo } from "@/components/FieldInfo";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Check, Globe, Loader2, Plus, Trash2, X, ChevronDown, ChevronRight, FileText } from "lucide-react";

type Step = "idle" | "discovering" | "edit-urls" | "scraping" | "review" | "done";

interface ScrapedResult {
    url: string;
    title: string;
    content: string;
}

interface UrlKnowledgeFlowProps {
    botId: string | null;
    onSaveComplete?: (sources: { id: string; type: string; name: string; content: string }[]) => void;
}

export function UrlKnowledgeFlow({ botId, onSaveComplete }: UrlKnowledgeFlowProps) {
    const [step, setStep] = useState<Step>("idle");
    const [homepageUrl, setHomepageUrl] = useState("");
    const [discoveredUrls, setDiscoveredUrls] = useState<string[]>([]);
    const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
    const [manualUrl, setManualUrl] = useState("");
    const [scrapedResults, setScrapedResults] = useState<ScrapedResult[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [expandedUrl, setExpandedUrl] = useState<string | null>(null);
    const [viewingContent, setViewingContent] = useState<{ url: string; title: string; content: string } | null>(null);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [isSaving, setIsSaving] = useState(false);

    const isIdle = step === "idle";
    const isDiscovering = step === "discovering";
    const isEditing = step === "edit-urls";
    const isScraping = step === "scraping";
    const isReview = step === "review";
    const isDone = step === "done";

    const handleDiscover = async () => {
        if (!homepageUrl) return;
        setError(null);
        setStep("discovering");
        try {
            const result = await api.discoverUrls(homepageUrl);
            const urls: string[] = result.urls || [];
            setDiscoveredUrls(urls);
            setSelectedUrls(new Set(urls));
            setStep("edit-urls");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to discover URLs");
            setStep("idle");
        }
    };

    const toggleUrl = (url: string) => {
        setSelectedUrls((prev) => {
            const next = new Set(prev);
            if (next.has(url)) next.delete(url);
            else next.add(url);
            return next;
        });
    };

    const removeUrl = (url: string) => {
        setDiscoveredUrls((prev) => prev.filter((u) => u !== url));
        setSelectedUrls((prev) => {
            const next = new Set(prev);
            next.delete(url);
            return next;
        });
    };

    const addManualUrl = () => {
        const trimmed = manualUrl.trim();
        if (!trimmed) return;
        try {
            new URL(trimmed);
        } catch {
            setError("Invalid URL. Make sure it starts with http:// or https://");
            return;
        }
        if (!discoveredUrls.includes(trimmed)) {
            setDiscoveredUrls((prev) => [...prev, trimmed]);
        }
        setSelectedUrls((prev) => new Set(prev).add(trimmed));
        setManualUrl("");
        setError(null);
    };

    const handleScrape = async () => {
        const urls = Array.from(selectedUrls);
        if (urls.length === 0) return;
        setError(null);
        setStep("scraping");
        setProgress({ current: 0, total: urls.length });

        // Scrape in batches of 5 to show progress
        const allResults: ScrapedResult[] = [];
        const batchSize = 5;
        for (let i = 0; i < urls.length; i += batchSize) {
            const batch = urls.slice(i, i + batchSize);
            setProgress({ current: i, total: urls.length });
            try {
                const result = await api.scrapeUrlContents(batch);
                allResults.push(...(result.results || []));
            } catch (err) {
                setError(`Scraping failed for some URLs: ${err instanceof Error ? err.message : "Unknown error"}`);
                // Continue with what we have
            }
        }

        setScrapedResults(allResults);
        setStep("review");
    };

    const handleSave = async () => {
        if (!botId || isSaving) return;
        setError(null);
        setIsSaving(true);
        try {
            const sources = scrapedResults.map((r) => ({
                name: r.url,
                content: r.content || "(No content extracted)",
            }));
            const result = await api.saveUrlKnowledgeBatch(botId, sources);
            const saved = (result.saved || []).map((s: { id: string; type: string; name: string; content: string }) => ({
                id: s.id,
                type: s.type,
                name: s.name,
                content: s.content,
            }));
            onSaveComplete?.(saved);
            setStep("done");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save knowledge sources");
        } finally {
            setIsSaving(false);
        }
    };

    const reset = () => {
        setStep("idle");
        setHomepageUrl("");
        setDiscoveredUrls([]);
        setSelectedUrls(new Set());
        setManualUrl("");
        setScrapedResults([]);
        setError(null);
        setExpandedUrl(null);
        setViewingContent(null);
        setProgress({ current: 0, total: 0 });
        setIsSaving(false);
    };

    return (
        <div className="space-y-4">
            {/* Error banner */}
            {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-sm text-destructive">
                    <X className="h-4 w-4 shrink-0 mt-0.5" />
                    <span className="flex-1">{error}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setError(null)}>
                        <X className="h-3 w-3" />
                    </Button>
                </div>
            )}

            {/* Step: IDLE / DISCOVERING — URL input */}
            {(isIdle || isDiscovering) && (
                <div className="space-y-3">
                    <Label className="inline-flex items-center gap-1">
                        Website URL{" "}
                        <FieldInfo content="Enter the homepage of your website. We'll find all URLs on it so you can pick which pages to add to the assistant's knowledge base." />
                    </Label>
                    <div className="flex gap-2">
                        <Input
                            placeholder="https://yourwebsite.com"
                            value={homepageUrl}
                            onChange={(e) => setHomepageUrl(e.target.value)}
                            className="flex-1"
                            disabled={isDiscovering}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleDiscover();
                            }}
                        />
                        <Button
                            onClick={handleDiscover}
                            disabled={!homepageUrl || isDiscovering || !botId}
                            className="gap-2"
                        >
                            {isDiscovering ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Globe className="h-4 w-4" />
                            )}
                            Discover
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        We&apos;ll find all URLs on this page so you can pick which ones to add.
                    </p>
                </div>
            )}

            {/* Step: EDIT URLS — review discovered URLs */}
            {isEditing && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label className="text-sm">
                            {selectedUrls.size} of {discoveredUrls.length} URLs selected
                        </Label>
                    </div>

                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {discoveredUrls.map((url) => {
                            const isSelected = selectedUrls.has(url);
                            return (
                                <div
                                    key={url}
                                    className={`flex items-center gap-2 p-2 rounded-md border text-sm transition-colors ${isSelected
                                            ? "border-primary/40 bg-primary/5"
                                            : "border-muted bg-muted/20"
                                        }`}
                                >
                                    <button
                                        onClick={() => toggleUrl(url)}
                                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${isSelected
                                                ? "bg-primary border-primary text-primary-foreground"
                                                : "border-muted-foreground/30"
                                            }`}
                                    >
                                        {isSelected && <Check className="h-3 w-3" />}
                                    </button>
                                    <span className={`truncate flex-1 ${!isSelected ? "text-muted-foreground line-through" : ""}`}>
                                        {url}
                                    </span>
                                    <button
                                        onClick={() => removeUrl(url)}
                                        className="text-muted-foreground hover:text-destructive shrink-0 p-0.5"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Add URL manually */}
                    <div className="flex gap-2">
                        <Input
                            placeholder="Add another URL manually..."
                            value={manualUrl}
                            onChange={(e) => setManualUrl(e.target.value)}
                            className="flex-1 text-sm"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") addManualUrl();
                            }}
                        />
                        <Button variant="outline" size="sm" onClick={addManualUrl} disabled={!manualUrl.trim()}>
                            <Plus className="h-3.5 w-3.5" />
                        </Button>
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={reset}>
                            Cancel
                        </Button>
                        <Button onClick={handleScrape} disabled={selectedUrls.size === 0} size="sm">
                            Continue with {selectedUrls.size} URL{selectedUrls.size !== 1 ? "s" : ""}
                        </Button>
                    </div>
                </div>
            )}

            {/* Step: SCRAPING — loading progress */}
            {isScraping && (
                <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/20">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <div className="space-y-0.5">
                        <p className="text-sm font-medium">Scraping content...</p>
                        <p className="text-xs text-muted-foreground">
                            {progress.current} of {progress.total} pages processed
                        </p>
                    </div>
                </div>
            )}

            {/* Step: REVIEW — show scraped content */}
            {isReview && (
                <div className="space-y-4">
                    <Label>Scraped Content ({scrapedResults.length} pages)</Label>

                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {scrapedResults.map((result) => {
                            const isExpanded = expandedUrl === result.url;
                            const snippet = result.content
                                ? result.content.slice(0, 300) + (result.content.length > 300 ? "..." : "")
                                : "(No content extracted)";

                            return (
                                <div key={result.url} className="rounded-lg border bg-muted/20 overflow-hidden">
                                    <button
                                        onClick={() => setExpandedUrl(isExpanded ? null : result.url)}
                                        className="w-full flex items-start gap-2 p-3 text-left hover:bg-muted/30 transition-colors"
                                    >
                                        {isExpanded ? (
                                            <ChevronDown className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">
                                                {result.title || "(No title)"}
                                            </p>
                                            <p className="text-xs text-muted-foreground truncate">{result.url}</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-blue-600"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setViewingContent(result);
                                            }}
                                        >
                                            <FileText className="h-3.5 w-3.5" />
                                        </Button>
                                    </button>
                                    {isExpanded && (
                                        <div className="px-3 pb-3 pt-0">
                                            <Separator className="mb-2" />
                                            <pre className="whitespace-pre-wrap text-xs text-muted-foreground leading-relaxed max-h-40 overflow-y-auto">
                                                {snippet}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Summary stats */}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>Total pages: {scrapedResults.length}</span>
                        <span>
                            Total content:{" "}
                            {scrapedResults.reduce((acc, r) => acc + (r.content?.length || 0), 0).toLocaleString()} chars
                        </span>
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={reset} disabled={isSaving}>
                            Start Over
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={scrapedResults.length === 0 || isSaving}
                            size="sm"
                            className="gap-2"
                        >
                            {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Check className="h-4 w-4" />
                            )}
                            Save to Knowledge Base
                        </Button>
                    </div>
                </div>
            )}

            {/* Step: DONE — success */}
            {isDone && (
                <div className="flex flex-col items-center gap-3 p-6 rounded-lg border border-green-500/30 bg-green-50/50 dark:bg-green-950/20">
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                        <Check className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-medium">Saved successfully!</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {scrapedResults.length} URL{scrapedResults.length !== 1 ? "s" : ""} added to knowledge base
                        </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={reset}>
                        Add More URLs
                    </Button>
                </div>
            )}

            {/* Full content viewer modal */}
            <Dialog open={!!viewingContent} onOpenChange={(open) => !open && setViewingContent(null)}>
                <DialogContent className="rounded-3xl border-black/15 bg-[#faf9f5] dark:border-white/20 dark:bg-zinc-950 max-h-[80vh]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <FileText className="h-4 w-4 shrink-0" />
                            <span className="truncate">{viewingContent?.title || "Content"}</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs break-all">
                            {viewingContent?.url}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="overflow-y-auto max-h-[55vh] pr-2">
                        <pre className="whitespace-pre-wrap text-sm text-black/70 dark:text-white/75 leading-relaxed">
                            {viewingContent?.content || "No content available."}
                        </pre>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setViewingContent(null)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

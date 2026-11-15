"use client";

import { useEffect, useRef } from "react";

export type KnowledgeStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED";

export type KnowledgeSourceEvent = {
    id: string;
    type: string;
    name: string | null;
    status: KnowledgeStatus;
    progress: number;
    error: string | null;
    pageCount: number | null;
    chunkCount: number | null;
};

export function isInFlight(status: string | undefined) {
    return status === "PENDING" || status === "PROCESSING";
}

/**
 * Subscribes to /api/knowledge/events (Server-Sent Events) while `active` is
 * true. The server pushes a `progress` event on every 10% step and closes with
 * `idle` once nothing is in flight. No client polling.
 */
export function useKnowledgeEvents(
    botId: string | null,
    active: boolean,
    onUpdate: (sources: KnowledgeSourceEvent[], replace: boolean) => void,
) {
    const onUpdateRef = useRef(onUpdate);
    useEffect(() => {
        onUpdateRef.current = onUpdate;
    }, [onUpdate]);

    useEffect(() => {
        if (!botId || !active || typeof EventSource === "undefined") return;

        const source = new EventSource(
            `/api/knowledge/events?botId=${encodeURIComponent(botId)}`,
            { withCredentials: true },
        );

        const parse = (event: MessageEvent) => {
            try {
                return JSON.parse(event.data);
            } catch {
                return null;
            }
        };

        source.addEventListener("snapshot", (event) => {
            const rows = parse(event as MessageEvent);
            if (Array.isArray(rows)) onUpdateRef.current(rows, true);
        });
        source.addEventListener("progress", (event) => {
            const row = parse(event as MessageEvent);
            if (row?.id) onUpdateRef.current([row], false);
        });
        // Server is done; don't let EventSource auto-reconnect.
        source.addEventListener("idle", () => source.close());

        return () => source.close();
    }, [botId, active]);
}

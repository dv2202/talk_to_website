"use client";

import { useEffect, useSyncExternalStore } from "react";

export type ClientSession = {
    session: { id: string; expiresAt: string };
    user: {
        id: string;
        name: string;
        email: string;
        emailVerified: boolean;
        image: string | null;
    };
};

type AuthResult<T = unknown> = { data: T | null; error: { message: string } | null };

type SessionState = { data: ClientSession | null; isPending: boolean };

let state: SessionState = { data: null, isPending: true };
let loaded = false;
let inflight: Promise<ClientSession | null> | null = null;
const listeners = new Set<() => void>();

function setState(next: SessionState) {
    state = next;
    listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

const serverSnapshot: SessionState = { data: null, isPending: true };

/** Fetches the session from the server and updates every `useSession` consumer. */
async function fetchSession(): Promise<ClientSession | null> {
    if (inflight) return inflight;
    inflight = (async () => {
        try {
            const res = await fetch("/api/auth/session", {
                credentials: "same-origin",
                cache: "no-store",
            });
            const data = res.ok ? ((await res.json()) as ClientSession | null) : null;
            loaded = true;
            setState({ data, isPending: false });
            return data;
        } catch {
            loaded = true;
            setState({ data: null, isPending: false });
            return null;
        } finally {
            inflight = null;
        }
    })();
    return inflight;
}

async function postJson<T>(url: string, body?: unknown): Promise<AuthResult<T>> {
    try {
        const res = await fetch(url, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const json = (await res.json().catch(() => ({}))) as T & { error?: string };
        if (!res.ok) {
            return { data: null, error: { message: json.error || "Request failed" } };
        }
        return { data: json, error: null };
    } catch {
        return { data: null, error: { message: "Network error. Please try again." } };
    }
}

export function useSession(): SessionState {
    const snapshot = useSyncExternalStore(subscribe, () => state, () => serverSnapshot);
    useEffect(() => {
        if (!loaded) void fetchSession();
    }, []);
    return snapshot;
}

export const signIn = {
    async email(params: { email: string; password: string }) {
        const result = await postJson("/api/auth/sign-in", params);
        if (!result.error) await fetchSession();
        return result;
    },
    /** Exchanges a Google GIS auth code for a session. */
    async google(params: { code: string }) {
        const result = await postJson("/api/auth/google", params);
        if (!result.error) await fetchSession();
        return result;
    },
};

export async function signOut() {
    await postJson("/api/auth/sign-out");
    setState({ data: null, isPending: false });
}

export const authClient = {
    async getSession(): Promise<{ data: ClientSession | null }> {
        return { data: await fetchSession() };
    },
    async requestPasswordReset(params: { email: string }) {
        return postJson("/api/auth/password/forgot", params);
    },
    async resetPassword(params: { email: string; otp: string; password: string }) {
        return postJson("/api/auth/password/reset", params);
    },
};

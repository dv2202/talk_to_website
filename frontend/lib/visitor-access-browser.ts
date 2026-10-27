const storageKey = (botId: string) => `ttw:visitor-access:${botId}`;

export function getStoredVisitorAccessToken(botId: string): string | null {
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem(storageKey(botId));
}

export function storeVisitorAccessToken(botId: string, token: string): void {
    window.sessionStorage.setItem(storageKey(botId), token);
}

export function clearVisitorAccessToken(botId: string): void {
    window.sessionStorage.removeItem(storageKey(botId));
}

export const ADMIN_EMAILS = ["satya@botwebai.com"];

export function isAdminEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

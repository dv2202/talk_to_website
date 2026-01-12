import { isAdminEmail } from "@/lib/admin";

/**
 * Full page navigation after auth.
 * Soft router.push can race with a freshly set session cookie (especially after
 * Google popup callbacks), leaving the user stuck on /login in production.
 */
export function redirectAfterAuth(path = "/dashboard") {
  if (typeof window === "undefined") return;
  window.location.assign(path);
}

/** Platform admins land on /admin; everyone else on the user dashboard. */
export function getPostAuthPath(email: string | null | undefined) {
  return isAdminEmail(email) ? "/admin" : "/dashboard";
}

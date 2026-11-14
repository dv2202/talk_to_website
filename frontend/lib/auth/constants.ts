/** Edge-safe constants (imported by proxy.ts, so no Node/Prisma imports here). */
export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Host-ttw_session" : "ttw_session";

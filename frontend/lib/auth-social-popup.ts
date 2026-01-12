import { authClient, signIn } from "@/lib/auth-client";

type GooglePopupOptions = {
  onSuccess?: () => void;
  onError?: (message?: string) => void;
};

type GoogleCodeClient = {
  requestCode: () => void;
};

type GoogleAccountsOauth2 = {
  initCodeClient: (config: {
    client_id: string;
    scope: string;
    ux_mode: "popup";
    callback: (response: { code?: string; error?: string; error_description?: string }) => void;
  }) => GoogleCodeClient;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: GoogleAccountsOauth2;
      };
    };
  }
}

let gisLoadPromise: Promise<void> | null = null;

function loadGoogleIdentityServices() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google sign-in is only available in the browser"));
  }

  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }

  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-gis="true"]');
    if (existing) {
      if (window.google?.accounts?.oauth2) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google script")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleGis = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google script"));
    document.head.appendChild(script);
  });

  return gisLoadPromise;
}

/** Call on login/signup mount so the click handler can open the popup synchronously. */
export function preloadGoogleSignIn() {
  return loadGoogleIdentityServices().catch(() => {
    // Prefetch is best-effort; errors surface on click.
  });
}

/**
 * Opens Google's official OAuth popup (GIS ux_mode: "popup"),
 * then signs in with Better Auth using the returned ID token.
 */
export async function signInWithGooglePopup(options: GooglePopupOptions = {}) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    options.onError?.("Google Client ID is not configured");
    return;
  }

  // Prefer already-loaded GIS so requestCode() stays inside the user gesture.
  if (!window.google?.accounts?.oauth2) {
    try {
      await loadGoogleIdentityServices();
    } catch {
      options.onError?.("Could not load Google sign-in. Please try again.");
      return;
    }
  }

  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    options.onError?.("Google sign-in is unavailable. Please try again.");
    return;
  }

  await new Promise<void>((resolve) => {
    const client = oauth2.initCodeClient({
      client_id: clientId,
      scope: "openid email profile",
      ux_mode: "popup",
      callback: async (response) => {
        try {
          if (response.error || !response.code) {
            options.onError?.(
              response.error_description || response.error || "Google login was cancelled.",
            );
            resolve();
            return;
          }

          const exchangeRes = await fetch("/api/auth/google-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: response.code }),
          });

          const exchangeData = (await exchangeRes.json()) as {
            idToken?: string;
            accessToken?: string;
            error?: string;
          };

          if (!exchangeRes.ok || !exchangeData.idToken) {
            options.onError?.(exchangeData.error || "Google login failed. Please try again.");
            resolve();
            return;
          }

          const result = await signIn.social({
            provider: "google",
            idToken: {
              token: exchangeData.idToken,
              accessToken: exchangeData.accessToken,
            },
          });

          if (result.error) {
            options.onError?.(result.error.message || "Google login failed. Please try again.");
            resolve();
            return;
          }

          // Better Auth's default session atom listeners omit /sign-in/social,
          // so force a session refetch before the post-login redirect.
          authClient.$store.notify("$sessionSignal");
          await authClient.getSession();

          options.onSuccess?.();
          resolve();
        } catch {
          options.onError?.("Google login failed. Please try again.");
          resolve();
        }
      },
    });

    client.requestCode();
  });
}

import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
    // Omit baseURL so the browser always uses the current origin.
    // Baking NEXT_PUBLIC_APP_URL (e.g. localhost) into a prod client bundle
    // breaks session cookie reads after OAuth.
    plugins: [emailOTPClient()],
});

export const {
    signIn,
    signUp,
    signOut,
    useSession,
} = authClient;

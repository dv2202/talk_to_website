import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import { prisma } from "./prisma";
import { sendBetterAuthOtp } from "@/lib/services/otp";

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    secret: process.env.AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    trustedOrigins: [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://botwebai.com",
        "https://www.botwebai.com",
        process.env.NEXT_PUBLIC_APP_URL || "",
        process.env.BETTER_AUTH_URL || "",
    ].filter(Boolean),
    emailAndPassword: {
        enabled: true,
        // Email/password signup goes through our OTP flow (account created after verify).
        // Keep Better Auth email signup disabled for clients that hit /sign-up/email directly.
        disableSignUp: true,
    },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        },
    },
    plugins: [
        emailOTP({
            otpLength: 6,
            expiresIn: 600,
            allowedAttempts: 5,
            disableSignUp: true,
            async sendVerificationOTP({ email, otp, type }) {
                await sendBetterAuthOtp({ email, otp, type });
            },
        }),
    ],
});

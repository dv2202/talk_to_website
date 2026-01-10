"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Space_Grotesk } from "next/font/google";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthMarketingPanel } from "@/components/auth/AuthMarketingPanel";
import { Bot, Eye, EyeOff, Loader2 } from "lucide-react";

const space = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
});

type Step = "email" | "reset";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startResendCooldown = (seconds = 60) => {
    setResendCooldown(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const requestOtp = async (targetEmail: string) => {
    const { error: requestError } = await authClient.emailOtp.requestPasswordReset({
      email: targetEmail.trim().toLowerCase(),
    });
    if (requestError) {
      throw new Error(requestError.message || "Failed to send reset code");
    }
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      await requestOtp(email);
      setStep("reset");
      setInfo(`If an account exists for ${email}, a reset code has been sent.`);
      startResendCooldown();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset code");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setError("");
    setInfo("");
    setResendLoading(true);
    try {
      await requestOtp(email);
      setInfo("A new reset code has been sent");
      startResendCooldown();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend code");
    } finally {
      setResendLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await authClient.emailOtp.resetPassword({
        email: email.trim().toLowerCase(),
        otp,
        password,
      });

      if (resetError) {
        setError(resetError.message || "Failed to reset password");
        return;
      }

      setInfo("Password updated. Redirecting to login...");
      setTimeout(() => router.push("/login"), 900);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${space.variable} grid min-h-screen lg:grid-cols-2`}>
      <div className="relative flex min-h-screen flex-col bg-white px-6 py-6 sm:px-10 lg:px-14 xl:px-20 dark:bg-[#0e0f11]">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#111] text-white dark:bg-white dark:text-black">
              <Bot className="h-4 w-4" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-[#111] [font-family:var(--font-space)] dark:text-white">
              BotWebAI
            </span>
          </Link>
          <Link href="/login">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:bg-white/5"
            >
              Log in
            </Button>
          </Link>
        </header>

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-[#111] [font-family:var(--font-space)] dark:text-white sm:text-[2rem]">
              {step === "email" ? "Forgot password" : "Reset password"}
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {step === "email"
                ? "Enter your email and we’ll send a one-time code."
                : "Enter the code from your email and choose a new password."}
            </p>
          </div>

          {step === "email" ? (
            <form onSubmit={handleRequest} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 rounded-lg border-zinc-200 bg-white px-3 shadow-none focus-visible:ring-zinc-300 dark:border-white/15 dark:bg-white/5"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-lg bg-[#111] text-sm font-semibold text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Send reset code
              </Button>

              <p className="text-center text-sm text-zinc-500">
                Remembered it?{" "}
                <Link href="/login" className="font-medium text-zinc-800 underline-offset-2 hover:underline dark:text-zinc-200">
                  Back to login
                </Link>
              </p>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
                  {error}
                </div>
              )}
              {info && !error && (
                <div className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                  {info}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="otp" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Reset code
                </Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  maxLength={6}
                  className="h-11 rounded-lg border-zinc-200 bg-white px-3 text-center text-lg tracking-[0.35em] shadow-none focus-visible:ring-zinc-300 dark:border-white/15 dark:bg-white/5"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  New password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="h-11 rounded-lg border-zinc-200 bg-white px-3 pr-10 shadow-none focus-visible:ring-zinc-300 dark:border-white/15 dark:bg-white/5"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-600 dark:hover:text-zinc-300"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Confirm new password
                </Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="h-11 rounded-lg border-zinc-200 bg-white px-3 shadow-none focus-visible:ring-zinc-300 dark:border-white/15 dark:bg-white/5"
                />
              </div>

              <Button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="h-11 w-full rounded-lg bg-[#111] text-sm font-semibold text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Update password
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setOtp("");
                    setPassword("");
                    setConfirmPassword("");
                    setError("");
                    setInfo("");
                  }}
                  className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendLoading || resendCooldown > 0}
                  className="text-zinc-700 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50 dark:text-zinc-300"
                >
                  {resendLoading
                    ? "Sending..."
                    : resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : "Resend code"}
                </button>
              </div>
            </form>
          )}
        </div>

        <footer className="flex items-center justify-between text-xs text-zinc-400">
          <p>© {new Date().getFullYear()} BotWebAI</p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-zinc-600 dark:hover:text-zinc-300">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-zinc-600 dark:hover:text-zinc-300">
              Privacy
            </Link>
          </div>
        </footer>
      </div>

      <AuthMarketingPanel />
    </div>
  );
}

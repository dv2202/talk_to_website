"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Space_Grotesk } from "next/font/google";
import { signIn } from "@/lib/auth-client";
import { redirectAfterAuth } from "@/lib/auth-redirect";
import { preloadGoogleSignIn, signInWithGooglePopup } from "@/lib/auth-social-popup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthMarketingPanel } from "@/components/auth/AuthMarketingPanel";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const space = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
});

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

type Step = "form" | "otp";

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    preloadGoogleSignIn();
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/otp/signup/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Signup failed");
        return;
      }

      setStep("otp");
      setInfo(`We sent a 6-digit code to ${data.email || email}`);
      startResendCooldown();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/otp/signup/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Invalid verification code");
        return;
      }

      const result = await signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message || "Account created, but sign-in failed. Please log in.");
        router.push("/login");
        return;
      }

      redirectAfterAuth("/dashboard");
      return;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setError("");
    setInfo("");
    setResendLoading(true);
    try {
      const response = await fetch("/api/auth/otp/signup/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to resend code");
        return;
      }
      setInfo("A new verification code has been sent");
      startResendCooldown();
    } catch {
      setError("Failed to resend code. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (googleLoading) return;
    setError("");
    setGoogleLoading(true);
    try {
      await signInWithGooglePopup({
        onSuccess: () => {
          redirectAfterAuth("/dashboard");
        },
        onError: (message) => {
          setGoogleLoading(false);
          setError(message || "Google signup failed. Please try again.");
        },
      });
    } catch {
      setGoogleLoading(false);
      setError("Google signup failed. Please try again.");
    }
  };

  return (
    <div className={`${space.variable} grid min-h-screen lg:grid-cols-2`}>
      <div className="relative flex min-h-screen flex-col bg-white px-6 py-6 sm:px-10 lg:px-14 xl:px-20 dark:bg-[#0e0f11]">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="BotWebAI" width={32} height={32} className="h-8 w-8" />
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
              {step === "form" ? "Create your account" : "Verify your email"}
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {step === "form"
                ? "Securely create your account in seconds."
                : "Enter the 6-digit code we sent to your email. Your account is created after verification."}
            </p>
          </div>

          {step === "form" ? (
            <div className="space-y-5">
              <Button
                variant="outline"
                className="h-11 w-full rounded-lg border-zinc-200 bg-white text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:bg-white/5"
                onClick={handleGoogleSignup}
                type="button"
                disabled={googleLoading || loading}
                aria-busy={googleLoading}
              >
                {googleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GoogleIcon />
                )}
                {googleLoading ? "Signing in..." : "Sign up with Google"}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-200 dark:border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 font-medium uppercase tracking-wider text-zinc-400 dark:bg-[#0e0f11]">
                    Or
                  </span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Full name
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="h-11 rounded-lg border-zinc-200 bg-white px-3 shadow-none focus-visible:ring-zinc-300 dark:border-white/15 dark:bg-white/5"
                  />
                </div>

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

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Password
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
                    Re-enter password
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      className="h-11 rounded-lg border-zinc-200 bg-white px-3 pr-10 shadow-none focus-visible:ring-zinc-300 dark:border-white/15 dark:bg-white/5"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-600 dark:hover:text-zinc-300"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full rounded-lg bg-[#111] text-sm font-semibold text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Continue
                </Button>
              </form>

              <p className="text-center text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                By continuing, you agree to our{" "}
                <Link href="/terms" className="underline underline-offset-2 hover:text-zinc-800 dark:hover:text-zinc-200">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="underline underline-offset-2 hover:text-zinc-800 dark:hover:text-zinc-200">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
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
                  Verification code
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

              <Button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="h-11 w-full rounded-lg bg-[#111] text-sm font-semibold text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify & create account
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setStep("form");
                    setOtp("");
                    setError("");
                    setInfo("");
                  }}
                  className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
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

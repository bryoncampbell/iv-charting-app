"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const redirect = searchParams.get("redirect") ?? "/dashboard";

  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-900 dark:to-slate-900">
        <header className="shrink-0 border-b border-slate-200/80 dark:border-slate-700/80 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-sm">
          <div className="mx-auto max-w-4xl px-6 py-6 sm:py-8 text-center">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-800 dark:text-white">RevIVe Hydration and Recovery</h1>
            <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400">IV therapy and wellness</p>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="rounded-2xl bg-white dark:bg-gray-800/95 shadow-xl border border-slate-200/60 dark:border-gray-700/60 p-8 max-w-md w-full text-center">
            <p className="text-slate-600 dark:text-slate-400">Sign-in is not configured. Use the app without logging in.</p>
            <Link href="/dashboard" className="mt-4 inline-block text-blue-600 dark:text-blue-400 font-medium hover:underline">Go to Dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  if (auth?.user) {
    router.replace(redirect);
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-900 dark:to-slate-900">
        <header className="shrink-0 border-b border-slate-200/80 dark:border-slate-700/80 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-sm">
          <div className="mx-auto max-w-4xl px-6 py-6 sm:py-8 text-center">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-800 dark:text-white">RevIVe Hydration and Recovery</h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-slate-600 dark:text-slate-400">Redirecting…</p>
        </div>
      </div>
    );
  }

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await auth!.signInWithPassword(email.trim(), password);
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.replace(redirect);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await auth!.sendPasswordResetEmail(email.trim());
    setLoading(false);
    if (err) {
      const msg = /rate limit|rate_limit|429/i.test(err.message)
        ? "Too many emails sent. Please wait an hour and try again."
        : err.message;
      setError(msg);
      return;
    }
    setForgotPasswordSent(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-900 dark:to-slate-900">
      {/* Banner */}
      <header className="shrink-0 border-b border-slate-200/80 dark:border-slate-700/80 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-sm">
        <div className="mx-auto max-w-4xl px-6 py-6 sm:py-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-800 dark:text-white">
            RevIVe Hydration and Recovery
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400">
            IV therapy and wellness — sign in to access your account
          </p>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md">
          <div className="rounded-2xl bg-white dark:bg-gray-800/95 shadow-xl shadow-slate-200/50 dark:shadow-black/20 border border-slate-200/60 dark:border-gray-700/60 overflow-hidden">
            <div className="px-8 py-8 sm:px-10 sm:py-10">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Sign in</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Access is by invitation only.</p>

              {forgotPasswordSent && (
                <div className="mt-6 rounded-xl bg-emerald-50 dark:bg-emerald-900/25 border border-emerald-200/60 dark:border-emerald-800/40 p-4 text-sm text-emerald-800 dark:text-emerald-200">
                  If an account exists for that email, you will receive a link to sign in or reset your password. Check your inbox.
                </div>
              )}

              {error && (
                <div className="mt-6 rounded-xl bg-red-50 dark:bg-red-900/25 border border-red-200/60 dark:border-red-800/40 p-4 text-sm text-red-800 dark:text-red-200">
                  {error}
                </div>
              )}

              {!forgotPasswordSent && (
                <>
                  <form onSubmit={handlePasswordSignIn} className="mt-6 space-y-5">
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                      <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="mt-1.5 block w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700/50 px-3.5 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:focus:border-blue-400 dark:focus:ring-blue-400 transition-colors"
                      />
                    </div>
                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                      <input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="mt-1.5 block w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700/50 px-3.5 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:focus:border-blue-400 dark:focus:ring-blue-400 transition-colors"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50 transition-colors"
                    >
                      {loading ? "Signing in…" : "Sign in"}
                    </button>
                  </form>

                  <div className="mt-8 pt-6 border-t border-slate-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Forgot your password?</p>
                    <form onSubmit={handleForgotPassword} className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Your email"
                        required
                        className="flex-1 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700/50 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      />
                      <button
                        type="submit"
                        disabled={loading}
                        className="shrink-0 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700/50 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                      >
                        Send reset link
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-900 dark:to-slate-900">
        <header className="shrink-0 border-b border-slate-200/80 dark:border-slate-700/80 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-sm">
          <div className="mx-auto max-w-4xl px-6 py-6 sm:py-8 text-center">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-800 dark:text-white">RevIVe Hydration and Recovery</h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-slate-600 dark:text-slate-400">Loading…</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

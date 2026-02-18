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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow max-w-md w-full text-center">
          <p className="text-gray-600 dark:text-gray-400">Sign-in is not configured. Use the app without logging in.</p>
          <Link href="/dashboard" className="mt-4 inline-block text-blue-600 dark:text-blue-400">Go to Dashboard</Link>
        </div>
      </div>
    );
  }

  if (auth?.user) {
    router.replace(redirect);
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <p className="text-gray-600 dark:text-gray-400">Redirecting…</p>
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
      setError(err.message);
      return;
    }
    setForgotPasswordSent(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow max-w-md w-full">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Sign in</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">RevIVe Hydration and Recovery. Access is by invitation only.</p>

        {forgotPasswordSent && (
          <div className="mt-4 rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-800 dark:text-green-300">
            If an account exists for that email, you will receive a link to sign in or reset your password. Check your inbox.
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-300">
            {error}
          </div>
        )}

        {!forgotPasswordSent && (
          <>
            <form onSubmit={handlePasswordSignIn} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Forgot your password?</p>
              <form onSubmit={handleForgotPassword} className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email"
                  required
                  className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Send reset link
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <p className="text-gray-600 dark:text-gray-400">Loading…</p>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

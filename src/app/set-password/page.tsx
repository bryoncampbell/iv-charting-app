"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export default function SetPasswordPage() {
  const router = useRouter();
  const auth = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const mustReset = (auth?.user as { app_metadata?: { must_reset_password?: boolean } } | undefined)?.app_metadata?.must_reset_password;

  if (!auth?.user) {
    router.replace("/login");
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <p className="text-gray-600 dark:text-gray-400">Redirecting to sign in…</p>
      </div>
    );
  }
  // Show form for: first-time temp password (must_reset) or landing from "Forgot password" link (recovery)
  // No redirect to dashboard here — user must set a new password on this page

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!isSupabaseConfigured() || !supabase) {
      setError("Not configured.");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    if (mustReset) {
      const res = await fetch("/api/auth/clear-must-reset", {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.session?.access_token}` },
      });
      if (!res.ok) {
        setError("Could not complete setup. Try signing in again.");
        setLoading(false);
        return;
      }
      // Refresh session so client gets updated app_metadata (must_reset_password: false)
      await supabase.auth.refreshSession();
    }
    setLoading(false);
    router.replace("/dashboard");
  };

  const handleSignOut = async () => {
    await auth?.signOut();
    router.replace("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow max-w-md w-full relative">
        <div className="absolute top-4 right-4">
          <button
            type="button"
            onClick={handleSignOut}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            Sign out
          </button>
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white pr-20">Set your password</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {mustReset
            ? "You must set a new password before continuing. This replaces your temporary password."
            : "Choose a new password. You’ll use it to sign in from now on."}
        </p>
        {error && (
          <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-300">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">New password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">At least 8 characters</p>
          </div>
          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm new password</label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Saving…" : "Set password and continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

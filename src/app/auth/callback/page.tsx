"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

/**
 * Supabase magic link redirect target. The client parses the URL hash and sets the session;
 * we wait for auth state then redirect to dashboard.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const auth = useAuth();
  const user = auth?.user ?? null;
  const loading = auth?.loading ?? true;

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      router.replace("/dashboard");
      return;
    }
    if (loading) return;
    if (user) {
      router.replace("/dashboard");
      return;
    }
    // No user after loading – might be expired link or error; send to login
    router.replace("/login");
  }, [loading, user, router]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <p className="text-gray-600 dark:text-gray-400">Completing sign-in…</p>
    </div>
  );
}

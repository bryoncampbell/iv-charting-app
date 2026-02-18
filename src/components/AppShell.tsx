"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

/**
 * Wraps app content and shows main app navigation only on internal routes.
 * Public summary links (/summary/[token]) get no navigation—patient sees only the summary, no access to the system.
 * When Supabase is configured, redirects to /login if not signed in (except for /login, /auth/callback, /summary).
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const isPublicSummary = pathname != null && pathname.startsWith("/summary");
  const isLogin = pathname === "/login";
  const isAuthCallback = pathname != null && pathname.startsWith("/auth/callback");
  const isAccountDisabled = pathname === "/account-disabled";
  const isSetPassword = pathname === "/set-password";

  const isPublicRoute = isPublicSummary || isLogin || isAuthCallback || isAccountDisabled;

  const mustResetPassword = (auth?.user as { app_metadata?: { must_reset_password?: boolean } } | undefined)?.app_metadata?.must_reset_password === true;

  useEffect(() => {
    if (!isSupabaseConfigured() || auth?.loading || isPublicRoute) return;
    if (!auth?.user) {
      router.replace("/login");
      return;
    }
    if (mustResetPassword && !isSetPassword) {
      router.replace("/set-password");
      return;
    }
    if (auth.profile && !auth.isActive) {
      router.replace("/account-disabled");
      return;
    }
    // Admin access is enforced by the admin page via API (so admins whose profile didn't load can still get in)
  }, [auth?.loading, auth?.user, auth?.profile, auth?.isActive, isPublicRoute, isSetPassword, mustResetPassword, router]);

  if (isPublicSummary || isSetPassword) {
    return <>{children}</>;
  }

  if (isSupabaseConfigured() && !auth?.loading && !auth?.user && !isPublicRoute) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <p className="text-gray-600 dark:text-gray-400">Redirecting to sign in…</p>
      </div>
    );
  }

  if (mustResetPassword && !isSetPassword) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <p className="text-gray-600 dark:text-gray-400">Redirecting to set password…</p>
      </div>
    );
  }

  return (
    <>
      <Navigation />
      <main className="pb-20 md:pb-0">{children}</main>
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { isLicenseExpired, shouldShowLicenseWarning } from "@/types/profile";

/**
 * Wraps app content and shows main app navigation only on internal routes.
 * Public summary links (/summary/[token]) get no navigation—patient sees only the summary, no access to the system.
 * When Supabase is configured, redirects to /login if not signed in (except for /login, /auth/callback, /summary).
 */
type LicenseToastPhase = "idle" | "show" | "fadeout";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const [licenseToastPhase, setLicenseToastPhase] = useState<LicenseToastPhase>("idle");
  const licenseToastShownRef = useRef(false);
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

  // License warning: applies to all roles. Toast pops up on dashboard after login, then fades away.
  const profile = auth?.profile;
  const licenseExpiring = profile ? shouldShowLicenseWarning(profile) : false;
  const isDashboard = pathname === "/" || pathname === "/dashboard";

  // Reset "already shown" when leaving dashboard so the toast shows again on next visit
  useEffect(() => {
    if (!isDashboard) licenseToastShownRef.current = false;
  }, [isDashboard]);

  // On dashboard: fetch profile from API (same as profile page) and show toast if license expiring/expired
  useEffect(() => {
    if (!isDashboard || isPublicRoute || !auth?.user || !auth?.session?.access_token || licenseToastShownRef.current) return;
    let cancelled = false;
    const t = setTimeout(() => {
      fetch("/api/profile", { headers: { Authorization: `Bearer ${auth.session!.access_token}` } })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled || !data?.profile || licenseToastShownRef.current) return;
          if (shouldShowLicenseWarning(data.profile)) {
            licenseToastShownRef.current = true;
            setLicenseToastPhase("show");
          }
        })
        .catch(() => {});
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [isDashboard, isPublicRoute, auth?.user?.id, auth?.session?.access_token]);

  useEffect(() => {
    if (licenseToastPhase === "show") {
      const t = setTimeout(() => setLicenseToastPhase("fadeout"), 4500);
      return () => clearTimeout(t);
    }
    if (licenseToastPhase === "fadeout") {
      const t = setTimeout(() => setLicenseToastPhase("idle"), 400);
      return () => clearTimeout(t);
    }
  }, [licenseToastPhase]);

  if (isPublicSummary || isSetPassword || isLogin) {
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

  const showLicenseWarning = licenseExpiring;
  const licenseExpired = profile && (profile.license_expiry ?? (profile as { license_expiry?: string }).license_expiry) && isLicenseExpired(profile.license_expiry ?? (profile as { license_expiry?: string }).license_expiry);

  return (
    <>
      <Navigation />
      {licenseToastPhase !== "idle" && licenseExpiring && (
        <div
          className="no-print fixed left-1/2 top-4 z-[100] -translate-x-1/2 transition-opacity duration-300 ease-out"
          style={{ opacity: licenseToastPhase === "fadeout" ? 0 : 1 }}
          role="alert"
        >
          <div
            className={`rounded-lg border px-4 py-3 shadow-lg ${
              licenseExpired
                ? "border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-900/95"
                : "border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/95"
            }`}
          >
            <p
              className={`text-sm font-medium ${
                licenseExpired ? "text-red-800 dark:text-red-200" : "text-amber-800 dark:text-amber-200"
              }`}
            >
              {licenseExpired
                ? "Your license has expired. Please update your license information."
                : profile?.license_expiry || (profile as { license_expiry?: string })?.license_expiry
                  ? "Your license expires within 30 days or has expired. Please update your license information."
                  : "Please set your license expiry date in your profile so chart signing stays accurate."}
            </p>
            <Link
              href="/profile"
              className={`mt-2 inline-block text-sm font-medium underline ${
                licenseExpired
                  ? "text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200"
                  : "text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200"
              }`}
            >
              Update profile →
            </Link>
          </div>
        </div>
      )}
      {showLicenseWarning && (
        <div
          className={`no-print border-b ${
            licenseExpired
              ? "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700"
              : "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700"
          }`}
        >
          <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6 lg:px-8 flex items-center justify-between gap-4 flex-wrap">
            <p
              className={`text-sm ${
                licenseExpired ? "text-red-800 dark:text-red-200" : "text-amber-800 dark:text-amber-200"
              }`}
            >
              {licenseExpired
                ? "Your license has expired. Please update your license information so chart signing remains accurate."
                : profile?.license_expiry || (profile as { license_expiry?: string })?.license_expiry
                  ? "Your license expires within 30 days or has expired. Please update your license information so chart signing remains accurate."
                  : "Please set your license expiry date in your profile so chart signing remains accurate."}
            </p>
            <Link
              href="/profile"
              className={`shrink-0 rounded px-3 py-1.5 text-sm font-medium text-white ${
                licenseExpired
                  ? "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
                  : "bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600"
              }`}
            >
              Update profile
            </Link>
          </div>
        </div>
      )}
      <main className="pb-20 md:pb-0">{children}</main>
    </>
  );
}

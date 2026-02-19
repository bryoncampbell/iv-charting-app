"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { shouldShowLicenseWarning, getLicenseExpiryStatus } from "@/types/profile";

interface LicenseExpiryBannerProps {
  accessToken: string | undefined;
}

/**
 * Fetches profile from API and shows a prominent banner when license is expiring or expired.
 * Renders inline in the page (e.g. at top of dashboard) so it always shows when the page loads.
 */
export default function LicenseExpiryBanner({ accessToken }: LicenseExpiryBannerProps) {
  const [profile, setProfile] = useState<{ license_type?: string; license_expiry?: string; role?: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    fetch("/api/profile", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.profile) setProfile(data.profile);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const profileForWarning = profile
    ? { license_type: profile.license_type ?? null, license_expiry: profile.license_expiry ?? null, role: profile.role ?? null }
    : null;
  if (!loaded || !profile || !shouldShowLicenseWarning(profileForWarning)) return null;

  const status = getLicenseExpiryStatus(profile.license_expiry ?? null);
  const isExpired = status === "expired";

  return (
    <div
      className={`mb-6 rounded-lg border p-4 ${
        isExpired
          ? "border-red-400 bg-red-50 dark:border-red-600 dark:bg-red-900/20"
          : "border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-900/20"
      }`}
      role="alert"
    >
      <p
        className={`font-semibold ${
          isExpired ? "text-red-800 dark:text-red-200" : "text-amber-800 dark:text-amber-200"
        }`}
      >
        {isExpired ? "Your license has expired" : "Your license expires within 30 days"}
      </p>
      <p
        className={`mt-1 text-sm ${
          isExpired ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"
        }`}
      >
        Please update your license information in your profile so chart signing remains accurate.
      </p>
      <Link
        href="/profile"
        className={`mt-3 inline-block text-sm font-medium underline ${
          isExpired
            ? "text-red-700 hover:text-red-800 dark:text-red-300 dark:hover:text-red-200"
            : "text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
        }`}
      >
        Update profile →
      </Link>
    </div>
  );
}

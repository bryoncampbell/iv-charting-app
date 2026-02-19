"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

function signedInLabel(profile: { first_name?: string | null; last_name?: string | null; display_name?: string | null } | null): string {
  const name = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || (profile.display_name ?? "").trim()
    : "";
  return name || "Account";
}

export default function Navigation() {
  const pathname = usePathname();
  const auth = useAuth();
  const signedInText = auth?.user ? signedInLabel(auth.profile) : "";

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: "📊" },
    { href: "/patients", label: "Patients", icon: "👥" },
    { href: "/visits", label: "Visits", icon: "📋" },
    { href: "/reports", label: "Reports", icon: "📈" },
    { href: "/audit", label: "Audit Log", icon: "📜" },
    ...(auth?.user ? [{ href: "/profile", label: "Profile", icon: "👤" } as const] : []),
    ...(auth?.user ? [{ href: "/admin", label: "Admin", icon: "⚙️" } as const] : []),
  ];

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/" || pathname === "/dashboard";
    }
    return pathname === href;
  };

  return (
    <>
      {/* Top Bar - Desktop (hidden when printing) */}
      <nav className="no-print sticky top-0 z-50 hidden md:block border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Link href="/dashboard" className="flex items-center gap-2">
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  RevIVe Hydration and Recovery
                </span>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              {isSupabaseConfigured() && (
                <div className="ml-2 flex items-center gap-2 border-l border-gray-200 dark:border-gray-600 pl-2">
                  {auth?.user ? (
                    <>
                      <span className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[200px]" title={signedInText}>
                        {signedInText}
                      </span>
                      <button
                        type="button"
                        onClick={() => auth.signOut()}
                        className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                      >
                        Sign out
                      </button>
                    </>
                  ) : (
                    <Link href="/login" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                      Sign in
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Bottom Nav - Mobile (hidden when printing) */}
      <nav className="no-print fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive(item.href)
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              <span className="text-2xl mb-1">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Mobile Top Bar (hidden when printing) */}
      <div className="no-print sticky top-0 z-50 md:hidden border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center">
            <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
              RevIVe Hydration and Recovery
            </span>
          </Link>
          {isSupabaseConfigured() && (
            <div className="flex items-center gap-2">
              {auth?.user ? (
                <>
                  <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[140px]" title={signedInText}>
                    {signedInText}
                  </span>
                  <button
                    type="button"
                    onClick={() => auth.signOut()}
                    className="text-xs font-medium text-gray-600 dark:text-gray-400"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <Link href="/login" className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  Sign in
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

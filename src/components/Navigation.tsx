"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: "📊" },
    { href: "/patients", label: "Patients", icon: "👥" },
    { href: "/visits", label: "Visits", icon: "📋" },
    { href: "/reports", label: "Reports", icon: "📈" },
    { href: "/audit", label: "Audit Log", icon: "📜" },
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
            <div className="flex items-center gap-1">
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
        <div className="px-4 py-3">
          <Link href="/dashboard" className="flex items-center">
            <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
              RevIVe Hydration and Recovery
            </span>
          </Link>
        </div>
      </div>
    </>
  );
}

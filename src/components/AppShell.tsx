"use client";

import { usePathname } from "next/navigation";
import Navigation from "@/components/Navigation";

/**
 * Wraps app content and shows main app navigation only on internal routes.
 * Public summary links (/summary/[token]) get no navigation—patient sees only the summary, no access to the system.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicSummary = pathname != null && pathname.startsWith("/summary");

  if (isPublicSummary) {
    return <>{children}</>;
  }

  return (
    <>
      <Navigation />
      <main className="pb-20 md:pb-0">{children}</main>
    </>
  );
}

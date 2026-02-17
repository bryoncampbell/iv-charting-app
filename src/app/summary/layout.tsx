import type { Metadata } from "next";

/**
 * Public visit summary: isolated from the main app. No navigation, no links to the system.
 * Security-focused metadata for HIPAA-minded use.
 */
export const metadata: Metadata = {
  title: "Your Visit Summary | RevIVe",
  description: "Secure view of your visit summary. This link does not provide access to the clinic system.",
  referrer: "no-referrer",
  robots: "noindex, nofollow",
};

export default function SummaryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

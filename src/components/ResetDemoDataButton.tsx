"use client";

import { resetDemoData } from "@/lib/demo-data";

export default function ResetDemoDataButton() {
  const handleReset = async () => {
    if (typeof window === "undefined") return;
    if (!confirm("Reset all demo data? Patients, encounters, and audit log will be cleared.")) return;
    await resetDemoData();
    window.location.href = "/dashboard";
  };

  return (
    <button
      type="button"
      onClick={handleReset}
      className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
    >
      Reset Demo Data
    </button>
  );
}

"use client";

import { seedDemoDataForCustomer } from "@/lib/demo-data";

export default function LoadSampleDataButton() {
  const handleLoad = () => {
    if (typeof window === "undefined") return;
    if (!confirm("Load 40 sample patients and visits with varied vitals? This will replace current data.")) return;
    seedDemoDataForCustomer();
    window.location.href = "/dashboard";
  };

  return (
    <button
      type="button"
      onClick={handleLoad}
      className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
    >
      Load sample data (40 patients)
    </button>
  );
}

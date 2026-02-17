"use client";

import { useState, useEffect, useMemo } from "react";
import type { Encounter } from "@/types";
import { STORAGE_KEYS } from "@/lib/storage";

// Option lists for breakdowns (must match encounter order form)
const ADDITIVES_VITAMINS_OPTIONS = [
  "Amino Blend",
  "L-Carnitine",
  "B5",
  "Lysine",
  "B6",
  "B12",
  "B Complex",
  "Magnesium Sulfate",
  "Biotin",
  "NAC",
  "Proline",
  "Taurine",
  "Vitamin C",
  "Vitamin D",
  "Glutamine",
  "Zinc",
  "Glutathione",
  "ALA",
  "Trace Elements",
  "Extra 500 mL of Hydration",
];

const ADDITIVES_MEDICATIONS_OPTIONS = ["Zofran", "Toradol"];

function parseAdditivesList(csv: string | undefined): string[] {
  if (!csv || !csv.trim()) return [];
  return csv.split(",").map((s) => s.trim()).filter(Boolean);
}

export default function ReportsPage() {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showRevenue, setShowRevenue] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.encounters);
    if (stored) {
      try {
        setEncounters(JSON.parse(stored));
      } catch {
        setEncounters([]);
      }
    }
  }, []);

  // Default date range: start of this month to today
  useEffect(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    if (!dateFrom) setDateFrom(first.toISOString().slice(0, 10));
    if (!dateTo) setDateTo(now.toISOString().slice(0, 10));
  }, [dateFrom, dateTo]);

  const filtered = useMemo(() => {
    if (!dateFrom || !dateTo) return encounters;
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    return encounters.filter((e) => {
      const d = new Date(e.date ?? e.createdAt);
      return d >= from && d <= to;
    });
  }, [encounters, dateFrom, dateTo]);

  const visitCount = filtered.length;

  const protocolBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((e) => {
      const key = e.treatment || e.administration?.fluidType || "Unspecified";
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const vitaminsBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    ADDITIVES_VITAMINS_OPTIONS.forEach((opt) => { counts[opt] = 0; });
    filtered.forEach((e) => {
      const list = parseAdditivesList(e.administration?.additivesVitamins);
      list.forEach((item) => {
        if (counts[item] !== undefined) counts[item] += 1;
        else counts[item] = (counts[item] || 0) + 1;
      });
    });
    return ADDITIVES_VITAMINS_OPTIONS.map((opt) => [opt, counts[opt] ?? 0] as [string, number])
      .sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const medicationsBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    ADDITIVES_MEDICATIONS_OPTIONS.forEach((opt) => { counts[opt] = 0; });
    filtered.forEach((e) => {
      const list = parseAdditivesList(e.administration?.additivesMedications);
      list.forEach((item) => {
        if (counts[item] !== undefined) counts[item] += 1;
        else counts[item] = (counts[item] || 0) + 1;
      });
    });
    return ADDITIVES_MEDICATIONS_OPTIONS.map((opt) => [opt, counts[opt] ?? 0] as [string, number]);
  }, [filtered]);

  const revenueTotal = useMemo(() => {
    return filtered.reduce((sum, e) => sum + (e.revenue ?? 0), 0);
  }, [filtered]);

  const hasAnyRevenue = encounters.some((e) => e.revenue != null && e.revenue > 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Reports
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Visit counts, IV fluid type, additives/vitamins, medications, and optional revenue by date range
          </p>
        </div>

        {/* Date range filter */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Date range
          </h2>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1 block rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1 block rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400"
              />
            </div>
            {hasAnyRevenue && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showRevenue}
                  onChange={(e) => setShowRevenue(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Include revenue totals
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Visit count */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Visit count
          </h2>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {visitCount}
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            visits in selected date range
          </p>
        </div>

        {/* IV fluid type breakdown */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            IV fluid type breakdown
          </h2>
          {protocolBreakdown.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No visits in this date range.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      IV fluid type
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Count
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                  {protocolBreakdown.map(([name, count]) => (
                    <tr key={name}>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-400 text-right">
                        {count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Additives / vitamins breakdown */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Additives / vitamins breakdown
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Count of visits that included each additive or vitamin. &quot;Extra 500 mL of Hydration&quot; is the extra fluids option.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Additive / vitamin
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                {vitaminsBreakdown.map(([name, count]) => (
                  <tr key={name} className={name === "Extra 500 mL of Hydration" ? "bg-emerald-50/50 dark:bg-emerald-900/10" : ""}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-400 text-right">
                      {count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Medications breakdown */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Medications breakdown
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Count of visits that included Zofran or Toradol.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Medication
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                {medicationsBreakdown.map(([name, count]) => (
                  <tr key={name}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-400 text-right">
                      {count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Revenue (optional) */}
        {(showRevenue || revenueTotal > 0) && (
          <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Revenue total
            </h2>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              ${revenueTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Sum of visit revenue in selected date range. Add optional revenue per encounter on the visit/encounter to include it here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

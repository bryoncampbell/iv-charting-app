"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import type { Encounter, Patient } from "@/types";
import { STORAGE_KEYS } from "@/lib/storage";
import ResetDemoDataButton from "@/components/ResetDemoDataButton";
import LoadSampleDataButton from "@/components/LoadSampleDataButton";

function getLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function DashboardPage() {
  const [totalPatients, setTotalPatients] = useState<number>(0);
  const [todayVisits, setTodayVisits] = useState<number>(0);
  const [weekVisits, setWeekVisits] = useState<number>(0);
  const [revenue, setRevenue] = useState<number>(0);
  const [recentEncounters, setRecentEncounters] = useState<Encounter[]>([]);

  const loadStats = useCallback(() => {
    try {
      const todayStr = getLocalDateString(new Date());
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      const weekStartStr = getLocalDateString(weekStart);

      const patientsRaw = localStorage.getItem(STORAGE_KEYS.patients);
      const patients: Patient[] = patientsRaw ? JSON.parse(patientsRaw) : [];
      setTotalPatients(Array.isArray(patients) ? patients.length : 0);

      const encountersRaw = localStorage.getItem(STORAGE_KEYS.encounters);
      const encounters: Encounter[] = encountersRaw ? JSON.parse(encountersRaw) : [];

      let today = 0;
      let week = 0;
      let rev = 0;
      for (const e of encounters) {
        const dateStr = e.date ?? (e.createdAt ? e.createdAt.slice(0, 10) : "");
        if (dateStr === todayStr) today += 1;
        if (dateStr >= weekStartStr) week += 1;
        rev += Number(e.revenue) || 0;
      }
      setTodayVisits(today);
      setWeekVisits(week);
      setRevenue(rev);

      const sorted = [...encounters].sort(
        (a, b) =>
          new Date(b.createdAt ?? b.date ?? 0).getTime() -
          new Date(a.createdAt ?? a.date ?? 0).getTime()
      );
      setRecentEncounters(sorted.slice(0, 5));
    } catch (e) {
      console.error("Error loading dashboard stats:", e);
    }
  }, []);

  const pathname = usePathname();
  useEffect(() => {
    loadStats();
  }, [pathname, loadStats]);

  useEffect(() => {
    const onFocus = () => loadStats();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadStats]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Overview of your clinic operations
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-blue-500 text-white">
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Total Patients
                  </p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {totalPatients}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-green-500 text-white">
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Today&apos;s Visits
                  </p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {todayVisits}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-purple-500 text-white">
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    This Week
                  </p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {weekVisits}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-orange-500 text-white">
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Revenue
                  </p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(revenue)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Recent Visits
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {recentEncounters.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No visits yet
                  </p>
                ) : (
                  recentEncounters.map((e) => {
                    const ts = e.createdAt ?? e.date ?? "";
                    const timeStr = ts
                      ? new Date(ts).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })
                      : "—";
                    const treatment =
                      e.administration?.fluidType ?? e.treatment ?? "IV visit";
                    return (
                      <div
                        key={e.id}
                        className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-4 last:border-0 last:pb-0"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {e.patientName ?? "Unknown"}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {treatment}
                          </p>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {timeStr}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Upcoming Appointments
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  View visits from the Visits page to see today&apos;s schedule.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-gray-200 pt-6 dark:border-gray-700">
          <LoadSampleDataButton />
          <ResetDemoDataButton />
        </div>
      </div>
    </div>
  );
}

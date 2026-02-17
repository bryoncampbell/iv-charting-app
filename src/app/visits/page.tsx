"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Encounter } from "@/types";
import { parseLocalDate } from "@/lib/dates";
import { STORAGE_KEYS } from "@/lib/storage";

type DateFilter = "today" | "last7days" | "all";

export default function VisitsPage() {
  const router = useRouter();
  const [allVisits, setAllVisits] = useState<Encounter[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>("last7days");

  useEffect(() => {
    const loadVisits = () => {
      const stored = localStorage.getItem(STORAGE_KEYS.encounters);
      if (!stored) {
        setAllVisits([]);
        return;
      }
      try {
        const encounters: Encounter[] = JSON.parse(stored);
        setAllVisits(
          encounters.sort(
            (a, b) =>
              new Date(b.createdAt || b.date).getTime() -
              new Date(a.createdAt || a.date).getTime()
          )
        );
      } catch {
        setAllVisits([]);
      }
    };

    // Initial load
    loadVisits();

    // Listen for changes to encounters in localStorage (e.g. status updates in other tabs)
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.encounters) {
        loadVisits();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Filter visits by date range (use local date so YYYY-MM-DD doesn't shift to previous day)
  const visitsInRange = allVisits.filter((visit) => {
    const dateStr = visit.date ?? (visit.createdAt ? visit.createdAt.slice(0, 10) : "");
    const visitDay = dateStr ? parseLocalDate(dateStr) : new Date(visit.createdAt ?? 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateFilter === "today") {
      const visitDayStart = new Date(visitDay.getFullYear(), visitDay.getMonth(), visitDay.getDate());
      return visitDayStart.getTime() === today.getTime();
    } else if (dateFilter === "last7days") {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return visitDay >= sevenDaysAgo;
    }
    return true; // "all"
  });

  const isDeclinedClosed = (v: Encounter) =>
    v.status === "declined" && !!(v.declineAcknowledgedAt && v.declineAcknowledgedBy);
  const currentVisits = visitsInRange.filter(
    (v) => (v.status ?? "in_progress") !== "completed" && v.status !== "cancelled" && !isDeclinedClosed(v)
  );
  const completedVisits = visitsInRange.filter(
    (v) => v.status === "completed" || v.status === "cancelled" || isDeclinedClosed(v)
  );

  const formatDate = (dateString: string) => {
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  type VisitPhase =
    | "intake"
    | "waiting_for_provider"
    | "orders_approved"
    | "infusion_in_progress"
    | "discharge"
    | "ready_for_discharge"
    | "visit_completed"
    | "declined"
    | "declined_closed"
    | "cancelled";

  function getVisitPhase(visit: Encounter): VisitPhase {
    const status = visit.status ?? "in_progress";
    const admin = visit.administration;
    const orderApproved = !!(admin?.orderApprovedAt && admin?.orderApprovedBy);
    const hasStart = !!(admin?.startTime?.trim());
    const hasEnd = !!(admin?.endTime?.trim());
    const readyForDischarge = !!(admin?.readyForDischargeAt);
    const declineAcknowledged = !!(visit.declineAcknowledgedAt && visit.declineAcknowledgedBy);

    if (status === "completed") return "visit_completed";
    if (status === "cancelled") return "cancelled";
    if (status === "declined") return declineAcknowledged ? "declined_closed" : "declined";
    if (status === "ready_for_provider") {
      if (orderApproved && readyForDischarge) return "ready_for_discharge";
      if (orderApproved && hasStart && hasEnd) return "discharge";
      if (orderApproved && hasStart && !hasEnd) return "infusion_in_progress";
      if (orderApproved) return "orders_approved";
      return "waiting_for_provider";
    }
    return "intake";
  }

  const getPhaseColor = (phase: VisitPhase) => {
    switch (phase) {
      case "visit_completed":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "declined":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "declined_closed":
        return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
      case "cancelled":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
      case "ready_for_discharge":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200";
      case "discharge":
        return "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200";
      case "infusion_in_progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "orders_approved":
        return "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200";
      case "waiting_for_provider":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
      case "intake":
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200";
    }
  };

  const getPhaseLabel = (phase: VisitPhase) => {
    switch (phase) {
      case "intake": return "Intake";
      case "waiting_for_provider": return "Waiting for provider";
      case "orders_approved": return "Orders approved";
      case "infusion_in_progress": return "Infusion in progress";
      case "discharge": return "Infusion complete";
      case "ready_for_discharge": return "Ready for discharge";
      case "visit_completed": return "Visit completed";
      case "declined": return "Declined — acknowledge required";
      case "declined_closed": return "Declined (closed)";
      case "cancelled": return "Cancelled";
      default: return "Intake";
    }
  };

  const handleNewVisit = () => {
    router.push("/visits/new");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Visits
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Track and manage patient visits. Click any visit to review details.
            </p>
          </div>
          <button
            onClick={handleNewVisit}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Visit
          </button>
        </div>

        {/* Date Filter Buttons */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Filter:
          </span>
          <button
            onClick={() => setDateFilter("today")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              dateFilter === "today"
                ? "bg-blue-600 text-white dark:bg-blue-500"
                : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            } border border-gray-300 dark:border-gray-600`}
          >
            Today
          </button>
          <button
            onClick={() => setDateFilter("last7days")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              dateFilter === "last7days"
                ? "bg-blue-600 text-white dark:bg-blue-500"
                : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            } border border-gray-300 dark:border-gray-600`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setDateFilter("all")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              dateFilter === "all"
                ? "bg-blue-600 text-white dark:bg-blue-500"
                : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            } border border-gray-300 dark:border-gray-600`}
          >
            All Visits
          </button>
        </div>

        {/* Current visits (in progress) */}
        <div className="mb-10 overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
          <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 sm:px-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Current visits
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {currentVisits.length} visit{currentVisits.length !== 1 ? "s" : ""} in progress
              {dateFilter !== "all" && ` (${allVisits.filter((v) => (v.status ?? "in_progress") !== "completed").length} total current)`}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:px-6">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:px-6">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:px-6">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:px-6">
                    Treatment
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:px-6">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                {currentVisits.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400 sm:px-6"
                    >
                      No visits in progress. Start a visit from a patient profile or check completed visits below.
                    </td>
                  </tr>
                ) : (
                  currentVisits.map((visit) => (
                    <tr
                      key={visit.id}
                      onClick={() => router.push(`/encounters/${visit.id}`)}
                      className="cursor-pointer transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      title="Click to review visit details"
                    >
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-gray-900 dark:text-white sm:px-6">
                        {visit.patientName}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600 dark:text-gray-400 sm:px-6">
                        {formatDate(visit.date)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600 dark:text-gray-400 sm:px-6">
                        {visit.time}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600 dark:text-gray-400 sm:px-6">
                        {visit.treatment || visit.administration?.fluidType || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm sm:px-6">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getPhaseColor(
                            getVisitPhase(visit)
                          )}`}
                        >
                          {getPhaseLabel(getVisitPhase(visit))}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Visit history (completed) */}
        <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
          <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 sm:px-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Visit history
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {completedVisits.length} visit{completedVisits.length !== 1 ? "s" : ""} in history
              {dateFilter !== "all" && ` (${allVisits.filter((v) => v.status === "completed" || v.status === "cancelled" || isDeclinedClosed(v)).length} total)`}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:px-6">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:px-6">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:px-6">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:px-6">
                    Treatment
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:px-6">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                {completedVisits.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400 sm:px-6"
                    >
                      No visits in history in this range.
                    </td>
                  </tr>
                ) : (
                  completedVisits.map((visit) => (
                    <tr
                      key={visit.id}
                      onClick={() => router.push(`/encounters/${visit.id}/summary`)}
                      className="cursor-pointer transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      title="Click to review visit details"
                    >
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-gray-900 dark:text-white sm:px-6">
                        {visit.patientName}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600 dark:text-gray-400 sm:px-6">
                        {formatDate(visit.date)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600 dark:text-gray-400 sm:px-6">
                        {visit.time}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600 dark:text-gray-400 sm:px-6">
                        {visit.treatment || visit.administration?.fluidType || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm sm:px-6">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getPhaseColor(
                            getVisitPhase(visit)
                          )}`}
                        >
                          {getPhaseLabel(getVisitPhase(visit))}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

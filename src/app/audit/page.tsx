"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { AuditEvent } from "@/types";
import { getAuditLog } from "@/lib/audit";
import { useAuth } from "@/contexts/AuthContext";

function formatDateTime(isoString: string) {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function actionLabel(action: AuditEvent["action"]): string {
  const labels: Record<AuditEvent["action"], string> = {
    "patient.view": "View patient",
    "patient.edit": "Edit patient",
    "patient.create": "Create patient",
    "encounter.view": "View encounter",
    "encounter.edit": "Edit encounter",
    "encounter.create": "Create encounter",
    "encounter.summary.view": "View summary",
    "encounter.summary.print": "Print summary",
    "encounter.summary.email": "Email summary to patient",
    "encounter.summary.text_link": "Text link to patient",
    "encounter.sign.nursing_complete": "Nursing complete",
    "encounter.sign.provider_signed": "Provider signed",
    "encounter.decline_to_treat": "Decline to treat",
    "encounter.decline_acknowledged": "Decline acknowledged",
    "encounter.cancelled": "Visit cancelled",
    "encounter.order_approved": "Order approved",
    "demo_data.reset": "Reset demo data",
    "demo_data.seed_customer": "Seed customer demo data",
  };
  return labels[action] ?? action;
}

export default function AuditLogPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const auth = useAuth();

  useEffect(() => {
    getAuditLog().then((log) => {
      setEvents(log);
      setLoading(false);
    });
  }, []);

  const refresh = () => {
    setLoading(true);
    getAuditLog().then((log) => {
      setEvents(log);
      setLoading(false);
    });
  };

  if (!auth?.isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Not authorized</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            The audit log is only available to admin users.
          </p>
          <div className="mt-4">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              ← Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 mb-2"
            >
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Audit Log
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Admin only · Key actions (view, edit, sign, print) — newest first
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Refresh
          </button>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-800">
          {loading ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              Loading…
            </div>
          ) : events.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No audit events yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Entity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {events.map((evt, index) => (
                    <tr
                      key={`${evt.timestamp}-${evt.entityId}-${index}`}
                      className="bg-white dark:bg-gray-800"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {formatDateTime(evt.timestamp)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {actionLabel(evt.action)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {evt.entityType}
                      </td>
                      <td className="max-w-[8rem] truncate px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400" title={evt.entityId}>
                        {evt.entityId}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-sm text-gray-500 dark:text-gray-400" title={evt.details ?? ""}>
                        {evt.details ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

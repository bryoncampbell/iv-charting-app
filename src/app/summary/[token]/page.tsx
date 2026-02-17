"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import type { Administration, Encounter, Patient, Vital } from "@/types";
import { parseLocalDate } from "@/lib/dates";

const ORDER_PRICING = { baseFee: 180, medicationFee: 30, extraFluidFee: 20 } as const;
const EXTRA_500_ML_OPTION = "Extra 500 mL of Hydration";
const ADDITIVES_MEDICATIONS_OPTIONS = ["Zofran", "Toradol"];

function computeOrderCostFromAdmin(admin: Administration | undefined): number | null {
  if (!admin) return null;
  const hasOrderData = !!(admin.fluidType?.trim() || admin.volume?.trim() || admin.rate?.trim() || admin.orderApprovedAt);
  if (!hasOrderData) return null;
  let total = ORDER_PRICING.baseFee;
  const vitamins = (admin.additivesVitamins ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const meds = (admin.additivesMedications ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (vitamins.some((v) => v === EXTRA_500_ML_OPTION)) total += ORDER_PRICING.extraFluidFee;
  ADDITIVES_MEDICATIONS_OPTIONS.forEach((m) => {
    if (meds.includes(m)) total += ORDER_PRICING.medicationFee;
  });
  return total;
}

function formatDate(dateString: string) {
  const date = parseLocalDate(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(isoString: string) {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length < 10) return phone;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
}

export default function PublicSummaryPage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<{ encounter: Encounter; patient: Patient | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError("Invalid link");
      return;
    }
    fetch(`/api/summary/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "Summary not found or link expired" : "Failed to load");
        return res.json();
      })
      .then((payload) => {
        // API returns { encounter, patient }; normalize in case of different shape
        const encounter = payload?.encounter ?? payload;
        const patient = payload?.patient ?? null;
        if (!encounter || typeof encounter !== "object") {
          setError("Invalid summary data");
          return;
        }
        setData({ encounter, patient });
      })
      .catch((e) => setError(e.message || "Failed to load summary"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-8">
        <p className="text-gray-600 dark:text-gray-400">Loading your visit summary…</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error ?? "Summary not found"}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">This link may have expired. Contact the office for a new link.</p>
        </div>
      </div>
    );
  }

  const { encounter, patient } = data;
  const admin = encounter.administration && typeof encounter.administration === "object" ? encounter.administration as Administration : undefined;
  const revenueNum = encounter.revenue != null ? Number(encounter.revenue) : NaN;
  const displayCost =
    Number.isFinite(revenueNum) && revenueNum > 0
      ? revenueNum
      : computeOrderCostFromAdmin(admin);
  const pn = encounter.providerNote;
  const pnText = typeof pn === "string" ? pn : (pn && typeof pn === "object" && "content" in pn ? String((pn as { content?: string }).content ?? "") : "");
  const dc = encounter.discharge;
  const dcInstructions = typeof dc === "string" ? dc : (dc && typeof dc === "object" && "instructions" in dc ? String((dc as { instructions?: string }).instructions ?? "") : "");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800 print-summary">
          <div className="print-header-block border-b border-gray-200 pb-4 dark:border-gray-700">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Visit Summary</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">RevIVe Hydration and Recovery</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">Secure link — this page is only your visit summary. It does not provide access to any other part of the clinic system.</p>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              {(encounter.date || encounter.createdAt?.slice(0, 10)) ? formatDate(encounter.date || encounter.createdAt?.slice(0, 10) || "") : "—"} · {encounter.time ?? ""}
            </p>
          </div>

          {encounter.status === "cancelled" && (
            <section className="mt-4 rounded-lg border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-900/20">
              <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200 uppercase tracking-wide">Visit cancelled</h2>
              <p className="mt-2 text-sm text-amber-800 dark:text-amber-300 font-medium">This visit was cancelled and did not take place.</p>
              {encounter.cancellationReason && (
                <p className="mt-2 text-sm text-amber-800 dark:text-amber-300"><strong>Reason:</strong> {encounter.cancellationReason}</p>
              )}
              {(encounter.cancelledBy || encounter.cancelledAt) && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  {encounter.cancelledBy && <span>Cancelled by {encounter.cancelledBy}</span>}
                  {encounter.cancelledBy && encounter.cancelledAt && " · "}
                  {encounter.cancelledAt && <span>{formatDateTime(encounter.cancelledAt)}</span>}
                </p>
              )}
            </section>
          )}

          <section className="mt-4 border-b border-gray-200 pb-4 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Patient</h2>
            <p className="mt-1 font-medium text-gray-900 dark:text-white">{encounter.patientName ?? "—"}</p>
            {patient && (
              <div className="mt-2 grid grid-cols-1 gap-1 text-sm text-gray-600 dark:text-gray-400 sm:grid-cols-2">
                <span>DOB: {formatDate(patient.dob)}</span>
                <span>Phone: {patient.phone ? formatPhone(patient.phone) : "—"}</span>
                {patient.allergies?.length ? (
                  <span className="sm:col-span-2 text-red-600 dark:text-red-400">
                    Allergies: {patient.allergies.map((a) => a.allergen).join(", ")}
                  </span>
                ) : null}
              </div>
            )}
          </section>

          {encounter.intake && (encounter.intake.chiefComplaint || encounter.intake.historyOfPresentIllness) && (
            <section className="mt-4 border-b border-gray-200 pb-4 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Intake</h2>
              <div className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
                {encounter.intake.chiefComplaint && <p><strong>Chief complaint:</strong> {encounter.intake.chiefComplaint}</p>}
                {encounter.intake.historyOfPresentIllness && <p><strong>HPI:</strong> {encounter.intake.historyOfPresentIllness}</p>}
              </div>
            </section>
          )}

          {Array.isArray(encounter.vitals) && encounter.vitals.length > 0 && (
            <section className="mt-4 border-b border-gray-200 pb-4 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Vital signs</h2>
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-600">
                      <th className="py-1 text-left font-medium text-gray-700 dark:text-gray-300">Time</th>
                      <th className="py-1 text-left font-medium text-gray-700 dark:text-gray-300">BP</th>
                      <th className="py-1 text-left font-medium text-gray-700 dark:text-gray-300">HR</th>
                      <th className="py-1 text-left font-medium text-gray-700 dark:text-gray-300">Temp</th>
                      <th className="py-1 text-left font-medium text-gray-700 dark:text-gray-300">O2</th>
                      <th className="py-1 text-left font-medium text-gray-700 dark:text-gray-300">RR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...encounter.vitals]
                      .sort((a, b) => new Date((a as { timestamp?: string }).timestamp ?? 0).getTime() - new Date((b as { timestamp?: string }).timestamp ?? 0).getTime())
                      .map((v: Vital, i: number) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                          <td className="py-1 text-gray-600 dark:text-gray-400">{v.timestamp ? formatDateTime(v.timestamp) : "—"}</td>
                          <td className="py-1">{String(v.bloodPressure ?? "—")}</td>
                          <td className="py-1">{String(v.heartRate ?? "—")}</td>
                          <td className="py-1">{String(v.temperature ?? "—")}</td>
                          <td className="py-1">{String(v.oxygenSaturation ?? "—")}</td>
                          <td className="py-1">{String(v.respiratoryRate ?? "—")}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {encounter.ivAccess && (encounter.ivAccess.site || encounter.ivAccess.gauge || encounter.ivAccess.dateTime) && (
            <section className="mt-4 border-b border-gray-200 pb-4 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">IV access</h2>
              <div className="mt-2 grid grid-cols-1 gap-1 text-sm text-gray-700 dark:text-gray-300 sm:grid-cols-2">
                {(encounter.ivAccess as { site?: string }).site && <span><strong>Site:</strong> {(encounter.ivAccess as { site?: string }).site}</span>}
                {(encounter.ivAccess as { gauge?: string }).gauge && <span><strong>Gauge:</strong> {(encounter.ivAccess as { gauge?: string }).gauge}</span>}
                {(encounter.ivAccess as { dateTime?: string }).dateTime && <span><strong>Date/Time:</strong> {formatDateTime((encounter.ivAccess as { dateTime?: string }).dateTime!)}</span>}
                {(encounter.ivAccess as { notes?: string }).notes && <span className="sm:col-span-2"><strong>Notes:</strong> {(encounter.ivAccess as { notes?: string }).notes}</span>}
              </div>
            </section>
          )}

          <section className="mt-4 border-b border-gray-200 pb-4 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Administration</h2>
            <div className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
              {admin?.fluidType ? <p><strong>Fluid:</strong> {admin.fluidType}</p> : <p><strong>Fluid:</strong> —</p>}
              <p><strong>Volume/Rate:</strong> {admin?.volume ?? "—"} mL {admin?.rate ? `@ ${admin.rate} mL/hr` : ""}</p>
              {(admin?.startTime || admin?.endTime) ? (
                <p><strong>Infusion time:</strong> {admin.startTime ? formatDateTime(admin.startTime) : "—"} – {admin.endTime ? formatDateTime(admin.endTime) : "—"}</p>
              ) : (
                <p><strong>Infusion time:</strong> —</p>
              )}
              {admin?.complications ? <p><strong>Complications:</strong> {admin.complications}</p> : null}
              {(admin?.toleranceOption || admin?.tolerance) ? (
                <p>
                  <strong>Patient tolerated:</strong>{" "}
                  {admin.toleranceOption === "tolerated_well" && "Tolerated well"}
                  {admin.toleranceOption === "tolerated_complications" && "Tolerated but complications"}
                  {admin.toleranceOption === "unable_to_tolerate" && "Unable to tolerate"}
                  {admin.tolerance ? ` — ${admin.tolerance}` : ""}
                </p>
              ) : null}
            </div>
          </section>

          {(pnText || dcInstructions) && (
            <section className="mt-4 border-b border-gray-200 pb-4 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Provider note & discharge</h2>
              {pnText && <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{pnText}</p>}
              {dcInstructions && <p className="mt-2 text-sm text-gray-700 dark:text-gray-300"><strong>Discharge:</strong> {dcInstructions}</p>}
            </section>
          )}

          <section className="mt-4 print-cost-box border border-gray-200 rounded-lg p-4 dark:border-gray-600">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Visit cost</h2>
            <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white print-cost-amount">
              {(displayCost != null && Number(displayCost) > 0)
                ? `$${Number(displayCost).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : "No amount specified for this visit."}
            </p>
          </section>

          <p className="print-footer mt-6 text-right text-xs text-gray-500 dark:text-gray-400">
            RevIVe Hydration and Recovery · Secure link · You can print this page for your records. This link shows only your summary and does not access the clinic system.
          </p>
        </div>
        <div className="mt-6 no-print">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Print / Save as PDF
          </button>
        </div>
      </div>
    </div>
  );
}

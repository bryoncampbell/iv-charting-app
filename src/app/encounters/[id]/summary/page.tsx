"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Encounter, Patient, Administration } from "@/types";
import { logAudit } from "@/lib/audit";
import { parseLocalDate } from "@/lib/dates";
import { newId, nowIso } from "@/lib/ids";
import { STORAGE_KEYS } from "@/lib/storage";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { encounterRowToEncounter, encounterToRow, patientRowToPatient } from "@/lib/supabaseMappers";

/** Same pricing as encounter order request — used when encounter.revenue was not persisted */
const ORDER_PRICING = {
  baseFee: 180,
  medicationFee: 30,
  extraFluidFee: 20,
} as const;
const EXTRA_500_ML_OPTION = "Extra 500 mL of Hydration";
const ADDITIVES_MEDICATIONS_OPTIONS = ["Zofran", "Toradol"];

function computeOrderCostFromAdmin(admin: Administration | undefined): number | null {
  if (!admin) return null;
  // Compute when we have order data (fluid/volume/rate) or order was approved
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

export default function VisitSummaryPage() {
  const params = useParams();
  const encounterId = params.id as string;
  const printRef = useRef<HTMLDivElement>(null);

  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const summaryViewLogged = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "addendum">("summary");
  const [addenda, setAddenda] = useState<{ id: string; createdAt: string; authorName: string; text: string }[]>([]);
  const [newAddendum, setNewAddendum] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (isSupabaseConfigured() && supabase) {
      (async () => {
        const { data: row, error } = await supabase
          .from("encounters")
          .select("*")
          .eq("id", encounterId)
          .single();
        if (cancelled || error || !row) {
          setIsLoading(false);
          return;
        }
        const found = encounterRowToEncounter(row);
        setEncounter(found);
        setAddenda(found.addenda ?? []);
        if (summaryViewLogged.current !== encounterId) {
          summaryViewLogged.current = encounterId;
          logAudit("encounter.summary.view", "encounter", encounterId, found.patientName ?? undefined);
        }
        const { data: patientRow } = await supabase
          .from("patients")
          .select("*")
          .eq("id", found.patientId)
          .single();
        if (!cancelled && patientRow) setPatient(patientRowToPatient(patientRow));
        setIsLoading(false);
      })().catch(() => setIsLoading(false));
      return () => { cancelled = true; };
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.encounters);
      if (stored) {
        const encounters: Encounter[] = JSON.parse(stored);
        const found = encounters.find((e) => e.id === encounterId);
        if (found) {
          setEncounter(found);
          setAddenda(found.addenda ?? []);
          if (summaryViewLogged.current !== encounterId) {
            summaryViewLogged.current = encounterId;
            logAudit("encounter.summary.view", "encounter", encounterId, found.patientName ?? undefined);
          }
          const patientsStored = localStorage.getItem(STORAGE_KEYS.patients);
          if (patientsStored) {
            const patients: Patient[] = JSON.parse(patientsStored);
            setPatient(patients.find((p) => p.id === found.patientId) ?? null);
          }
        }
      }
    } catch (e) {
      console.error("Error loading encounter for summary:", e);
    }
    setIsLoading(false);
  }, [encounterId]);

  function saveEncounterAddenda(nextAddenda: { id: string; createdAt: string; authorName: string; text: string }[]) {
    if (!encounter) return;
    const merged: Encounter = { ...encounter, updatedAt: nowIso(), addenda: nextAddenda };
    if (isSupabaseConfigured() && supabase) {
      supabase
        .from("encounters")
        .upsert(encounterToRow(merged), { onConflict: "id" })
        .then(({ error }) => {
          if (error) console.error("Error saving addenda to Supabase:", error);
          else setEncounter(merged);
        });
      return;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.encounters);
      if (!stored) return;
      const encounters: Encounter[] = JSON.parse(stored);
      const next = encounters.map((e) => (e.id === encounter.id ? merged : e));
      localStorage.setItem(STORAGE_KEYS.encounters, JSON.stringify(next));
      setEncounter(merged);
    } catch (e) {
      console.error("Error saving addenda:", e);
    }
  }

  const handleAddAddendum = () => {
    if (!newAddendum.trim()) return;
    const entry = { id: newId(), createdAt: nowIso(), authorName: "User", text: newAddendum.trim() };
    const next = [...addenda, entry];
    setAddenda(next);
    setNewAddendum("");
    saveEncounterAddenda(next);
  };

  const handleRemoveAddendum = (id: string) => {
    const next = addenda.filter((a) => a.id !== id);
    setAddenda(next);
    saveEncounterAddenda(next);
  };

  const handlePrint = () => {
    if (encounter) {
      logAudit("encounter.summary.print", "encounter", encounter.id, encounter.patientName ?? undefined);
    }
    window.print();
  };

  const revenueVal = encounter?.revenue != null ? Number(encounter.revenue) : NaN;
  const displayCost = encounter
    ? (Number.isFinite(revenueVal) && revenueVal > 0
        ? revenueVal
        : computeOrderCostFromAdmin(encounter.administration))
    : null;

  const [shareSending, setShareSending] = useState(false);

  const handleTextLinkToPatient = async () => {
    if (!encounter) return;
    const cell = patient?.cellPhone?.trim() || patient?.phone?.trim();
    if (!cell) {
      alert("Patient has no cell phone number on file. Add a cell phone in the patient profile to text a link.");
      return;
    }
    setShareSending(true);
    try {
      // Deep clone so all nested fields (administration, providerNote, discharge, revenue, etc.) are plain objects and serialize
      const payload = {
        encounter: JSON.parse(JSON.stringify(encounter)),
        patient: patient ? JSON.parse(JSON.stringify(patient)) : null,
        patientCellPhone: cell,
      };
      const res = await fetch("/api/share-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!result.ok) {
        throw new Error(result.error || "Failed to create link");
      }
      const { url, smsSent } = result;
      logAudit("encounter.summary.text_link", "encounter", encounter.id, encounter.patientName ?? undefined);
      if (smsSent) {
        alert("A secure link to this visit summary has been sent to the patient's cell phone.");
      } else {
        const message = `Your RevIVe visit summary is ready. View it here (secure link): ${url}`;
        const digits = cell.replace(/\D/g, "");
        const smsNumber = digits.length === 11 && digits.startsWith("1") ? digits : digits.length === 10 ? `1${digits}` : digits;
        const smsUrl = `sms:+${smsNumber}?body=${encodeURIComponent(message)}`;
        window.location.href = smsUrl;
      }
    } catch (e) {
      console.error("Share summary error:", e);
      alert("Could not create share link. You can still print or save as PDF and share manually.");
    } finally {
      setShareSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!encounter) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Encounter Not Found
          </h1>
          <Link href="/visits" className="text-blue-600 dark:text-blue-400">
            ← Back to Visits
          </Link>
        </div>
      </div>
    );
  }

  const admin = encounter.administration;
  const intake = encounter.intake;
  const iv = encounter.ivAccess;
  const vitals = encounter.vitals || [];

  return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Actions - hidden when printing */}
          <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/visits"
              className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              ← Back to Visits
            </Link>
            <div className="flex items-center gap-3 no-print">
              <nav className="flex rounded-lg border border-gray-200 dark:border-gray-600 p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("summary")}
                  className={`rounded-md px-3 py-2 text-sm font-medium ${
                    activeTab === "summary"
                      ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                  }`}
                >
                  Summary
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("addendum")}
                  className={`rounded-md px-3 py-2 text-sm font-medium ${
                    activeTab === "addendum"
                      ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                  }`}
                >
                  Addendum
                </button>
              </nav>
              {activeTab === "summary" && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handlePrint}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
                  >
                    Print / PDF
                  </button>
                  <button
                    type="button"
                    onClick={handleTextLinkToPatient}
                    disabled={shareSending}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    {shareSending ? "Creating link…" : "Text link to patient"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {activeTab === "addendum" ? (
            <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Addendum</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Add a note or correction to this completed visit record.</p>
              <div className="flex gap-2 mb-6">
                <textarea
                  value={newAddendum}
                  onChange={(e) => setNewAddendum(e.target.value)}
                  rows={3}
                  placeholder="Add addendum..."
                  className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleAddAddendum}
                  disabled={!newAddendum.trim()}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
              {addenda.length > 0 ? (
                <ul className="space-y-2">
                  {addenda
                    .slice()
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((a) => (
                      <li key={a.id} className="rounded border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-600 dark:bg-gray-800">
                        <span className="text-gray-500 dark:text-gray-400">{a.authorName} · {formatDateTime(a.createdAt)}</span>
                        <p className="mt-1 text-gray-900 dark:text-white">{a.text}</p>
                        <button
                          type="button"
                          onClick={() => handleRemoveAddendum(a.id)}
                          className="mt-2 text-xs text-red-600 dark:text-red-400 hover:underline"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No addenda yet.</p>
              )}
            </div>
          ) : (
          <div ref={printRef} className="print-summary max-h-[calc(100vh-12rem)] overflow-y-auto rounded-lg bg-white p-8 shadow dark:bg-gray-800 print:max-h-none print:overflow-visible print:shadow-none">
            {/* Header — full width, prominent for print */}
            <div className="print-header-block border-b border-gray-200 pb-6 dark:border-gray-700">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Visit Summary
                  </h1>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    RevIVe Hydration and Recovery
                  </p>
                </div>
                <div className="text-right text-sm text-gray-600 dark:text-gray-400">
                  <p className="font-medium text-gray-900 dark:text-white">{encounter.patientName}</p>
                  <p>{formatDate(encounter.date ?? encounter.createdAt?.slice(0, 10) ?? "")} · {encounter.time ?? ""}</p>
                </div>
              </div>
            </div>

            {/* Two-column layout when printing — sections flow into columns */}
            <div className="print-grid-2">

            {/* Declined to treat — show when visit was declined by provider */}
            {encounter.status === "declined" && (
              <section className="mt-6 border-b border-red-200 pb-6 dark:border-red-800">
                <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">
                  Visit status: Declined to treat
                </h2>
                <div className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <p>
                    <strong>Declined by:</strong> {encounter.declinedToTreatBy ?? "Provider"}
                    {encounter.declinedToTreatAt ? ` on ${formatDateTime(encounter.declinedToTreatAt)}` : ""}
                  </p>
                  <p>
                    <strong>Reason:</strong> {encounter.declinedToTreatReason?.trim() || "No reason provided."}
                  </p>
                  {encounter.declineAcknowledgedAt && encounter.declineAcknowledgedBy && (
                    <p className="pt-2 text-gray-600 dark:text-gray-400">
                      Acknowledged and closed by {encounter.declineAcknowledgedBy} on {formatDateTime(encounter.declineAcknowledgedAt)}.
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Visit cancelled — show when visit was cancelled */}
            {encounter.status === "cancelled" && (
              <section className="mt-6 border-b border-amber-200 pb-6 dark:border-amber-800">
                <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200">
                  Visit status: Cancelled
                </h2>
                <div className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <p>
                    <strong>Cancelled by:</strong> {encounter.cancelledBy ?? "—"}
                    {encounter.cancelledAt ? ` on ${formatDateTime(encounter.cancelledAt)}` : ""}
                  </p>
                  <p>
                    <strong>Reason:</strong> {encounter.cancellationReason?.trim() || "No reason provided."}
                  </p>
                </div>
              </section>
            )}

            {/* Patient — name already in header for print */}
            <section className="mt-6 border-b border-gray-200 pb-6 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Patient
              </h2>
              {patient ? (
                <div className="mt-1 grid grid-cols-1 gap-1 text-sm text-gray-600 dark:text-gray-400 sm:grid-cols-2">
                  <span>DOB: {formatDate(patient.dob)}</span>
                  <span>Phone: {patient.phone ? formatPhone(patient.phone) : "—"}</span>
                  {patient.allergies && patient.allergies.length > 0 && (
                    <span className="sm:col-span-2 text-red-600 dark:text-red-400">
                      Allergies: {patient.allergies.map((a) => a.allergen).join(", ")}
                    </span>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{encounter.patientName}</p>
              )}
            </section>

            {/* Treatment */}
            {(encounter.treatment || encounter.notes) && (
              <section className="mt-6 border-b border-gray-200 pb-6 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Treatment
                </h2>
                {encounter.treatment && (
                  <p className="mt-1 text-gray-700 dark:text-gray-300">
                    {encounter.treatment}
                  </p>
                )}
                {encounter.notes && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {encounter.notes}
                  </p>
                )}
              </section>
            )}

            {/* Intake */}
            {intake && (intake.chiefComplaint || intake.historyOfPresentIllness || intake.medications || intake.pastMedicalHistory || (patient?.currentMedications?.length ?? 0) > 0 || (patient?.pastMedicalHistory?.length ?? 0) > 0) && (
              <section className="mt-6 border-b border-gray-200 pb-6 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Intake
                </h2>
                <div className="mt-2 space-y-3 text-sm text-gray-700 dark:text-gray-300">
                  {intake.chiefComplaint && (
                    <div>
                      <span className="font-medium">Chief Complaint: </span>
                      {intake.chiefComplaint}
                    </div>
                  )}
                  {intake.historyOfPresentIllness && (
                    <div>
                      <span className="font-medium">HPI: </span>
                      {intake.historyOfPresentIllness}
                    </div>
                  )}
                  {((patient?.currentMedications?.length ?? 0) > 0 || intake.medications) && (
                    <div>
                      <span className="font-medium">Medications: </span>
                      {(patient?.currentMedications?.length ?? 0) > 0
                        ? (patient?.currentMedications ?? []).join(", ")
                        : intake.medications}
                    </div>
                  )}
                  {((patient?.pastMedicalHistory?.length ?? 0) > 0 || intake.pastMedicalHistory) && (
                    <div>
                      <span className="font-medium">PMH: </span>
                      {(patient?.pastMedicalHistory?.length ?? 0) > 0
                        ? (patient?.pastMedicalHistory ?? []).join(", ")
                        : intake.pastMedicalHistory}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Vitals */}
            {vitals.length > 0 && (
              <section className="mt-6 border-b border-gray-200 pb-6 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Vital Signs
                </h2>
                <div className="mt-2 overflow-x-auto">
                  <table className="print-vitals-table min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-600">
                        <th className="py-2 text-left font-medium text-gray-700 dark:text-gray-300">Time</th>
                        <th className="py-2 text-left font-medium text-gray-700 dark:text-gray-300">BP</th>
                        <th className="py-2 text-left font-medium text-gray-700 dark:text-gray-300">HR</th>
                        <th className="py-2 text-left font-medium text-gray-700 dark:text-gray-300">Temp</th>
                        <th className="py-2 text-left font-medium text-gray-700 dark:text-gray-300">O2</th>
                        <th className="py-2 text-left font-medium text-gray-700 dark:text-gray-300">RR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vitals
                        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                        .map((v) => (
                          <tr key={v.id} className="border-b border-gray-100 dark:border-gray-700">
                            <td className="py-2 text-gray-600 dark:text-gray-400">{formatDateTime(v.timestamp)}</td>
                            <td className="py-2">{v.bloodPressure || "—"}</td>
                            <td className="py-2">{v.heartRate || "—"}</td>
                            <td className="py-2">{v.temperature || "—"}</td>
                            <td className="py-2">{v.oxygenSaturation || "—"}</td>
                            <td className="py-2">{v.respiratoryRate || "—"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* IV Access */}
            {iv && (iv.site || iv.gauge || iv.dateTime || iv.notes) && (
              <section className="mt-6 border-b border-gray-200 pb-6 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  IV Access
                </h2>
                <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-gray-700 dark:text-gray-300 sm:grid-cols-2">
                  {iv.site && <span><strong>Site:</strong> {iv.site}</span>}
                  {iv.gauge && <span><strong>Gauge:</strong> {iv.gauge}</span>}
                  {iv.dateTime && <span><strong>Date/Time:</strong> {formatDateTime(iv.dateTime)}</span>}
                  {iv.notes && <span className="sm:col-span-2"><strong>Notes:</strong> {iv.notes}</span>}
                </div>
              </section>
            )}

            {/* Administration */}
            {admin && (admin.fluidType || admin.volume || admin.rate || admin.startTime || admin.additivesVitamins || admin.additivesMedications || admin.complications || admin.toleranceOption || admin.tolerance) && (
              <section className="mt-6 border-b border-gray-200 pb-6 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Administration
                </h2>
                <div className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  {admin.orderApprovedBy && <p><strong>Order approved by:</strong> {admin.orderApprovedBy}{admin.orderApprovedAt ? ` on ${formatDateTime(admin.orderApprovedAt)}` : ""}</p>}
                  {admin.fluidType && <p><strong>Fluid:</strong> {admin.fluidType}</p>}
                  {(admin.volume || admin.rate) && (
                    <p><strong>Volume/Rate:</strong> {admin.volume || "—"} mL {admin.rate ? `@ ${admin.rate} mL/hr` : ""}</p>
                  )}
                  {admin.additivesVitamins && <p><strong>Vitamins:</strong> {admin.additivesVitamins}</p>}
                  {admin.additivesMedications && <p><strong>Medications:</strong> {admin.additivesMedications}</p>}
                  {admin.notes && <p><strong>Order notes:</strong> {admin.notes}</p>}
                  {(admin.startTime || admin.endTime) && (
                    <p><strong>Infusion time:</strong> {admin.startTime ? formatDateTime(admin.startTime) : "—"} – {admin.endTime ? formatDateTime(admin.endTime) : "—"}</p>
                  )}
                  {admin.complications && <p><strong>Complications:</strong> {admin.complications}</p>}
                  {(admin.toleranceOption || admin.tolerance) && (
                    <p>
                      <strong>Patient tolerated:</strong>{" "}
                      {admin.toleranceOption === "tolerated_well" && "Tolerated well"}
                      {admin.toleranceOption === "tolerated_complications" && "Tolerated but complications"}
                      {admin.toleranceOption === "unable_to_tolerate" && "Unable to tolerate"}
                      {admin.toleranceOption && (admin.tolerance ?? "").trim() ? " — " : ""}
                      {(admin.tolerance ?? "").trim() || ""}
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Provider & Discharge */}
            {(() => {
              const pn = encounter.providerNote;
              const pnText = typeof pn === "string" ? pn : pn?.content;
              const dc = encounter.discharge;
              const dcInstructions = typeof dc === "string" ? dc : dc?.instructions;
              const dcFollowUp = typeof dc === "object" && dc ? dc.followUp : undefined;
              if (!pnText && !dcInstructions && !dcFollowUp) return null;
              return (
                <section className="mt-6 border-b border-gray-200 pb-6 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Provider Note & Discharge
                  </h2>
                  {pnText && <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{pnText}</p>}
                  {(dcInstructions || dcFollowUp) && (
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                      <strong>Discharge:</strong> {dcInstructions ?? ""}
                      {dcFollowUp ? ` Follow-up: ${dcFollowUp}` : ""}
                    </p>
                  )}
                </section>
              );
            })()}

            {/* Sign-off Information */}
            {(encounter.nursingSignedBy || encounter.providerSignedBy) && (
              <section className="mt-6 border-b border-gray-200 pb-6 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Sign-off
                </h2>
                <div className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
                  {encounter.nursingSignedBy && (encounter.nursingSignedAt ?? (encounter as { nursingCompleteAt?: string }).nursingCompleteAt) && (
                    <p>
                      <strong>Nursing Complete:</strong> {encounter.nursingSignedBy} on {formatDateTime(encounter.nursingSignedAt ?? (encounter as { nursingCompleteAt?: string }).nursingCompleteAt ?? "")}
                    </p>
                  )}
                  {encounter.providerSignedBy && encounter.providerSignedAt && (
                    <p>
                      <strong>Provider Signed:</strong> {encounter.providerSignedBy} on {formatDateTime(encounter.providerSignedAt)}
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Addendum (includes legacy amendments/addendum) */}
            {(() => {
              const addenda = encounter.addenda ?? [
                ...((encounter as { amendments?: { id: string; timestamp?: string; createdAt?: string; content?: string; text?: string; authorName?: string }[] }).amendments ?? []),
                ...((encounter as { addendum?: { id: string; timestamp?: string; createdAt?: string; content?: string; text?: string; authorName?: string }[] }).addendum ?? []),
              ];
              if (addenda.length === 0) return null;
              const getCreatedAt = (a: (typeof addenda)[number]) => (a as { createdAt?: string }).createdAt ?? (a as { timestamp?: string }).timestamp ?? "";
              const getText = (a: (typeof addenda)[number]) => (a as { text?: string }).text ?? (a as { content?: string }).content ?? "";
              const getAuthor = (a: (typeof addenda)[number]) => (a as { authorName?: string }).authorName ?? "—";
              return (
                <section className="mt-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Addendum
                  </h2>
                  <ul className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    {[...addenda]
                      .sort((a, b) => new Date(getCreatedAt(b)).getTime() - new Date(getCreatedAt(a)).getTime())
                      .map((a) => (
                        <li key={a.id}>
                          <span className="text-gray-500 dark:text-gray-400">{getAuthor(a)} · {formatDateTime(getCreatedAt(a))}</span>
                          {" — "}{getText(a)}
                        </li>
                      ))}
                  </ul>
                </section>
              );
            })()}

            {/* Visit cost — included in print/PDF and email; use encounter.revenue or compute from order */}
            <section className="mt-6 border-b border-gray-200 pb-6 dark:border-gray-700 print-cost-box">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Visit cost
              </h2>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 print-cost-amount">
                {displayCost != null && Number(displayCost) > 0
                  ? `Amount for this visit: $${Number(displayCost).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : "No amount specified for this visit."}
              </p>
            </section>
            </div>
            {/* end print-grid-2 */}

            <p className="print-footer mt-8 text-right text-xs text-gray-500 dark:text-gray-400">
              Generated from RevIVe Hydration and Recovery · Visit ID: {encounter.id}
            </p>
          </div>
          )}
        </div>
      </div>
  );
}

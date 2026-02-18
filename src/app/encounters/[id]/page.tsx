"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Administration, Encounter, Patient, Vital } from "@/types";
import { getPatientDisplayName } from "@/types";
import { logAudit } from "@/lib/audit";
import { newId, nowIso } from "@/lib/ids";
import { STORAGE_KEYS } from "@/lib/storage";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { encounterRowToEncounter, encounterToRow, patientRowToPatient, patientToRow } from "@/lib/supabaseMappers";
import { useAuth } from "@/contexts/AuthContext";

const IV_SITES = [
  { value: "", label: "Select site..." },
  { value: "Left hand", label: "Left hand" },
  { value: "Right hand", label: "Right hand" },
  { value: "Left AC", label: "Left AC" },
  { value: "Right AC", label: "Right AC" },
  { value: "Left forearm", label: "Left forearm" },
  { value: "Right forearm", label: "Right forearm" },
  { value: "Left wrist", label: "Left wrist" },
  { value: "Right wrist", label: "Right wrist" },
  { value: "Other", label: "Other" },
];

const IV_GAUGES = [
  { value: "", label: "Select size..." },
  { value: "14G", label: "14G" },
  { value: "16G", label: "16G" },
  { value: "18G", label: "18G" },
  { value: "20G", label: "20G" },
  { value: "22G", label: "22G" },
  { value: "24G", label: "24G" },
];

const IV_FLUIDS = [
  { value: "", label: "Select fluid..." },
  { value: "Normal Saline (NS)", label: "Normal Saline (NS)" },
  { value: "Lactated Ringer's (LR)", label: "Lactated Ringer's (LR)" },
  { value: "D5W", label: "D5W" },
  { value: "D5NS", label: "D5NS" },
  { value: "D5½NS", label: "D5½NS" },
  { value: "D5LR", label: "D5LR" },
  { value: "D10W", label: "D10W" },
  { value: "½ Normal Saline", label: "½ Normal Saline" },
  { value: "Plasma-Lyte", label: "Plasma-Lyte" },
  { value: "Other", label: "Other" },
];

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

/** Pricing menu for requested order */
const PRICING = {
  baseFee: 180, // IV placement and hydration service flat fee
  medicationFee: 30, // per medication (Zofran, Toradol)
  extraFluidFee: 20, // Extra 500 mL of Hydration
} as const;
const EXTRA_500_ML_OPTION = "Extra 500 mL of Hydration";

/** Normalize administration for Encounter type (toleranceOption must be one of three literals or undefined). */
function normalizeAdministration(admin: Partial<Omit<Administration, "toleranceOption">> & { toleranceOption?: string }): Administration {
  const tol = admin.toleranceOption;
  return {
    ...admin,
    toleranceOption:
      tol === "tolerated_well" || tol === "tolerated_complications" || tol === "unable_to_tolerate"
        ? tol
        : undefined,
  } as Administration;
}

/** Out-of-range thresholds for vital signs (red highlight) */
function isSystolicOutOfRange(n: number): boolean {
  return n < 90 || n > 160;
}
function isDiastolicOutOfRange(n: number): boolean {
  return n < 50 || n > 99;
}
function isBloodPressureOutOfRange(bp: string | undefined): boolean {
  if (!bp?.trim()) return false;
  const [s, d] = bp.split("/").map((s) => parseInt(s.trim(), 10));
  return (Number.isFinite(s) && isSystolicOutOfRange(s)) || (Number.isFinite(d) && isDiastolicOutOfRange(d));
}
function isHeartRateOutOfRange(hr: string | undefined): boolean {
  const n = parseInt(String(hr).replace(/\D/g, ""), 10);
  return Number.isFinite(n) && (n < 50 || n > 120);
}
function isRespiratoryRateOutOfRange(rr: string | undefined): boolean {
  const n = parseInt(String(rr).replace(/\D/g, ""), 10);
  return Number.isFinite(n) && (n < 8 || n > 20);
}
function isTemperatureOutOfRange(temp: string | undefined): boolean {
  const n = parseFloat(String(temp).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 100.4;
}
function isO2OutOfRange(o2: string | undefined): boolean {
  const n = parseInt(String(o2).replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n < 94;
}

const NURSE_TAB_IDS = ["intake", "vitals", "iv-access", "order-request", "administration"] as const;
type NurseTabId = (typeof NURSE_TAB_IDS)[number];
type Tab = NurseTabId | "provider" | "addendum";

const ROLE_STORAGE_KEY_NURSE = "revive_current_nurse_name";
const ROLE_STORAGE_KEY_PROVIDER = "revive_current_provider_name";

type Role = "nurse" | "provider";

function profileRoleToUiRole(role: string | null): Role {
  if (role === "provider") return "provider";
  if (role === "nursing") return "nurse";
  return "nurse";
}

export default function EncounterPage() {
  const params = useParams();
  const router = useRouter();
  const auth = useAuth();
  const encounterId = params.id as string;

  const profileRole = auth?.role ?? null;
  const canSwitchRole = profileRole === "admin";
  const lockedRole = profileRole === "nursing" || profileRole === "provider" ? profileRoleToUiRole(profileRole) : null;

  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("intake");
  const [isLoading, setIsLoading] = useState(true);

  const [currentRoleState, setCurrentRoleState] = useState<Role>("nurse");
  const currentRole = lockedRole ?? currentRoleState;
  const setCurrentRole = (r: Role) => {
    if (canSwitchRole) setCurrentRoleState(r);
  };

  const [nurseName, setNurseName] = useState("");
  const [providerName, setProviderName] = useState("");

  useEffect(() => {
    if (lockedRole != null) {
      setCurrentRoleState(lockedRole);
      setActiveTab(lockedRole === "provider" ? "provider" : "intake");
    }
  }, [lockedRole]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setNurseName(localStorage.getItem(ROLE_STORAGE_KEY_NURSE) ?? "");
    setProviderName(localStorage.getItem(ROLE_STORAGE_KEY_PROVIDER) ?? "");
  }, []);

  // When signed in as provider, pre-fill "sign as" from profile display name if empty
  useEffect(() => {
    const displayName = auth?.profile?.display_name?.trim();
    if (lockedRole !== "provider" || !displayName) return;
    setProviderName((prev) => {
      if (prev.trim()) return prev;
      try {
        localStorage.setItem(ROLE_STORAGE_KEY_PROVIDER, displayName);
      } catch {}
      return displayName;
    });
  }, [lockedRole, auth?.profile?.display_name]);
  const persistNurseName = (name: string) => {
    setNurseName(name);
    try {
      localStorage.setItem(ROLE_STORAGE_KEY_NURSE, name);
    } catch {}
  };
  const persistProviderName = (name: string) => {
    setProviderName(name);
    try {
      localStorage.setItem(ROLE_STORAGE_KEY_PROVIDER, name);
    } catch {}
  };

  const [intake, setIntake] = useState({
    chiefComplaint: "",
    historyOfPresentIllness: "",
  });
  const [newMedication, setNewMedication] = useState("");
  const [newPastMedicalHistory, setNewPastMedicalHistory] = useState("");

  const [newVital, setNewVital] = useState({
    bloodPressureSystolic: "",
    bloodPressureDiastolic: "",
    heartRate: "",
    temperature: "",
    oxygenSaturation: "",
    respiratoryRate: "",
    notes: "",
  });
  const [vitals, setVitals] = useState<Vital[]>([]);

  const [ivAccess, setIvAccess] = useState({ site: "", gauge: "", dateTime: "", notes: "" });
  const defaultAdministration = {
    fluidType: "",
    volume: "",
    rate: "",
    additivesVitamins: "",
    additivesMedications: "",
    notes: "",
    startTime: "",
    endTime: "",
    complications: "",
    toleranceOption: "" as "" | "tolerated_well" | "tolerated_complications" | "unable_to_tolerate",
    tolerance: "",
    orderApprovedAt: "",
    orderApprovedBy: "",
    readyForDischargeAt: "",
    readyForDischargeBy: "",
  };
  const [administration, setAdministration] = useState(defaultAdministration);
  const [providerNote, setProviderNote] = useState("");
  const [discharge, setDischarge] = useState("");
  const [addenda, setAddenda] = useState<{ id: string; createdAt: string; authorName: string; text: string }[]>([]);
  const [newAddendum, setNewAddendum] = useState("");
  const [status, setStatus] = useState<Encounter["status"]>("in_progress");
  const [nursingSignedBy, setNursingSignedBy] = useState("");
  const [providerSignedBy, setProviderSignedBy] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [declineReasonInput, setDeclineReasonInput] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReasonInput, setCancellationReasonInput] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void loadEncounter();
  }, [encounterId]);

  async function loadEncounter(retry = false) {
    setLoadError(null);
    try {
      if (isSupabaseConfigured() && supabase) {
        const { data: row, error } = await supabase
          .from("encounters")
          .select("*")
          .eq("id", encounterId)
          .maybeSingle();
        if (error || !row) {
          if (!retry && !error) {
            await new Promise((r) => setTimeout(r, 1500));
            return loadEncounter(true);
          }
          setLoadError(error?.message ?? "No encounter returned. Fix: In Supabase Dashboard go to SQL Editor → New query, paste and run the contents of supabase/rls-policies.sql from this repo (allows anon to read/write encounters).");
          setIsLoading(false);
          return;
        }
        const found = encounterRowToEncounter(row);
        setEncounter(found);
        setStatus(found.status ?? "in_progress");
        setIntake({
          chiefComplaint: found.intake?.chiefComplaint ?? "",
          historyOfPresentIllness: found.intake?.historyOfPresentIllness ?? "",
        });
        setVitals(found.vitals ?? []);
        setIvAccess({
          site: found.ivAccess?.site ?? "",
          gauge: found.ivAccess?.gauge ?? "",
          dateTime: found.ivAccess?.dateTime ?? "",
          notes: found.ivAccess?.notes ?? "",
        });
        const admin = found.administration;
        setAdministration(admin ? { ...defaultAdministration, ...admin } : defaultAdministration);
        setProviderNote(found.providerNote?.content ?? "");
        setDischarge(found.discharge?.instructions ?? "");
        setAddenda(found.addenda ?? []);
        setNursingSignedBy(found.nursingSignedBy ?? "");
        setProviderSignedBy(found.providerSignedBy ?? "");

        const { data: patientRow } = await supabase
          .from("patients")
          .select("*")
          .eq("id", found.patientId)
          .maybeSingle();
        setPatient(patientRow ? patientRowToPatient(patientRow) : null);
        setIsLoading(false);
        return;
      }

      const stored = localStorage.getItem(STORAGE_KEYS.encounters);
      if (stored) {
        const encounters: Encounter[] = JSON.parse(stored);
        const found = encounters.find((e) => e.id === encounterId);
        if (found) {
          setEncounter(found);
          setStatus(found.status ?? "in_progress");
          setIntake({
            chiefComplaint: found.intake?.chiefComplaint ?? "",
            historyOfPresentIllness: found.intake?.historyOfPresentIllness ?? "",
          });
          setVitals(found.vitals ?? []);
          setIvAccess({
            site: found.ivAccess?.site ?? "",
            gauge: found.ivAccess?.gauge ?? "",
            dateTime: found.ivAccess?.dateTime ?? "",
            notes: found.ivAccess?.notes ?? "",
          });
          const admin = found.administration;
          setAdministration(admin ? { ...defaultAdministration, ...admin } : defaultAdministration);
          setProviderNote(found.providerNote?.content ?? "");
          setDischarge(found.discharge?.instructions ?? "");
          setAddenda(found.addenda ?? []);
          setNursingSignedBy(found.nursingSignedBy ?? "");
          setProviderSignedBy(found.providerSignedBy ?? "");

          const patientsStored = localStorage.getItem(STORAGE_KEYS.patients);
          if (patientsStored) {
            const patients: Patient[] = JSON.parse(patientsStored);
            setPatient(patients.find((p) => p.id === found.patientId) ?? null);
          }
        }
      }
    } catch (e) {
      console.error("Error loading encounter:", e);
    }
    setIsLoading(false);
  }

  function saveEncounter(updates: Partial<Encounter> = {}): Promise<void> {
    if (!encounter) return Promise.resolve();
    const safeUpdates = { ...updates };
    if (safeUpdates.administration) {
      safeUpdates.administration = normalizeAdministration(safeUpdates.administration);
    }
    const adminForEncounter = normalizeAdministration(administration);
    const merged: Encounter = {
      ...encounter,
      updatedAt: nowIso(),
      intake: { ...encounter.intake, ...intake },
      vitals,
      ivAccess,
      administration: adminForEncounter,
      providerNote: { content: providerNote },
      discharge: { instructions: discharge },
      addenda,
      status,
      nursingSignedBy: encounter.nursingSignedBy ?? nursingSignedBy,
      providerSignedBy: encounter.providerSignedBy ?? providerSignedBy,
      ...safeUpdates,
    };

    if (isSupabaseConfigured() && supabase) {
      return Promise.resolve(
        supabase
          .from("encounters")
          .upsert(encounterToRow(merged), { onConflict: "id" })
          .then(({ error }) => {
            if (error) {
              console.error("Error saving encounter to Supabase:", error);
              return Promise.reject(error);
            }
            setEncounter(merged);
          })
      );
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.encounters);
      if (!stored) return Promise.resolve();
      const encounters: Encounter[] = JSON.parse(stored);
      const next = encounters.map((e) => (e.id === encounter.id ? merged : e));
      localStorage.setItem(STORAGE_KEYS.encounters, JSON.stringify(next));
      setEncounter(merged);
      return Promise.resolve();
    } catch (e) {
      console.error("Error saving encounter:", e);
      return Promise.resolve();
    }
  }

  function savePatient(updated: Patient) {
    if (isSupabaseConfigured() && supabase) {
      supabase
        .from("patients")
        .upsert(patientToRow(updated), { onConflict: "id" })
        .then(({ error }) => {
          if (error) console.error("Error saving patient to Supabase:", error);
          else setPatient(updated);
        });
      return;
    }
    const stored = localStorage.getItem(STORAGE_KEYS.patients);
    if (!stored) return;
    const patients: Patient[] = JSON.parse(stored);
    const next = patients.map((p) => (p.id === updated.id ? updated : p));
    localStorage.setItem(STORAGE_KEYS.patients, JSON.stringify(next));
    setPatient(updated);
  }

  const medications = patient?.currentMedications ?? [];
  const pastMedicalHistory = patient?.pastMedicalHistory ?? [];

  const handleIntakeChange = (field: "chiefComplaint" | "historyOfPresentIllness", value: string) => {
    const updated = { ...intake, [field]: value };
    setIntake(updated);
    setTimeout(() => saveEncounter({ intake: { ...encounter?.intake, ...updated } }), 300);
  };

  const handleAddMedication = () => {
    const name = newMedication.trim();
    if (!name || !patient) return;
    const next = [...medications, name];
    setNewMedication("");
    savePatient({ ...patient, currentMedications: next });
  };
  const handleRemoveMedication = (i: number) => {
    if (!patient) return;
    savePatient({ ...patient, currentMedications: medications.filter((_, idx) => idx !== i) });
  };
  const handleAddPMH = () => {
    const name = newPastMedicalHistory.trim();
    if (!name || !patient) return;
    const next = [...pastMedicalHistory, name];
    setNewPastMedicalHistory("");
    savePatient({ ...patient, pastMedicalHistory: next });
  };
  const handleRemovePMH = (i: number) => {
    if (!patient) return;
    savePatient({ ...patient, pastMedicalHistory: pastMedicalHistory.filter((_, idx) => idx !== i) });
  };

  const handleAddVital = () => {
    const systolic = newVital.bloodPressureSystolic.trim();
    const diastolic = newVital.bloodPressureDiastolic.trim();
    const bloodPressureValue =
      systolic || diastolic ? `${systolic || ""}/${diastolic || ""}` : undefined;
    const vital: Vital = {
      id: newId(),
      timestamp: nowIso(),
      bloodPressure: bloodPressureValue,
      heartRate: newVital.heartRate || undefined,
      temperature: newVital.temperature || undefined,
      oxygenSaturation: newVital.oxygenSaturation || undefined,
      respiratoryRate: newVital.respiratoryRate || undefined,
      notes: newVital.notes || undefined,
    };
    const next = [...vitals, vital];
    setVitals(next);
    setNewVital({
      bloodPressureSystolic: "",
      bloodPressureDiastolic: "",
      heartRate: "",
      temperature: "",
      oxygenSaturation: "",
      respiratoryRate: "",
      notes: "",
    });
    saveEncounter({ vitals: next });
  };

  const handleRemoveVital = (id: string) => {
    const next = vitals.filter((v) => v.id !== id);
    setVitals(next);
    saveEncounter({ vitals: next });
  };

  const handleIvAccessChange = (field: string, value: string) => {
    const updated = { ...ivAccess, [field]: value };
    setIvAccess(updated);
    setTimeout(() => saveEncounter({ ivAccess: updated }), 300);
  };
  const handleAdministrationChange = (field: string, value: string) => {
    const updated = { ...administration, [field]: value };
    setAdministration(updated);
    const adminForSave = normalizeAdministration(updated as Partial<Omit<Administration, "toleranceOption">> & { toleranceOption?: string });
    setTimeout(() => saveEncounter({ administration: adminForSave }), 300);
  };
  const setComplicationsNone = () => {
    handleAdministrationChange("complications", "None");
  };

  const additivesSelected = new Set(
    (administration.additivesVitamins || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const handleAdditiveToggle = (option: string) => {
    const next = new Set(additivesSelected);
    if (next.has(option)) next.delete(option);
    else next.add(option);
    const value = Array.from(next).join(", ");
    handleAdministrationChange("additivesVitamins", value);
  };

  const medicationsSelected = new Set(
    (administration.additivesMedications || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const handleMedicationToggle = (option: string) => {
    const next = new Set(medicationsSelected);
    if (next.has(option)) next.delete(option);
    else next.add(option);
    const value = Array.from(next).join(", ");
    handleAdministrationChange("additivesMedications", value);
  };

  /** Order total: base $180 + $30 per Zofran/Toradol + $20 if Extra 500 mL selected; vitamins no extra charge */
  const orderPricing = (() => {
    let total = PRICING.baseFee;
    const lineItems: { label: string; amount: number }[] = [
      { label: "IV placement & hydration service", amount: PRICING.baseFee },
    ];
    if (additivesSelected.has(EXTRA_500_ML_OPTION)) {
      total += PRICING.extraFluidFee;
      lineItems.push({ label: "Extra 500 mL of Hydration", amount: PRICING.extraFluidFee });
    }
    ADDITIVES_MEDICATIONS_OPTIONS.forEach((med) => {
      if (medicationsSelected.has(med)) {
        total += PRICING.medicationFee;
        lineItems.push({ label: med, amount: PRICING.medicationFee });
      }
    });
    return { total, lineItems };
  })();

  const handleProviderNoteChange = (value: string) => {
    setProviderNote(value);
    setTimeout(() => saveEncounter({ providerNote: { content: value } }), 300);
  };
  const handleDischargeChange = (value: string) => {
    setDischarge(value);
    setTimeout(() => saveEncounter({ discharge: { instructions: value } }), 300);
  };

  const handleAddAddendum = () => {
    if (!newAddendum.trim()) return;
    const entry = { id: newId(), createdAt: nowIso(), authorName: "User", text: newAddendum.trim() };
    const next = [...addenda, entry];
    setAddenda(next);
    setNewAddendum("");
    saveEncounter({ addenda: next });
  };
  const handleRemoveAddendum = (id: string) => {
    const next = addenda.filter((a) => a.id !== id);
    setAddenda(next);
    saveEncounter({ addenda: next });
  };

  const handleNursingComplete = () => {
    const errs = validateNursingComplete();
    if (errs.length > 0) {
      setValidationErrors(errs);
      return;
    }
    setValidationErrors([]);
    const signedBy = nurseName.trim() || "Nurse";
    setStatus("ready_for_provider");
    setNursingSignedBy(signedBy);
    saveEncounter({ status: "ready_for_provider", nursingSignedAt: nowIso(), nursingSignedBy: signedBy });
    if (encounter) logAudit("encounter.sign.nursing_complete", "encounter", encounter.id, undefined);
  };
  const handleProviderSigned = () => {
    const errs = validateProviderSign();
    if (errs.length > 0) {
      setValidationErrors(errs);
      return;
    }
    setValidationErrors([]);
    const signedBy = providerName.trim() || "Provider";
    setStatus("completed");
    setProviderSignedBy(signedBy);
    saveEncounter({ status: "completed", providerSignedAt: nowIso(), providerSignedBy: signedBy });
    if (encounter) logAudit("encounter.sign.provider_signed", "encounter", encounter.id, undefined);
  };

  const handleDeclineToTreat = () => {
    const declinedBy = providerName.trim() || "Provider";
    setStatus("declined");
    setDeclineReasonInput("");
    saveEncounter({
      status: "declined",
      declinedToTreatAt: nowIso(),
      declinedToTreatBy: declinedBy,
      declinedToTreatReason: declineReasonInput.trim() || undefined,
    });
    if (encounter) logAudit("encounter.decline_to_treat", "encounter", encounter.id, undefined);
  };

  const handleAcknowledgeDecline = () => {
    const acknowledgedBy = nurseName.trim() || "Nurse";
    saveEncounter({
      declineAcknowledgedAt: nowIso(),
      declineAcknowledgedBy: acknowledgedBy,
    });
    if (encounter) logAudit("encounter.decline_acknowledged", "encounter", encounter.id, undefined);
    router.push("/visits");
  };

  const handleCancelVisit = async () => {
    const reason = cancellationReasonInput.trim();
    if (!reason) {
      setValidationErrors(["Please provide a reason for cancellation."]);
      return;
    }
    const cancelledBy = currentRole === "nurse" ? (nurseName.trim() || "Nurse") : (providerName.trim() || "Provider");
    setValidationErrors([]);
    try {
      setStatus("cancelled");
      setShowCancelModal(false);
      await saveEncounter({
        status: "cancelled",
        cancelledAt: nowIso(),
        cancelledBy,
        cancellationReason: reason,
      });
      setCancellationReasonInput("");
      if (encounter) logAudit("encounter.cancelled", "encounter", encounter.id, undefined);
      router.push("/visits");
    } catch (e) {
      setStatus(encounter?.status ?? "in_progress");
      setShowCancelModal(true);
      const msg = (e as { message?: string })?.message ?? "Failed to cancel visit.";
      setValidationErrors([msg + " If you use created_by scoping, run supabase/auth-admin-see-all.sql so all roles can update visits."]);
    }
  };

  const orderApproved = !!(administration.orderApprovedAt && administration.orderApprovedBy);
  const handleApproveOrder = () => {
    const errs = validateOrderRequest();
    if (errs.length > 0) {
      setValidationErrors(errs);
      return;
    }
    setValidationErrors([]);
    const approvedBy = providerName.trim() || "Provider";
    const updated = { ...administration, orderApprovedAt: nowIso(), orderApprovedBy: approvedBy };
    setAdministration(updated);
    saveEncounter({ administration: normalizeAdministration(updated), revenue: orderPricing.total });
    if (encounter) logAudit("encounter.order_approved", "encounter", encounter.id, undefined);
  };

  const switchRole = (role: Role) => {
    setCurrentRole(role);
    if (role === "nurse") setActiveTab("intake");
    else setActiveTab("provider");
  };

  const isNurseLocked = status === "ready_for_provider" || status === "completed" || status === "declined" || status === "cancelled";
  const isProviderLocked = status === "completed" || status === "declined" || status === "cancelled";
  /** Administration record stays editable by nurse until provider signs (visit completed). */
  const isAdministrationLocked = status === "completed";

  /** Validate all nursing sections before "Nursing complete". */
  function validateNursingComplete(): string[] {
    const err: string[] = [];
    if (!intake.chiefComplaint?.trim()) err.push("Intake: Chief complaint is required.");
    if (!intake.historyOfPresentIllness?.trim()) err.push("Intake: History of present illness is required.");
    if (vitals.length === 0) err.push("Vitals: At least one vital reading is required.");
    if (!ivAccess.site?.trim()) err.push("IV Access: Site is required.");
    if (!ivAccess.gauge?.trim()) err.push("IV Access: Gauge is required.");
    if (!ivAccess.dateTime?.trim()) err.push("IV Access: Date/time (IV placed) is required.");
    if (!administration.fluidType?.trim()) err.push("Order request: IV fluid is required.");
    if (!administration.volume?.trim()) err.push("Order request: Volume (mL) is required.");
    if (!administration.rate?.trim()) err.push("Order request: Infusion rate (mL/hr) is required.");
    const hasAdditive =
      (administration.additivesVitamins ?? "").trim() !== "" ||
      (administration.additivesMedications ?? "").trim() !== "";
    if (!hasAdditive) err.push("Order request: At least one additive or medication must be selected.");
    return err;
  }

  /** Validate order request before provider can approve. */
  function validateOrderRequest(): string[] {
    const err: string[] = [];
    if (!administration.fluidType?.trim()) err.push("IV fluid is required.");
    if (!administration.volume?.trim()) err.push("Volume (mL) is required.");
    if (!administration.rate?.trim()) err.push("Infusion rate (mL/hr) is required.");
    const hasAdditive =
      (administration.additivesVitamins ?? "").trim() !== "" ||
      (administration.additivesMedications ?? "").trim() !== "";
    if (!hasAdditive) err.push("At least one additive or medication must be selected.");
    return err;
  }

  /** Validate administration and provider sections before "Sign to complete visit". */
  function validateProviderSign(): string[] {
    const err: string[] = [];
    if (!administration.startTime?.trim()) err.push("Administration: Infusion started is required.");
    if (!administration.endTime?.trim()) err.push("Administration: Infusion ended is required.");
    if (!(administration.complications ?? "").trim()) err.push("Administration: Complications is required (enter None if none).");
    const tolOpt = administration.toleranceOption;
    const validOpts = ["tolerated_well", "tolerated_complications", "unable_to_tolerate"];
    if (!tolOpt || !validOpts.includes(tolOpt)) err.push("Administration: How patient tolerated — select one option (Tolerated well, Tolerated but complications, or Unable to tolerate).");
    const tolText = (administration.tolerance ?? "").trim();
    if ((tolOpt === "tolerated_complications" || tolOpt === "unable_to_tolerate") && !tolText) {
      err.push("Administration: When not &quot;Tolerated well&quot;, free text must include reasoning.");
    }
    if (!providerNote?.trim()) err.push("Provider note is required.");
    if (!discharge?.trim()) err.push("Discharge instructions is required.");
    return err;
  }

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
        <div className="text-center max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Encounter not found</h1>
          {loadError && (
            <p className="mt-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded p-3">
              {loadError}
            </p>
          )}
          <Link href="/visits" className="mt-4 inline-block text-blue-600 dark:text-blue-400">← Back to Visits</Link>
        </div>
      </div>
    );
  }

  const nurseTabs: { id: Tab; label: string }[] = [
    { id: "intake", label: "Intake" },
    { id: "vitals", label: "Vitals" },
    { id: "iv-access", label: "IV Access" },
    { id: "order-request", label: "Order request" },
    ...(orderApproved ? [{ id: "administration" as const, label: "Administration" }] : []),
  ];
  const providerTabs: { id: Tab; label: string }[] = [
    { id: "provider", label: "Provider" },
    { id: "addendum", label: "Addendum" },
  ];
  const tabs = currentRole === "nurse" ? nurseTabs : providerTabs;
  const canAccessTab = (tabId: Tab) => tabs.some((t) => t.id === tabId);
  const effectiveTab = canAccessTab(activeTab) ? activeTab : (currentRole === "nurse" ? "intake" : "provider");
  const setActiveTabSafe = (id: Tab) => {
    if (currentRole === "nurse" && (id === "provider" || id === "addendum")) return;
    if (currentRole === "provider" && id !== "provider" && id !== "addendum") return;
    setValidationErrors([]);
    setActiveTab(id);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link href="/visits" className="text-sm text-gray-600 dark:text-gray-400 hover:underline">← Visits</Link>
          <div className="flex flex-wrap items-center gap-2">
            {(status === "in_progress" || status === "ready_for_provider") && (
              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                className="rounded border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-300 dark:hover:bg-red-900/20"
              >
                Cancel visit
              </button>
            )}
            <Link href={`/encounters/${encounterId}/summary`} className="rounded bg-gray-200 dark:bg-gray-700 px-3 py-1.5 text-sm dark:text-gray-200">Visit Summary</Link>
          </div>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          Encounter – {encounter.patientName}
        </h1>
        {patient?.allergies?.length ? (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            Allergies: {patient.allergies.map((a) => a.allergen).join(", ")}
          </p>
        ) : null}

        {status === "cancelled" && encounter && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Visit cancelled</p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              Cancelled by {encounter.cancelledBy ?? "—"} on {encounter.cancelledAt ? new Date(encounter.cancelledAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : ""}.
            </p>
            {encounter.cancellationReason ? (
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-300"><strong>Reason:</strong> {encounter.cancellationReason}</p>
            ) : null}
          </div>
        )}

        {validationErrors.length > 0 && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">Please complete all required fields:</p>
            <ul className="mt-2 list-inside list-disc text-sm text-red-700 dark:text-red-300">
              {validationErrors.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Cancel visit modal */}
        {showCancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCancelModal(false)}>
            <div
              className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Cancel visit</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">This visit will be cancelled and moved to visit history. Please provide a reason (required).</p>
              <label className="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-300">Reason for cancellation <span className="text-red-600">*</span></label>
              <textarea
                value={cancellationReasonInput}
                onChange={(e) => setCancellationReasonInput(e.target.value)}
                rows={3}
                placeholder="e.g. Patient left before treatment, rescheduled..."
                className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                autoFocus
              />
              <div className="mt-6 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowCancelModal(false); setCancellationReasonInput(""); setValidationErrors([]); }}
                  className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
                >
                  Keep visit
                </button>
                <button
                  type="button"
                  onClick={handleCancelVisit}
                  className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Cancel visit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Nurse: dedicated page when visit was declined by provider — convey reason, then acknowledge and close */}
        {status === "declined" && currentRole === "nurse" ? (
          <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
            {encounter.declineAcknowledgedAt ? (
              <div className="text-center py-6">
                <p className="text-lg font-semibold text-gray-900 dark:text-white">Visit closed</p>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  This declined visit has been acknowledged and closed by {encounter.declineAcknowledgedBy ?? "Nurse"} on {encounter.declineAcknowledgedAt ? new Date(encounter.declineAcknowledgedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : ""}.
                </p>
                <Link href="/visits" className="mt-6 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Back to Visits</Link>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600 pb-3 mb-4">
                  Visit declined by provider
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  The provider has declined to treat this patient based on the information provided. Use the information below to convey the declination to the patient. When you have done so, acknowledge and close the visit.
                </p>
                <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-900/20">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Information to convey to the patient</p>
                  <p className="mt-2 text-sm text-gray-800 dark:text-gray-200">
                    <strong>Declined by:</strong> {encounter.declinedToTreatBy ?? "Provider"}
                    {encounter.declinedToTreatAt ? (
                      <> on {new Date(encounter.declinedToTreatAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</>
                    ) : null}
                  </p>
                  <p className="mt-2 text-sm text-gray-800 dark:text-gray-200">
                    <strong>Reason:</strong> {encounter.declinedToTreatReason?.trim() || "No reason provided."}
                  </p>
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={handleAcknowledgeDecline}
                    className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                  >
                    I have conveyed this to the patient — Acknowledge declination and close visit
                  </button>
                  <Link href="/visits" className="text-sm text-gray-600 dark:text-gray-400 hover:underline">Cancel (return to visits without closing)</Link>
                </div>
              </>
            )}
          </div>
        ) : (
        <>
        {/* Role switcher: only admins can switch; nursing/provider users see only their section */}
        {canSwitchRole && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Access as — admins can switch; nursing and provider users see only their section
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex rounded-md border border-gray-200 dark:border-gray-600">
              <button
                type="button"
                onClick={() => switchRole("nurse")}
                className={`rounded-l-md px-4 py-2 text-sm font-medium ${
                  currentRole === "nurse"
                    ? "border border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    : "border border-transparent text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700"
                }`}
              >
                Nurse
              </button>
              <button
                type="button"
                onClick={() => switchRole("provider")}
                className={`rounded-r-md px-4 py-2 text-sm font-medium ${
                  currentRole === "provider"
                    ? "border border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    : "border border-transparent text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700"
                }`}
              >
                Provider
              </button>
            </div>
            {currentRole === "nurse" ? (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 dark:text-gray-400">Nursing documentation · sign as:</label>
                <input
                  type="text"
                  value={nurseName}
                  onChange={(e) => persistNurseName(e.target.value)}
                  placeholder="e.g. Jane Nurse"
                  className="w-48 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 dark:text-gray-400">Provider documentation · sign as:</label>
                <input
                  type="text"
                  value={providerName}
                  onChange={(e) => persistProviderName(e.target.value)}
                  placeholder="e.g. Dr. Smith"
                  className="w-48 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            )}
          </div>
        </div>
        )}
        {!canSwitchRole && (
          <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            {currentRole === "nurse" ? (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 dark:text-gray-400">Nursing documentation · sign as:</label>
                <input
                  type="text"
                  value={nurseName}
                  onChange={(e) => persistNurseName(e.target.value)}
                  placeholder="e.g. Jane Nurse"
                  className="w-48 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 dark:text-gray-400">Provider documentation · sign as:</label>
                <input
                  type="text"
                  value={providerName}
                  onChange={(e) => persistProviderName(e.target.value)}
                  placeholder="e.g. Dr. Smith"
                  className="w-48 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            )}
          </div>
        )}

        <div className="mt-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex gap-4 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTabSafe(t.id)}
                className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium ${
                  effectiveTab === t.id
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-6 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          {effectiveTab === "intake" && (
            <div className="space-y-6">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Nursing documentation</p>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Intake Information</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Chief Complaint <span className="text-red-600 dark:text-red-400">*</span></label>
                <textarea
                  value={intake.chiefComplaint}
                  onChange={(e) => handleIntakeChange("chiefComplaint", e.target.value)}
                  readOnly={isNurseLocked}
                  rows={2}
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">History of Present Illness <span className="text-red-600 dark:text-red-400">*</span></label>
                <textarea
                  value={intake.historyOfPresentIllness}
                  onChange={(e) => handleIntakeChange("historyOfPresentIllness", e.target.value)}
                  readOnly={isNurseLocked}
                  rows={3}
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Current Medications</label>
                <p className="text-xs text-gray-500 dark:text-gray-400">Stored on patient profile.</p>
                {!isNurseLocked && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={newMedication}
                      onChange={(e) => setNewMedication(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddMedication())}
                      placeholder="Medication name"
                      className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                    <button type="button" onClick={handleAddMedication} disabled={!newMedication.trim()} className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">Add</button>
                  </div>
                )}
                {medications.length > 0 ? (
                  <ul className="mt-2 space-y-1 rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-800">
                    {medications.map((name, i) => (
                      <li key={`${name}-${i}`} className="flex justify-between text-sm">
                        <span>{name}</span>
                        {!isNurseLocked && <button type="button" onClick={() => handleRemoveMedication(i)} className="text-red-600 dark:text-red-400">Remove</button>}
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-2 text-sm text-gray-500">None listed.</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Past Medical History</label>
                <p className="text-xs text-gray-500 dark:text-gray-400">Stored on patient profile.</p>
                {!isNurseLocked && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={newPastMedicalHistory}
                      onChange={(e) => setNewPastMedicalHistory(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddPMH())}
                      placeholder="Condition or history"
                      className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                    <button type="button" onClick={handleAddPMH} disabled={!newPastMedicalHistory.trim()} className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">Add</button>
                  </div>
                )}
                {pastMedicalHistory.length > 0 ? (
                  <ul className="mt-2 space-y-1 rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-800">
                    {pastMedicalHistory.map((name, i) => (
                      <li key={`${name}-${i}`} className="flex justify-between text-sm">
                        <span>{name}</span>
                        {!isNurseLocked && <button type="button" onClick={() => handleRemovePMH(i)} className="text-red-600 dark:text-red-400">Remove</button>}
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-2 text-sm text-gray-500">None listed.</p>}
              </div>
            </div>
          )}

          {effectiveTab === "vitals" && (
            <div className="space-y-6">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Nursing documentation</p>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Vital Signs</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">At least one vital reading is required <span className="text-red-600 dark:text-red-400">*</span></p>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
                <h3 className="mb-4 text-sm font-medium text-gray-700 dark:text-gray-300">Add vital reading</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Blood Pressure</label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={newVital.bloodPressureSystolic}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
                          setNewVital((v) => ({ ...v, bloodPressureSystolic: digits }));
                        }}
                        placeholder="120"
                        maxLength={3}
                        className={`w-20 rounded border bg-white px-3 py-2 text-sm text-center dark:bg-gray-700 dark:text-white ${
                          newVital.bloodPressureSystolic && isSystolicOutOfRange(parseInt(newVital.bloodPressureSystolic, 10))
                            ? "border-red-500 text-red-600 dark:border-red-400 dark:text-red-400"
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                        aria-label="Systolic"
                      />
                      <span className="text-gray-500 dark:text-gray-400 font-medium">/</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={newVital.bloodPressureDiastolic}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
                          setNewVital((v) => ({ ...v, bloodPressureDiastolic: digits }));
                        }}
                        placeholder="80"
                        maxLength={3}
                        className={`w-20 rounded border bg-white px-3 py-2 text-sm text-center dark:bg-gray-700 dark:text-white ${
                          newVital.bloodPressureDiastolic && isDiastolicOutOfRange(parseInt(newVital.bloodPressureDiastolic, 10))
                            ? "border-red-500 text-red-600 dark:border-red-400 dark:text-red-400"
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                        aria-label="Diastolic"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Heart Rate (bpm)</label>
                    <input
                      type="text"
                      value={newVital.heartRate}
                      onChange={(e) => setNewVital({ ...newVital, heartRate: e.target.value })}
                      placeholder="72"
                      className={`mt-1 w-full rounded border bg-white px-3 py-2 text-sm dark:bg-gray-700 dark:text-white ${
                        isHeartRateOutOfRange(newVital.heartRate) ? "border-red-500 text-red-600 dark:border-red-400 dark:text-red-400" : "border-gray-300 dark:border-gray-600"
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Temperature (°F)</label>
                    <input
                      type="text"
                      value={newVital.temperature}
                      onChange={(e) => setNewVital({ ...newVital, temperature: e.target.value })}
                      placeholder="98.6"
                      className={`mt-1 w-full rounded border bg-white px-3 py-2 text-sm dark:bg-gray-700 dark:text-white ${
                        isTemperatureOutOfRange(newVital.temperature) ? "border-red-500 text-red-600 dark:border-red-400 dark:text-red-400" : "border-gray-300 dark:border-gray-600"
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">O2 Saturation (%)</label>
                    <input
                      type="text"
                      value={newVital.oxygenSaturation}
                      onChange={(e) => setNewVital({ ...newVital, oxygenSaturation: e.target.value })}
                      placeholder="98"
                      className={`mt-1 w-full rounded border bg-white px-3 py-2 text-sm dark:bg-gray-700 dark:text-white ${
                        isO2OutOfRange(newVital.oxygenSaturation) ? "border-red-500 text-red-600 dark:border-red-400 dark:text-red-400" : "border-gray-300 dark:border-gray-600"
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Respiratory Rate</label>
                    <input
                      type="text"
                      value={newVital.respiratoryRate}
                      onChange={(e) => setNewVital({ ...newVital, respiratoryRate: e.target.value })}
                      placeholder="16"
                      className={`mt-1 w-full rounded border bg-white px-3 py-2 text-sm dark:bg-gray-700 dark:text-white ${
                        isRespiratoryRateOutOfRange(newVital.respiratoryRate) ? "border-red-500 text-red-600 dark:border-red-400 dark:text-red-400" : "border-gray-300 dark:border-gray-600"
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Notes</label>
                    <input
                      type="text"
                      value={newVital.notes}
                      onChange={(e) => setNewVital({ ...newVital, notes: e.target.value })}
                      placeholder="Optional"
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddVital}
                  className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Add vital reading
                </button>
              </div>
              {vitals.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-600">
                        <th className="py-2 text-left font-medium text-gray-600 dark:text-gray-400">Time</th>
                        <th className="py-2 text-left font-medium text-gray-600 dark:text-gray-400">BP</th>
                        <th className="py-2 text-left font-medium text-gray-600 dark:text-gray-400">HR</th>
                        <th className="py-2 text-left font-medium text-gray-600 dark:text-gray-400">Temp</th>
                        <th className="py-2 text-left font-medium text-gray-600 dark:text-gray-400">O2</th>
                        <th className="py-2 text-left font-medium text-gray-600 dark:text-gray-400">RR</th>
                        <th className="py-2 text-left font-medium text-gray-600 dark:text-gray-400"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {vitals.map((v) => (
                        <tr key={v.id} className="border-b border-gray-100 dark:border-gray-700">
                          <td className="py-2 text-gray-600 dark:text-gray-400">{new Date(v.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</td>
                          <td className={isBloodPressureOutOfRange(v.bloodPressure) ? "py-2 font-medium text-red-600 dark:text-red-400" : "py-2"}>{v.bloodPressure || "—"}</td>
                          <td className={isHeartRateOutOfRange(v.heartRate) ? "py-2 font-medium text-red-600 dark:text-red-400" : "py-2"}>{v.heartRate || "—"}</td>
                          <td className={isTemperatureOutOfRange(v.temperature) ? "py-2 font-medium text-red-600 dark:text-red-400" : "py-2"}>{v.temperature || "—"}</td>
                          <td className={isO2OutOfRange(v.oxygenSaturation) ? "py-2 font-medium text-red-600 dark:text-red-400" : "py-2"}>{v.oxygenSaturation || "—"}</td>
                          <td className={isRespiratoryRateOutOfRange(v.respiratoryRate) ? "py-2 font-medium text-red-600 dark:text-red-400" : "py-2"}>{v.respiratoryRate || "—"}</td>
                          <td className="py-2">
                            {!isNurseLocked && (
                              <button type="button" onClick={() => handleRemoveVital(v.id)} className="text-red-600 dark:text-red-400 text-xs">Remove</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {effectiveTab === "iv-access" && (
            <div className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Nursing documentation</p>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">IV Access</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Site <span className="text-red-600 dark:text-red-400">*</span></label>
                <select
                  value={ivAccess.site}
                  onChange={(e) => handleIvAccessChange("site", e.target.value)}
                  disabled={isNurseLocked}
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  {IV_SITES.map((opt) => (
                    <option key={opt.value || "empty"} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Gauge (size) <span className="text-red-600 dark:text-red-400">*</span></label>
                <select
                  value={ivAccess.gauge}
                  onChange={(e) => handleIvAccessChange("gauge", e.target.value)}
                  disabled={isNurseLocked}
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  {IV_GAUGES.map((opt) => (
                    <option key={opt.value || "empty"} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date/Time (IV placed) <span className="text-red-600 dark:text-red-400">*</span></label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="datetime-local"
                    value={ivAccess.dateTime}
                    onChange={(e) => handleIvAccessChange("dateTime", e.target.value)}
                    readOnly={isNurseLocked}
                    className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                  {!isNurseLocked && (
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        const pad = (n: number) => String(n).padStart(2, "0");
                        const value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                        handleIvAccessChange("dateTime", value);
                      }}
                      className="shrink-0 rounded border border-gray-300 bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                    >
                      Now
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
                <input
                  type="text"
                  value={ivAccess.notes}
                  onChange={(e) => handleIvAccessChange("notes", e.target.value)}
                  readOnly={isNurseLocked}
                  placeholder="Optional notes..."
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          )}

          {effectiveTab === "order-request" && (
            <div className="space-y-6 flex flex-col lg:flex-row lg:gap-6 lg:items-start">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 lg:sr-only">Nursing — order request</p>
              <div className="flex-1 min-w-0">
                <section className="rounded-lg border border-gray-200 bg-gray-50 p-5 dark:border-gray-600 dark:bg-gray-800/50">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600 pb-2 mb-4">
                    Order request — sent to provider for review and approval
                  </h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">IV fluid <span className="text-red-600 dark:text-red-400">*</span></label>
                        <select
                          value={administration.fluidType}
                          onChange={(e) => handleAdministrationChange("fluidType", e.target.value)}
                          disabled={isNurseLocked}
                          className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        >
                          {IV_FLUIDS.map((opt) => (
                            <option key={opt.value || "empty"} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Volume (mL) <span className="text-red-600 dark:text-red-400">*</span></label>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={administration.volume}
                          onChange={(e) => handleAdministrationChange("volume", e.target.value)}
                          readOnly={isNurseLocked}
                          placeholder="e.g. 1000"
                          className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Infusion rate (mL/hr) <span className="text-red-600 dark:text-red-400">*</span></label>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={administration.rate}
                          onChange={(e) => handleAdministrationChange("rate", e.target.value)}
                          readOnly={isNurseLocked}
                          placeholder="e.g. 250"
                          className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Order notes</label>
                        <input
                          type="text"
                          value={administration.notes}
                          onChange={(e) => handleAdministrationChange("notes", e.target.value)}
                          readOnly={isNurseLocked}
                          placeholder="Optional..."
                          className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Additives / Vitamins (select all that apply) <span className="text-red-600 dark:text-red-400">* at least one required</span></label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Vitamins included in base fee. Extra 500 mL of Hydration adds $20.</p>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {ADDITIVES_VITAMINS_OPTIONS.map((option) => (
                          <label
                            key={option}
                            className={`flex items-center gap-2 rounded border px-3 py-2 text-sm ${isNurseLocked ? "cursor-default border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-800" : "cursor-pointer border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"} ${additivesSelected.has(option) ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400" : ""}`}
                          >
                            <input type="checkbox" checked={additivesSelected.has(option)} onChange={() => handleAdditiveToggle(option)} disabled={isNurseLocked} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700" />
                            <span className="text-gray-800 dark:text-gray-200">{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Medications (select all that apply) — at least one additive or medication above required</label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Zofran and Toradol add $30 each.</p>
                      <div className="mt-2 flex flex-wrap gap-4">
                        {ADDITIVES_MEDICATIONS_OPTIONS.map((option) => (
                          <label
                            key={option}
                            className={`flex items-center gap-2 rounded border px-3 py-2 text-sm ${isNurseLocked ? "cursor-default border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-800" : "cursor-pointer border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"} ${medicationsSelected.has(option) ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400" : ""}`}
                          >
                            <input type="checkbox" checked={medicationsSelected.has(option)} onChange={() => handleMedicationToggle(option)} disabled={isNurseLocked} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700" />
                            <span className="text-gray-800 dark:text-gray-200">{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Pricing tally — bottom of form on mobile / small screens */}
                    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600 lg:hidden">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Order total</h3>
                      <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
                        {orderPricing.lineItems.map((item, i) => (
                          <li key={i} className="flex justify-between">
                            <span>{item.label}</span>
                            <span>${item.amount.toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 flex justify-between text-base font-semibold text-gray-900 dark:text-white">
                        <span>Total</span>
                        <span>${orderPricing.total.toFixed(2)}</span>
                      </p>
                    </div>
                  </div>
                </section>
              </div>

              {/* Pricing menu — sticky on right on desktop; on mobile see tally at bottom of form */}
              <div className="hidden lg:block lg:w-72 lg:shrink-0 lg:sticky lg:top-6">
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow dark:border-gray-600 dark:bg-gray-800">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600 pb-2 mb-3">Pricing</h3>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    {orderPricing.lineItems.map((item, i) => (
                      <li key={i} className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
                        <span>${item.amount.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600 flex justify-between text-base font-semibold text-gray-900 dark:text-white">
                    <span>Total</span>
                    <span>${orderPricing.total.toFixed(2)}</span>
                  </p>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Vitamins included in base fee. Zofran/Toradol +$30 each. Extra 500 mL +$20.</p>
                </div>
              </div>
            </div>
          )}

          {effectiveTab === "administration" && (
            <div className="space-y-6">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Nursing — administration record</p>
              <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-600 dark:bg-gray-800">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600 pb-2 mb-4">
                  Administration — document when infusion was run and outcome
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Complete after the provider has approved the order request. Editable until provider signs to complete the visit.</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Infusion started <span className="text-red-600 dark:text-red-400">*</span></label>
                    <div className="mt-1 flex gap-2">
                      <input
                        type="datetime-local"
                        value={administration.startTime}
                        onChange={(e) => handleAdministrationChange("startTime", e.target.value)}
                        readOnly={isAdministrationLocked}
                        className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                      {!isAdministrationLocked && (
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date();
                            const pad = (n: number) => String(n).padStart(2, "0");
                            const value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                            handleAdministrationChange("startTime", value);
                          }}
                          className="shrink-0 rounded border border-gray-300 bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                        >
                          Now
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Infusion ended <span className="text-red-600 dark:text-red-400">*</span></label>
                    <div className="mt-1 flex gap-2">
                      <input
                        type="datetime-local"
                        value={administration.endTime}
                        onChange={(e) => handleAdministrationChange("endTime", e.target.value)}
                        readOnly={isAdministrationLocked}
                        className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                      {!isAdministrationLocked && (
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date();
                            const pad = (n: number) => String(n).padStart(2, "0");
                            const value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                            handleAdministrationChange("endTime", value);
                          }}
                          className="shrink-0 rounded border border-gray-300 bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                        >
                          Now
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Complications <span className="text-red-600 dark:text-red-400">*</span></label>
                      {!isAdministrationLocked && (
                        <button
                          type="button"
                          onClick={setComplicationsNone}
                          className="shrink-0 rounded border border-gray-300 bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                        >
                          Set to None
                        </button>
                      )}
                    </div>
                    <textarea
                      value={administration.complications ?? ""}
                      onChange={(e) => handleAdministrationChange("complications", e.target.value)}
                      readOnly={isAdministrationLocked}
                      rows={2}
                      placeholder="e.g. None, or describe any complications..."
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">How patient tolerated infusion <span className="text-red-600 dark:text-red-400">*</span></label>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Select one. If not &quot;Tolerated well&quot;, free text must include reasoning.</p>
                    <div className="mt-2 space-y-2">
                      {[
                        { value: "tolerated_well", label: "Tolerated well" },
                        { value: "tolerated_complications", label: "Tolerated but complications" },
                        { value: "unable_to_tolerate", label: "Unable to tolerate" },
                      ].map((opt) => (
                        <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="toleranceOption"
                            checked={(administration.toleranceOption ?? "") === opt.value}
                            onChange={() => handleAdministrationChange("toleranceOption", opt.value)}
                            disabled={isAdministrationLocked}
                            className="h-4 w-4 rounded-full border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                          />
                          <span className="text-sm text-gray-900 dark:text-white">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                    <textarea
                      value={administration.tolerance ?? ""}
                      onChange={(e) => handleAdministrationChange("tolerance", e.target.value)}
                      readOnly={isAdministrationLocked}
                      rows={2}
                      placeholder={(administration.toleranceOption === "tolerated_complications" || administration.toleranceOption === "unable_to_tolerate") ? "Required: describe reasoning..." : "e.g. Tolerated well, no adverse effects..."}
                      className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                    {(administration.toleranceOption === "tolerated_complications" || administration.toleranceOption === "unable_to_tolerate") && !(administration.tolerance ?? "").trim() && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Free text must include reasoning when not &quot;Tolerated well&quot;.</p>
                    )}
                  </div>

                  {/* Ready for discharge — nurse marks patient ready for provider review */}
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                    {administration.readyForDischargeAt ? (
                      <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                        <p className="text-sm font-medium text-green-800 dark:text-green-200">Patient marked ready for discharge</p>
                        <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                          By {administration.readyForDischargeBy || "Nurse"} on {administration.readyForDischargeAt ? new Date(administration.readyForDischargeAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : ""} — pending provider review.
                        </p>
                      </div>
                    ) : !isAdministrationLocked ? (
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">When the infusion is complete and the patient is ready to go, mark them ready for discharge. The provider will review and sign to complete the visit.</p>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = {
                              ...administration,
                              readyForDischargeAt: nowIso(),
                              readyForDischargeBy: nurseName.trim() || "Nurse",
                            };
                            setAdministration(updated);
                          }}
                          className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                        >
                          Patient completed infusion — ready for discharge (pending provider review)
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            </div>
          )}

          {effectiveTab === "provider" && (
            <div className="space-y-8">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Provider documentation</p>

              {/* Declined to treat — show when provider has declined */}
              {status === "declined" && encounter && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                  <p className="text-sm font-semibold text-red-800 dark:text-red-200">Declined to treat</p>
                  <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                    This visit was declined to treat by {encounter.declinedToTreatBy ?? "Provider"} on {encounter.declinedToTreatAt ? new Date(encounter.declinedToTreatAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : ""}.
                  </p>
                  {encounter.declinedToTreatReason ? (
                    <p className="mt-2 text-sm text-red-700 dark:text-red-300"><strong>Reason:</strong> {encounter.declinedToTreatReason}</p>
                  ) : null}
                </div>
              )}

              {/* Nursing summary for provider — single-page reference for approving infusion */}
              <section className="rounded-lg border border-gray-200 bg-gray-50 p-5 dark:border-gray-600 dark:bg-gray-800/50">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600 pb-2 mb-4">
                  Nursing summary — for provider review
                </h2>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {/* Patient context */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Patient context</h3>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-600 dark:text-gray-400">Allergies</span>
                        <p className="mt-0.5 text-gray-900 dark:text-white">
                          {patient?.allergies?.length
                            ? patient.allergies.map((a) => a.allergen + (a.reactionType ? ` (${a.reactionType})` : "")).join(", ")
                            : "None documented"}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600 dark:text-gray-400">Current medications</span>
                        <p className="mt-0.5 text-gray-900 dark:text-white">
                          {(patient?.currentMedications?.length)
                            ? patient.currentMedications.join(", ")
                            : "None listed"}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600 dark:text-gray-400">Past medical history</span>
                        <p className="mt-0.5 text-gray-900 dark:text-white">
                          {(patient?.pastMedicalHistory?.length)
                            ? patient.pastMedicalHistory.join(", ")
                            : "None listed"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Intake */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Intake (nursing)</h3>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-600 dark:text-gray-400">Chief complaint</span>
                        <p className="mt-0.5 text-gray-900 dark:text-white whitespace-pre-wrap">{intake.chiefComplaint || "—"}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600 dark:text-gray-400">History of present illness</span>
                        <p className="mt-0.5 text-gray-900 dark:text-white whitespace-pre-wrap">{intake.historyOfPresentIllness || "—"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vitals (latest) */}
                {vitals.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Latest vitals</h3>
                    <div className="rounded border border-gray-200 dark:border-gray-600 overflow-hidden">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-700">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Time</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">BP</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">HR</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Temp</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">O2</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">RR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vitals.slice(-3).reverse().map((v) => (
                            <tr key={v.id} className="border-t border-gray-200 dark:border-gray-600">
                              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{new Date(v.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</td>
                              <td className="px-3 py-2">{v.bloodPressure || "—"}</td>
                              <td className="px-3 py-2">{v.heartRate || "—"}</td>
                              <td className="px-3 py-2">{v.temperature || "—"}</td>
                              <td className="px-3 py-2">{v.oxygenSaturation || "—"}</td>
                              <td className="px-3 py-2">{v.respiratoryRate || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* IV Access */}
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">IV access</h3>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span><strong className="text-gray-600 dark:text-gray-400">Site:</strong> {ivAccess.site || "—"}</span>
                    <span><strong className="text-gray-600 dark:text-gray-400">Gauge:</strong> {ivAccess.gauge || "—"}</span>
                    <span>
                      <strong className="text-gray-600 dark:text-gray-400">Placed:</strong>{" "}
                      {ivAccess.dateTime
                        ? new Date(ivAccess.dateTime).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })
                        : "—"}
                    </span>
                    {ivAccess.notes ? <span><strong className="text-gray-600 dark:text-gray-400">Notes:</strong> {ivAccess.notes}</span> : null}
                  </div>
                </div>

                {/* Requested order — provider approves to release for administration */}
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Requested order (nurse)</h3>
                  <div className="rounded border border-gray-200 dark:border-gray-600 p-4 space-y-3 text-sm">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                      <div><strong className="text-gray-600 dark:text-gray-400">IV fluid:</strong> {administration.fluidType || "—"}</div>
                      <div><strong className="text-gray-600 dark:text-gray-400">Volume:</strong> {administration.volume ? `${administration.volume} mL` : "—"}</div>
                      <div><strong className="text-gray-600 dark:text-gray-400">Rate:</strong> {administration.rate ? `${administration.rate} mL/hr` : "—"}</div>
                    </div>
                    <div>
                      <strong className="text-gray-600 dark:text-gray-400">Additives / vitamins:</strong>
                      <p className="mt-0.5 text-gray-900 dark:text-white">{administration.additivesVitamins || "None"}</p>
                    </div>
                    <div>
                      <strong className="text-gray-600 dark:text-gray-400">Medications:</strong>
                      <p className="mt-0.5 text-gray-900 dark:text-white">{administration.additivesMedications || "None"}</p>
                    </div>
                    {administration.notes ? <div><strong className="text-gray-600 dark:text-gray-400">Order notes:</strong> <span className="text-gray-900 dark:text-white">{administration.notes}</span></div> : null}
                    {!orderApproved && status === "ready_for_provider" && (
                      <div className="pt-2 flex flex-wrap items-end gap-4">
                        <button type="button" onClick={handleApproveOrder} className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">Approve order</button>
                      </div>
                    )}
                    {orderApproved && (
                      <p className="text-xs text-green-600 dark:text-green-400 pt-1">Approved by {administration.orderApprovedBy} {administration.orderApprovedAt ? new Date(administration.orderApprovedAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" }) : ""}</p>
                    )}
                    {status === "ready_for_provider" && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Decline to treat</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">If you decline to treat this patient based on the information provided, document the reason below (optional) and confirm.</p>
                        <textarea
                          value={declineReasonInput}
                          onChange={(e) => setDeclineReasonInput(e.target.value)}
                          rows={2}
                          placeholder="Reason for declining (optional)..."
                          className="mb-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        />
                        <button type="button" onClick={handleDeclineToTreat} className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Decline to treat</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ready for discharge — shown when nurse has marked patient ready */}
                {administration.readyForDischargeAt && (
                  <div className="mt-6 rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-700 dark:bg-green-900/30">
                    <p className="text-sm font-semibold text-green-800 dark:text-green-200">Patient ready for discharge</p>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      Nursing has marked this patient as having completed the infusion and ready for discharge. Marked by {administration.readyForDischargeBy || "Nurse"} on {new Date(administration.readyForDischargeAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}. Please review and sign to complete the visit.
                    </p>
                  </div>
                )}

                {/* Administration record — for provider review before signing */}
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Administration record (review before signing)</h3>
                  <div className="rounded border border-gray-200 dark:border-gray-600 p-4 space-y-3 text-sm">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div><strong className="text-gray-600 dark:text-gray-400">Infusion started:</strong> {administration.startTime ? new Date(administration.startTime).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" }) : "—"}</div>
                      <div><strong className="text-gray-600 dark:text-gray-400">Infusion ended:</strong> {administration.endTime ? new Date(administration.endTime).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" }) : "—"}</div>
                    </div>
                    <div>
                      <strong className="text-gray-600 dark:text-gray-400">Complications:</strong>
                      <p className="mt-0.5 text-gray-900 dark:text-white">{administration.complications || "—"}</p>
                    </div>
                    <div>
                      <strong className="text-gray-600 dark:text-gray-400">How patient tolerated:</strong>
                      <p className="mt-0.5 text-gray-900 dark:text-white">
                        {administration.toleranceOption === "tolerated_well" && "Tolerated well"}
                        {administration.toleranceOption === "tolerated_complications" && "Tolerated but complications"}
                        {administration.toleranceOption === "unable_to_tolerate" && "Unable to tolerate"}
                        {administration.toleranceOption && (administration.tolerance ?? "").trim() ? " — " : ""}
                        {(administration.tolerance ?? "").trim() || (!administration.toleranceOption ? "—" : "")}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Provider note & discharge */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Provider note & discharge</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Provider note <span className="text-red-600 dark:text-red-400">*</span></label>
                  <textarea value={providerNote} onChange={(e) => handleProviderNoteChange(e.target.value)} readOnly={isProviderLocked} rows={4} className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Discharge instructions <span className="text-red-600 dark:text-red-400">*</span></label>
                  <textarea value={discharge} onChange={(e) => handleDischargeChange(e.target.value)} readOnly={isProviderLocked} rows={3} className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                </div>
                {status === "ready_for_provider" && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                    <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">Signing indicates you have reviewed the administration record (start/end times, complications, tolerance) and approve this visit as complete.</p>
                    <button type="button" onClick={handleProviderSigned} className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">Sign to complete visit</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {effectiveTab === "addendum" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Addendum</h2>
              <div className="flex gap-2">
                <textarea value={newAddendum} onChange={(e) => setNewAddendum(e.target.value)} rows={2} placeholder="Add addendum..." className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                <button type="button" onClick={handleAddAddendum} disabled={!newAddendum.trim()} className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">Add</button>
              </div>
              {addenda.length > 0 && (
                <ul className="space-y-2">
                  {addenda.map((a) => (
                    <li key={a.id} className="rounded border border-gray-200 bg-gray-50 p-2 text-sm dark:border-gray-600 dark:bg-gray-800">
                      <span className="text-gray-500 dark:text-gray-400">{a.authorName} · {new Date(a.createdAt).toLocaleString()}</span>
                      <p className="mt-1">{a.text}</p>
                      <button type="button" onClick={() => handleRemoveAddendum(a.id)} className="mt-1 text-xs text-red-600 dark:text-red-400">Remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {status === "in_progress" && currentRole === "nurse" && (effectiveTab === "intake" || effectiveTab === "vitals" || effectiveTab === "iv-access" || effectiveTab === "order-request") && (
          <div className="mt-6">
            <button type="button" onClick={handleNursingComplete} className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">Nursing complete</button>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}

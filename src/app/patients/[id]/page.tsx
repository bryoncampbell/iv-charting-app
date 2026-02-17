"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Patient, Encounter, Allergy, AllergyReactionType } from "@/types";

const REACTION_TYPE_OPTIONS: { value: AllergyReactionType; label: string }[] = [
  { value: "Rash", label: "Rash" },
  { value: "Hives", label: "Hives" },
  { value: "Anaphylaxis", label: "Anaphylaxis" },
  { value: "Pruritus", label: "Pruritus" },
  { value: "Other", label: "Other" },
];
import { getPatientDisplayName } from "@/types";
import { logAudit } from "@/lib/audit";
import { newId, nowIso } from "@/lib/ids";
import { parseLocalDate } from "@/lib/dates";
import { STORAGE_KEYS } from "@/lib/storage";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { patientRowToPatient, patientToRow, encounterRowToEncounter } from "@/lib/supabaseMappers";

// US states for address dropdown (50 states + DC)
const US_STATES = [
  { value: "", label: "Select state" },
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "DC", label: "District of Columbia" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

// Format phone number to (XXX) XXX-XXXX
const formatPhoneNumber = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

const normalizePhoneNumber = (phone: string): string => {
  return phone.replace(/\D/g, "");
};

export default function PatientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [newAllergy, setNewAllergy] = useState("");
  const [newReactionType, setNewReactionType] = useState<AllergyReactionType>("Rash");
  const [newReactionOther, setNewReactionOther] = useState("");
  const [newMedication, setNewMedication] = useState("");
  const [newPastMedicalHistory, setNewPastMedicalHistory] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    phone: "",
    cellPhone: "",
    email: "",
    streetAddress: "",
    city: "",
    state: "",
    zipCode: "",
    mailingListAgreement: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [recentVisits, setRecentVisits] = useState<Encounter[]>([]);
  const lastViewedPatientId = useRef<string | null>(null);

  useEffect(() => {
    void loadPatient();
  }, [patientId]);

  useEffect(() => {
    if (!patientId) return;
    if (isSupabaseConfigured() && supabase) {
      supabase
        .from("encounters")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (error) {
            setRecentVisits([]);
            return;
          }
          const encounters = (data ?? []).map((row) => encounterRowToEncounter(row));
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
          const withinYear = encounters.filter((e) => {
            const dateStr = e.date ?? (e.createdAt ? e.createdAt.slice(0, 10) : "");
            if (!dateStr) return false;
            const visitDate = parseLocalDate(dateStr);
            return visitDate >= oneYearAgo;
          });
          setRecentVisits(withinYear);
        });
      return;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.encounters);
      if (!stored) {
        setRecentVisits([]);
        return;
      }
      const encounters: Encounter[] = JSON.parse(stored);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const forPatient = encounters.filter((e) => e.patientId === patientId);
      const withinYear = forPatient.filter((e) => {
        const dateStr = e.date ?? (e.createdAt ? e.createdAt.slice(0, 10) : "");
        if (!dateStr) return false;
        const visitDate = parseLocalDate(dateStr);
        return visitDate >= oneYearAgo;
      });
      const sorted = withinYear.sort(
        (a, b) =>
          new Date(b.createdAt ?? b.date ?? 0).getTime() -
          new Date(a.createdAt ?? a.date ?? 0).getTime()
      );
      setRecentVisits(sorted);
    } catch {
      setRecentVisits([]);
    }
  }, [patientId]);

  const loadPatient = async () => {
    try {
      if (isSupabaseConfigured() && supabase) {
        const { data: row, error } = await supabase
          .from("patients")
          .select("*")
          .eq("id", patientId)
          .single();
        if (!error && row) {
          const foundPatient = patientRowToPatient(row);
          setPatient(foundPatient);
          if (lastViewedPatientId.current !== patientId) {
            lastViewedPatientId.current = patientId;
            logAudit("patient.view", "patient", patientId, getPatientDisplayName(foundPatient));
          }
        }
        setIsLoading(false);
        return;
      }
      const stored = localStorage.getItem(STORAGE_KEYS.patients);
      if (stored) {
        const patients: Patient[] = JSON.parse(stored);
        const foundPatient = patients.find((p) => p.id === patientId);
        if (foundPatient) {
          setPatient(foundPatient);
          if (lastViewedPatientId.current !== patientId) {
            lastViewedPatientId.current = patientId;
            logAudit("patient.view", "patient", patientId, getPatientDisplayName(foundPatient));
          }
        }
      }
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading patient:", error);
      setIsLoading(false);
    }
  };

  const savePatient = (updatedPatient: Patient) => {
    if (isSupabaseConfigured() && supabase) {
      supabase
        .from("patients")
        .upsert(patientToRow(updatedPatient), { onConflict: "id" })
        .then(({ error }) => {
          if (error) console.error("Error saving patient to Supabase:", error);
        });
      return;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.patients);
      if (stored) {
        const patients: Patient[] = JSON.parse(stored);
        const updatedPatients = patients.map((p) =>
          p.id === updatedPatient.id ? updatedPatient : p
        );
        localStorage.setItem(STORAGE_KEYS.patients, JSON.stringify(updatedPatients));
      }
    } catch (error) {
      console.error("Error saving patient:", error);
    }
  };

  const handleAddAllergy = () => {
    if (!newAllergy.trim() || !patient) return;
    const allergen = newAllergy.trim();
    const exists = patient.allergies?.some((a) => a.allergen.toLowerCase() === allergen.toLowerCase());
    if (exists) {
      alert("This allergy is already in the list");
      return;
    }
    const newEntry: Allergy = {
      id: newId(),
      allergen,
      reactionType: newReactionType,
      reactionOther: newReactionType === "Other" ? newReactionOther.trim() || undefined : undefined,
    };
    const updatedAllergies = [...(patient.allergies ?? []), newEntry];
    const updatedPatient: Patient = { ...patient, allergies: updatedAllergies };
    setPatient(updatedPatient);
    savePatient(updatedPatient);
    logAudit("patient.edit", "patient", patient.id, `add allergy: ${allergen}`);
    setNewAllergy("");
    setNewReactionType("Rash");
    setNewReactionOther("");
  };

  const handleRemoveAllergy = (idToRemove: string) => {
    if (!patient) return;
    const updatedAllergies = (patient.allergies ?? []).filter((a) => a.id !== idToRemove);
    const updatedPatient: Patient = { ...patient, allergies: updatedAllergies };
    setPatient(updatedPatient);
    savePatient(updatedPatient);
    const removed = patient.allergies?.find((a) => a.id === idToRemove);
    logAudit("patient.edit", "patient", patient.id, `remove allergy: ${removed?.allergen ?? idToRemove}`);
  };

  const medications = patient?.currentMedications ?? [];
  const pastMedicalHistory = patient?.pastMedicalHistory ?? [];

  const handleAddMedication = () => {
    const name = newMedication.trim();
    if (!name || !patient) return;
    const next = [...medications, name];
    const updatedPatient: Patient = { ...patient, currentMedications: next };
    setPatient(updatedPatient);
    savePatient(updatedPatient);
    setNewMedication("");
  };

  const handleRemoveMedication = (index: number) => {
    if (!patient) return;
    const next = medications.filter((_, i) => i !== index);
    const updatedPatient: Patient = { ...patient, currentMedications: next };
    setPatient(updatedPatient);
    savePatient(updatedPatient);
  };

  const handleAddPastMedicalHistory = () => {
    const name = newPastMedicalHistory.trim();
    if (!name || !patient) return;
    const next = [...pastMedicalHistory, name];
    const updatedPatient: Patient = { ...patient, pastMedicalHistory: next };
    setPatient(updatedPatient);
    savePatient(updatedPatient);
    setNewPastMedicalHistory("");
  };

  const handleRemovePastMedicalHistory = (index: number) => {
    if (!patient) return;
    const next = pastMedicalHistory.filter((_, i) => i !== index);
    const updatedPatient: Patient = { ...patient, pastMedicalHistory: next };
    setPatient(updatedPatient);
    savePatient(updatedPatient);
  };

  const startEditingProfile = () => {
    if (!patient) return;
    const p = patient as Patient & { address?: string };
    setEditForm({
      firstName: patient.firstName,
      lastName: patient.lastName,
      dob: patient.dob,
      phone: patient.phone ?? "",
      cellPhone: patient.cellPhone ?? "",
      email: patient.email ?? "",
      streetAddress: patient.streetAddress ?? (p.address ?? ""),
      city: patient.city ?? "",
      state: patient.state ?? "",
      zipCode: patient.zipCode ?? "",
      mailingListAgreement: patient.mailingListAgreement ?? false,
    });
    setIsEditingProfile(true);
  };

  const cancelEditingProfile = () => {
    setIsEditingProfile(false);
  };

  const handleSaveProfile = () => {
    if (!patient) return;
    const { firstName, lastName, dob, phone, cellPhone, email, streetAddress, city, state, zipCode, mailingListAgreement } = editForm;
    if (!firstName?.trim() || !lastName?.trim() || !dob?.trim()) {
      alert("First name, last name, and date of birth are required.");
      return;
    }
    const normalizedPhone = phone ? normalizePhoneNumber(phone) : "";
    const normalizedCell = cellPhone ? normalizePhoneNumber(cellPhone) : "";
    const updatedPatient: Patient = {
      ...patient,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dob: dob.trim(),
      phone: normalizedPhone.length === 10 ? formatPhoneNumber(normalizedPhone) : undefined,
      cellPhone: normalizedCell.length === 10 ? formatPhoneNumber(normalizedCell) : undefined,
      email: email?.trim() || undefined,
      streetAddress: streetAddress?.trim() || undefined,
      city: city?.trim() || undefined,
      state: state?.trim() || undefined,
      zipCode: zipCode?.trim() || undefined,
      mailingListAgreement: mailingListAgreement ?? false,
    };
    setPatient(updatedPatient);
    savePatient(updatedPatient);
    logAudit("patient.edit", "patient", patient.id, "Profile updated");
    setIsEditingProfile(false);
  };

  const handleLicensePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!patient) return;
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const updated = { ...patient, licensePhoto: dataUrl };
      setPatient(updated);
      savePatient(updated);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRemoveLicensePhoto = () => {
    if (!patient) return;
    const updated = { ...patient, licensePhoto: undefined };
    setPatient(updated);
    savePatient(updated);
  };

  const handleStartVisit = () => {
    if (!patient) return;

    const iso = nowIso();
    const createdDate = new Date(iso);
    const encounter: Encounter = {
      id: newId(),
      patientId: patient.id,
      createdAt: iso,
      updatedAt: iso,
      status: "in_progress",
      patientName: getPatientDisplayName(patient),
      date: iso.slice(0, 10),
      time: createdDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
      addenda: [],
    };

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.encounters);
      const encounters: Encounter[] = stored ? JSON.parse(stored) : [];
      encounters.push(encounter);
      localStorage.setItem(STORAGE_KEYS.encounters, JSON.stringify(encounters));
      logAudit("encounter.create", "encounter", encounter.id, getPatientDisplayName(patient));
    } catch (error) {
      console.error("Error saving encounter:", error);
    }

    router.push(`/encounters/${encounter.id}`);
  };

  const formatDate = (dateString: string) => {
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatVisitDate = (e: Encounter) => {
    const dateStr = e.date ?? (e.createdAt ? e.createdAt.slice(0, 10) : "");
    if (!dateStr) return "—";
    return parseLocalDate(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const getVisitStatusLabel = (e: Encounter) => {
    if (e.status === "completed") return "Visit completed";
    if (e.status === "declined") {
      return e.declineAcknowledgedAt ? "Declined (closed)" : "Declined";
    }
    if (e.status === "ready_for_provider") return "Ready for provider";
    return "In progress";
  };

  const calculateAge = (dob: string) => {
    const birthDate = parseLocalDate(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Patient Not Found
            </h1>
            <Link
              href="/patients"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              ← Back to Patients
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/patients"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 mb-4"
          >
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Patients
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {getPatientDisplayName(patient)}
              </h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Patient Profile
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!isEditingProfile ? (
                <button
                  onClick={startEditingProfile}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Edit Profile
                </button>
              ) : null}
              <button
                onClick={handleStartVisit}
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
                Start Visit
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 min-w-0 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {/* Demographics Card */}
          <div className="min-w-0 sm:col-span-2">
            <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Demographics
                </h2>
                {isEditingProfile && (
                  <div className="flex gap-2">
                    <button
                      onClick={cancelEditingProfile}
                      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>
              <div className="px-6 py-4">
                {isEditingProfile ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">First name *</label>
                      <input
                        type="text"
                        value={editForm.firstName}
                        onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                        className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Last name *</label>
                      <input
                        type="text"
                        value={editForm.lastName}
                        onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                        className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Date of birth *</label>
                      <input
                        type="date"
                        value={editForm.dob}
                        onChange={(e) => setEditForm((f) => ({ ...f, dob: e.target.value }))}
                        className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Phone</label>
                      <input
                        type="tel"
                        value={editForm.phone}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "");
                          setEditForm((f) => ({ ...f, phone: formatPhoneNumber(digits) }));
                        }}
                        placeholder="(555) 123-4567"
                        className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Cell phone</label>
                      <input
                        type="tel"
                        value={editForm.cellPhone}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "");
                          setEditForm((f) => ({ ...f, cellPhone: formatPhoneNumber(digits) }));
                        }}
                        placeholder="(555) 123-4567"
                        className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Email</label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="optional"
                        className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Street address</label>
                      <input
                        type="text"
                        value={editForm.streetAddress}
                        onChange={(e) => setEditForm((f) => ({ ...f, streetAddress: e.target.value }))}
                        placeholder="Street address"
                        className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">City</label>
                      <input
                        type="text"
                        value={editForm.city}
                        onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                        placeholder="City"
                        className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">State</label>
                      <select
                        value={editForm.state}
                        onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))}
                        className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      >
                        {US_STATES.map((opt) => (
                          <option key={opt.value || "empty"} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Zip code</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="postal-code"
                        value={editForm.zipCode}
                        onChange={(e) => setEditForm((f) => ({ ...f, zipCode: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                        placeholder="Zip code"
                        className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
                      />
                    </div>
                    <div className="sm:col-span-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="mailing-list"
                        checked={editForm.mailingListAgreement}
                        onChange={(e) => setEditForm((f) => ({ ...f, mailingListAgreement: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                      />
                      <label htmlFor="mailing-list" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Agreement to be on mailing list
                      </label>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Patient ID (read-only): <span className="font-mono">{patient.id}</span></p>
                    </div>
                  </div>
                ) : (
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {getPatientDisplayName(patient)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Date of Birth</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {formatDate(patient.dob)} ({calculateAge(patient.dob)} years old)
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Phone</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {patient.phone ? formatPhoneNumber(normalizePhoneNumber(patient.phone)) : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Cell phone</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {patient.cellPhone ? formatPhoneNumber(normalizePhoneNumber(patient.cellPhone)) : "—"}
                      </dd>
                    </div>
                    {patient.email ? (
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">{patient.email}</dd>
                      </div>
                    ) : null}
                    {(patient as Patient & { address?: string }).address && !patient.streetAddress && !patient.city ? (
                      <div className="sm:col-span-2">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Address</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white whitespace-pre-line">{(patient as Patient & { address?: string }).address}</dd>
                      </div>
                    ) : null}
                    {patient.streetAddress ? (
                      <div className="sm:col-span-2">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Street address</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">{patient.streetAddress}</dd>
                      </div>
                    ) : null}
                    {patient.city ? (
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">City</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">{patient.city}</dd>
                      </div>
                    ) : null}
                    {patient.state ? (
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">State</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">{patient.state}</dd>
                      </div>
                    ) : null}
                    {patient.zipCode ? (
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Zip code</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">{patient.zipCode}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Mailing list</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {patient.mailingListAgreement ? "Yes" : "No"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Patient ID</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono">{patient.id}</dd>
                    </div>
                  </dl>
                )}
                {/* License / ID photo - always editable */}
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">License / ID photo</label>
                  {patient.licensePhoto ? (
                    <div className="flex items-start gap-3">
                      <img src={patient.licensePhoto} alt="License" className="h-24 w-auto rounded border border-gray-300 dark:border-gray-600 object-contain" />
                      <div className="flex flex-col gap-2">
                        <a
                          href={patient.licensePhoto}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 text-center"
                        >
                          View full size
                        </a>
                        <label className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer dark:bg-blue-500 dark:hover:bg-blue-600 text-center">
                          Take new photo
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="sr-only"
                            onChange={handleLicensePhotoChange}
                            aria-label="Take new photo with camera"
                          />
                        </label>
                        <label className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 text-center">
                          Upload different image
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={handleLicensePhotoChange}
                            aria-label="Upload image from device"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={handleRemoveLicensePhoto}
                          className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-600 dark:bg-gray-700 dark:text-red-300 dark:hover:bg-red-900/20"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                      <label className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-500 bg-gray-50 dark:bg-gray-700/50 px-4 py-6 cursor-pointer min-h-[88px] flex-1 sm:min-w-[160px]">
                        <svg className="h-8 w-8 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13v7a2 2 0 01-2 2H7a2 2 0 01-2-2v-7" />
                        </svg>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Take photo</span>
                        <span className="sr-only">Opens camera on mobile devices</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="sr-only"
                          onChange={handleLicensePhotoChange}
                          aria-label="Take photo with camera"
                        />
                      </label>
                      <label className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-500 bg-gray-50 dark:bg-gray-700/50 px-4 py-6 cursor-pointer min-h-[88px] flex-1 sm:min-w-[160px]">
                        <svg className="h-8 w-8 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Upload image</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={handleLicensePhotoChange}
                          aria-label="Upload image from device"
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Allergies Card */}
          <div className="min-w-0">
            <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Allergies
                </h2>
              </div>
              <div className="px-6 py-4">
                {/* Add Allergy: allergen + reaction type (+ Other free text) */}
                <div className="mb-4 space-y-3">
                  <div className="flex flex-wrap gap-2 items-end">
                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Allergy</label>
                      <input
                        type="text"
                        value={newAllergy}
                        onChange={(e) => setNewAllergy(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddAllergy();
                          }
                        }}
                        placeholder="e.g. Penicillin, Latex"
                        className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
                      />
                    </div>
                    <div className="w-40">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Reaction type</label>
                      <select
                        value={newReactionType}
                        onChange={(e) => setNewReactionType(e.target.value as AllergyReactionType)}
                        className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      >
                        {REACTION_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleAddAllergy}
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
                    >
                      Add
                    </button>
                  </div>
                  {newReactionType === "Other" && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Describe reaction (Other)</label>
                      <input
                        type="text"
                        value={newReactionOther}
                        onChange={(e) => setNewReactionOther(e.target.value)}
                        placeholder="Describe the reaction..."
                        className="block w-full max-w-md rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
                      />
                    </div>
                  )}
                </div>

                {/* Allergies List */}
                {!(patient.allergies?.length) ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No known allergies
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {(patient.allergies ?? []).map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300"
                      >
                        <span>
                          {a.allergen}
                          {a.reactionType
                            ? ` — ${a.reactionType === "Other" && a.reactionOther ? a.reactionOther : a.reactionType}`
                            : a.reaction
                              ? ` — ${a.reaction}`
                              : ""}
                          {a.severity ? ` (${a.severity})` : ""}
                        </span>
                        <button
                          onClick={() => handleRemoveAllergy(a.id)}
                          className="ml-2 rounded text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Recent visits (last year) — click to open summary */}
          <div className="min-w-0">
            <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Recent visits
                </h2>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  Visits within the last year. Click a row to open the visit summary.
                </p>
              </div>
              <div className="overflow-x-auto">
                {recentVisits.length === 0 ? (
                  <div className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No visits in the last year.
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          Time
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                      {recentVisits.map((visit) => (
                        <tr
                          key={visit.id}
                          onClick={() => router.push(`/encounters/${visit.id}/summary`)}
                          className="cursor-pointer transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          role="link"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              router.push(`/encounters/${visit.id}/summary`);
                            }
                          }}
                        >
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-white">
                            {formatVisitDate(visit)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {visit.time ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {getVisitStatusLabel(visit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* Current Medications Card */}
          <div className="min-w-0">
            <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Current Medications
                </h2>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  Stored on profile for future visits.
                </p>
              </div>
              <div className="px-6 py-4">
                <div className="mb-4 flex gap-2">
                  <input
                    type="text"
                    value={newMedication}
                    onChange={(e) => setNewMedication(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddMedication())}
                    placeholder="Medication name"
                    className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddMedication}
                    disabled={!newMedication.trim()}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                  >
                    Add
                  </button>
                </div>
                {medications.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No medications listed.</p>
                ) : (
                  <ul className="space-y-2">
                    {medications.map((name, index) => (
                      <li
                        key={`${name}-${index}`}
                        className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                      >
                        <span>{name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMedication(index)}
                          className="rounded text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                          aria-label={`Remove ${name}`}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Past Medical History Card */}
          <div className="min-w-0">
            <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Past Medical History
                </h2>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  Stored on profile for future visits.
                </p>
              </div>
              <div className="px-6 py-4">
                <div className="mb-4 flex gap-2">
                  <input
                    type="text"
                    value={newPastMedicalHistory}
                    onChange={(e) => setNewPastMedicalHistory(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddPastMedicalHistory())}
                    placeholder="Condition or history item"
                    className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddPastMedicalHistory}
                    disabled={!newPastMedicalHistory.trim()}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                  >
                    Add
                  </button>
                </div>
                {pastMedicalHistory.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No past medical history listed.</p>
                ) : (
                  <ul className="space-y-2">
                    {pastMedicalHistory.map((name, index) => (
                      <li
                        key={`${name}-${index}`}
                        className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                      >
                        <span>{name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemovePastMedicalHistory(index)}
                          className="rounded text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                          aria-label={`Remove ${name}`}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

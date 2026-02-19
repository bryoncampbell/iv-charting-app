"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Encounter, Patient } from "@/types";
import { getPatientDisplayName } from "@/types";
import { logAudit } from "@/lib/audit";
import { newId, nowIso } from "@/lib/ids";
import { parseLocalDate } from "@/lib/dates";
import { STORAGE_KEYS } from "@/lib/storage";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { patientRowToPatient, patientToRow, encounterToRow } from "@/lib/supabaseMappers";
import { useAuth } from "@/contexts/AuthContext";

const formatPhoneNumber = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

const normalizePhoneNumber = (phone: string): string => phone.replace(/\D/g, "");

export default function NewVisitPage() {
  const router = useRouter();
  const auth = useAuth();
  const createdBy = auth?.session?.user?.id ?? null;
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    phone: "",
  });

  useEffect(() => {
    if (isSupabaseConfigured() && supabase) {
      const token = auth?.session?.access_token;
      if (token) {
        fetch("/api/patients", { headers: { Authorization: `Bearer ${token}` } })
          .then((res) => {
            if (!res.ok) {
              if (res.status === 503) {
                return supabase.from("patients").select("*").order("created_at", { ascending: false }) as Promise<{ data: unknown[] | null; error: unknown }>;
              }
              return Promise.resolve({ data: null, error: new Error(res.statusText) });
            }
            return res.json().then((body: { data?: unknown[] }) => ({ data: body.data ?? [], error: null }));
          })
          .then((result) => {
            if (!result) return;
            const data = result.data ?? [];
            const err = result.error;
            if (err) {
              setPatients([]);
              return;
            }
            const list = (data as unknown[]).map((row) => patientRowToPatient(row));
            const formatted = list.map((p) => ({
              ...p,
              phone: p.phone ? formatPhoneNumber(normalizePhoneNumber(p.phone)) : undefined,
              allergies: p.allergies ?? [],
            }));
            setPatients(formatted);
          })
          .catch(() => setPatients([]));
        return;
      }
      supabase
        .from("patients")
        .select("*")
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (error) {
            setPatients([]);
            return;
          }
          const list = (data ?? []).map((row) => patientRowToPatient(row));
          const formatted = list.map((p) => ({
            ...p,
            phone: p.phone ? formatPhoneNumber(normalizePhoneNumber(p.phone)) : undefined,
            allergies: p.allergies ?? [],
          }));
          setPatients(formatted);
        });
      return;
    }
    const stored = localStorage.getItem(STORAGE_KEYS.patients);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const list = Array.isArray(parsed) ? parsed : [];
        const formatted = list.map((p: Patient) => ({
          ...p,
          phone: p.phone ? formatPhoneNumber(normalizePhoneNumber(p.phone)) : undefined,
          allergies: p.allergies ?? [],
        }));
        setPatients(formatted);
        if (list.length > 0) savePatients(formatted);
      } catch {
        setPatients([]);
      }
    } else {
      setPatients([]);
    }
  }, [auth?.session?.access_token]);

  function savePatients(patientsToSave: Patient[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.patients, JSON.stringify(patientsToSave));
    } catch (e) {
      console.error("Error saving patients:", e);
    }
  }

  const searchTrimmed = searchQuery.trim();
  const MIN_SEARCH_LENGTH = 2;
  const MIN_PHONE_DIGITS = 3;
  const MIN_DOB_LENGTH = 4;

  const filteredPatients =
    searchTrimmed.length < MIN_SEARCH_LENGTH
      ? patients
      : patients.filter((p) => {
          const q = searchTrimmed.toLowerCase();
          const normQ = normalizePhoneNumber(searchTrimmed);
          const first = p.firstName.toLowerCase();
          const last = p.lastName.toLowerCase();
          const fullName = getPatientDisplayName(p).toLowerCase();
          const phoneDigits = normalizePhoneNumber(p.phone ?? "");

          const nameMatch =
            first.startsWith(q) || last.startsWith(q) || fullName.startsWith(q);
          const dobMatch =
            searchTrimmed.length >= MIN_DOB_LENGTH &&
            (p.dob === searchTrimmed || p.dob.startsWith(searchTrimmed));
          const phoneMatch =
            normQ.length >= MIN_PHONE_DIGITS &&
            (phoneDigits === normQ || phoneDigits.startsWith(normQ));

          return nameMatch || dobMatch || phoneMatch;
        });

  const formatDate = (dateString: string) => {
    const d = parseLocalDate(dateString);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  };

  function startVisit(patient: Patient) {
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
    if (isSupabaseConfigured() && supabase) {
      supabase
        .from("encounters")
        .insert(encounterToRow(encounter, createdBy))
        .then(({ error }) => {
          if (error) {
            console.error("Error creating encounter in Supabase:", error);
            alert(`Could not start visit: ${error.message}\n\nCode: ${error.code}. Check Supabase: Table Editor → encounters, and RLS policies (allow INSERT for anon).`);
            return;
          }
          logAudit("encounter.create", "encounter", encounter.id, getPatientDisplayName(patient));
          // Brief delay so DB commit is visible before the next page loads
          setTimeout(() => router.push(`/encounters/${encounter.id}`), 600);
        });
      return;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.encounters);
      const encounters: Encounter[] = stored ? JSON.parse(stored) : [];
      encounters.push(encounter);
      localStorage.setItem(STORAGE_KEYS.encounters, JSON.stringify(encounters));
      logAudit("encounter.create", "encounter", encounter.id, getPatientDisplayName(patient));
    } catch (e) {
      console.error("Error saving encounter:", e);
    }
    router.push(`/encounters/${encounter.id}`);
  }

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName?.trim() || !formData.lastName?.trim() || !formData.dob || !formData.phone) {
      alert("Please fill in all required fields.");
      return;
    }
    const norm = normalizePhoneNumber(formData.phone);
    if (norm.length !== 10) {
      alert("Please enter a valid 10-digit phone number.");
      return;
    }
    const newPatient: Patient = {
      id: newId(),
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      dob: formData.dob,
      phone: formatPhoneNumber(norm),
      allergies: [],
    };

    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase.from("patients").insert(patientToRow(newPatient, createdBy));
      if (error) {
        console.error("Error creating patient in Supabase:", error);
        alert(`Could not add patient: ${error.message}`);
        return;
      }
      setPatients((prev) => [...prev, newPatient]);
      logAudit("patient.create", "patient", newPatient.id, getPatientDisplayName(newPatient));
      setFormData({ firstName: "", lastName: "", dob: "", phone: "" });
      setShowAddForm(false);
      setSearchQuery("");
      startVisit(newPatient);
      return;
    }

    const next = [...patients, newPatient];
    setPatients(next);
    savePatients(next);
    logAudit("patient.create", "patient", newPatient.id, getPatientDisplayName(newPatient));
    setFormData({ firstName: "", lastName: "", dob: "", phone: "" });
    setShowAddForm(false);
    setSearchQuery("");
    startVisit(newPatient);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "phone") {
      setFormData((prev) => ({ ...prev, [name]: formatPhoneNumber(value) }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/visits" className="text-sm text-gray-600 dark:text-gray-400 hover:underline">
            ← Back to Visits
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          New Visit
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Search for a patient to start a visit, or add a new patient if not found.
        </p>

        {/* Search */}
        <div className="mt-6">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Search patients
          </label>
          <div className="relative mt-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              id="search"
              type="text"
              placeholder="Name, phone, or date of birth..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
            />
          </div>
        </div>

        {/* Results — show established patients; filter by name, DOB, or phone when 2+ chars */}
        <div className="mt-6 rounded-lg border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-800">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {searchTrimmed ? "Search results" : "Established patients"}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {searchTrimmed
                ? `${filteredPatients.length} ${filteredPatients.length === 1 ? "patient" : "patients"} matching "${searchTrimmed}"`
                : `${patients.length} established ${patients.length === 1 ? "patient" : "patients"}. Filter by name, date of birth, or phone (2+ characters).`}
            </p>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredPatients.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {searchTrimmed ? "No patients found matching your search." : "No established patients yet."}
                </p>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  Add a new patient to get started.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add new patient
                </button>
              </div>
            ) : (
              filteredPatients.map((patient) => (
                <div
                  key={patient.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/patients/${patient.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/patients/${patient.id}`);
                    }
                  }}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:flex-nowrap cursor-pointer transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-transparent hover:border-gray-200 dark:hover:border-gray-700 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {getPatientDisplayName(patient)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      DOB: {formatDate(patient.dob)}
                      {patient.phone ? ` · ${patient.phone}` : ""}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      Click to view full profile and visit history
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startVisit(patient);
                    }}
                    className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Start visit
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Add new patient (show when there are results too) */}
        <div className="mt-6">
          {!showAddForm ? (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add new patient
            </button>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                New patient
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Add a patient not in the list. You will start a visit for them after saving.
              </p>
              <form onSubmit={handleAddPatient} className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      First name *
                    </label>
                    <input
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Last name *
                    </label>
                    <input
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      placeholder="Last name"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="dob" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Date of birth *
                  </label>
                  <input
                    id="dob"
                    name="dob"
                    type="date"
                    value={formData.dob}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Phone *
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Add patient and start visit
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddForm(false); setFormData({ firstName: "", lastName: "", dob: "", phone: "" }); }}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

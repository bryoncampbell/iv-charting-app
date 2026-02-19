"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Patient } from "@/types";
import { getPatientDisplayName } from "@/types";
import { logAudit } from "@/lib/audit";
import { newId } from "@/lib/ids";
import { parseLocalDate } from "@/lib/dates";
import { STORAGE_KEYS } from "@/lib/storage";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { patientRowToPatient, patientToRow, type PatientRow } from "@/lib/supabaseMappers";
import { useAuth } from "@/contexts/AuthContext";

// Format phone number to (XXX) XXX-XXXX
const formatPhoneNumber = (value: string): string => {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, "");
  
  // Format based on length
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

// Normalize phone number (remove formatting for storage/search)
const normalizePhoneNumber = (phone: string): string => {
  return phone.replace(/\D/g, "");
};

export default function PatientsPage() {
  const router = useRouter();
  const auth = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    phone: "",
  });

  // Load patients: use API (service role) when Supabase + session so all users see all patients; else client Supabase or localStorage
  useEffect(() => {
    let cancelled = false;
    if (isSupabaseConfigured() && supabase) {
      const client = supabase;
      const token = auth?.session?.access_token;
      if (token) {
        fetch("/api/patients", { headers: { Authorization: `Bearer ${token}` } })
          .then((res): Promise<{ data: unknown[] | null; error: unknown }> => {
            if (cancelled) return Promise.resolve({ data: null, error: null });
            if (!res.ok) {
              if (res.status === 503) {
                // No service role – fall back to client (RLS applies)
                return Promise.resolve(
                  client.from("patients").select("*").order("created_at", { ascending: false }).then((r) => ({ data: r.data ?? null, error: (r.error ?? null) as unknown }))
                );
              }
              return Promise.resolve({ data: null, error: new Error(res.statusText) as unknown });
            }
            return res.json().then((body: { data?: unknown[] }) => ({ data: body.data ?? [], error: null }));
          })
          .then((result) => {
            if (cancelled || !result) return;
            const data = result.data ?? [];
            const error = result.error;
            if (error) {
              console.error("Error loading patients:", error);
              setPatients([]);
              return;
            }
            const list = (data as unknown[]).map((row) => patientRowToPatient(row as PatientRow));
            const formatted = list.map((p) => ({
              ...p,
              phone: p.phone ? formatPhoneNumber(normalizePhoneNumber(p.phone)) : undefined,
              allergies: p.allergies ?? [],
            }));
            console.log(`Loaded ${formatted.length} patients from API`);
            setPatients(formatted);
          })
          .catch((err) => {
            if (!cancelled) {
              console.error("Error loading patients:", err);
              setPatients([]);
            }
          });
        return () => { cancelled = true; };
      }
      // No session yet – use client Supabase (RLS applies)
      client
        .from("patients")
        .select("*")
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (cancelled || error) {
            if (error) console.error("Error loading patients from Supabase:", error);
            if (!cancelled) setPatients([]);
            return;
          }
          const list = (data ?? []).map((row) => patientRowToPatient(row));
          const formatted = list.map((p) => ({
            ...p,
            phone: p.phone ? formatPhoneNumber(normalizePhoneNumber(p.phone)) : undefined,
            allergies: p.allergies ?? [],
          }));
          console.log(`Loaded ${formatted.length} patients from Supabase client`);
          if (!cancelled) setPatients(formatted);
        });
      return () => { cancelled = true; };
    }
    const stored = localStorage.getItem(STORAGE_KEYS.patients);
    if (stored) {
      try {
        const parsedPatients = JSON.parse(stored);
        const list = Array.isArray(parsedPatients) ? parsedPatients : [];
        const formattedPatients = list.map((patient: Patient) => ({
          ...patient,
          phone: patient.phone ? formatPhoneNumber(normalizePhoneNumber(patient.phone)) : undefined,
          allergies: patient.allergies ?? [],
        }));
        setPatients(formattedPatients);
        if (list.length > 0) savePatients(formattedPatients);
      } catch (error) {
        console.error("Error loading patients from localStorage:", error);
        setPatients([]);
      }
    } else {
      setPatients([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.session?.access_token]);

  // Save patients to localStorage
  const savePatients = (patientsToSave: Patient[]) => {
    try {
      localStorage.setItem(STORAGE_KEYS.patients, JSON.stringify(patientsToSave));
    } catch (error) {
      console.error("Error saving patients to localStorage:", error);
    }
  };

  // Show all established patients; filter by name, DOB, or phone when user types 2+ characters
  const searchTrimmed = searchQuery.trim();
  const MIN_SEARCH_LENGTH = 2;
  const MIN_PHONE_DIGITS = 3;
  const MIN_DOB_LENGTH = 4;

  const filteredPatients =
    searchTrimmed.length < MIN_SEARCH_LENGTH
      ? patients
      : patients.filter((patient) => {
          const q = searchTrimmed.toLowerCase();
          const normQ = normalizePhoneNumber(searchTrimmed);
          const first = patient.firstName.toLowerCase();
          const last = patient.lastName.toLowerCase();
          const fullName = getPatientDisplayName(patient).toLowerCase();
          const phoneDigits = normalizePhoneNumber(patient.phone ?? "");

          const nameMatch =
            first.startsWith(q) || last.startsWith(q) || fullName.startsWith(q);
          const dobMatch =
            searchTrimmed.length >= MIN_DOB_LENGTH &&
            (patient.dob === searchTrimmed || patient.dob.startsWith(searchTrimmed));
          const phoneMatch =
            normQ.length >= MIN_PHONE_DIGITS &&
            (phoneDigits === normQ || phoneDigits.startsWith(normQ));

          return nameMatch || dobMatch || phoneMatch;
        });

  const formatDate = (dateString: string) => {
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleAddPatient = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData({ firstName: "", lastName: "", dob: "", phone: "" });
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    
    // Auto-format phone numbers as user types
    if (name === "phone") {
      const formatted = formatPhoneNumber(value);
      setFormData((prev) => ({ ...prev, [name]: formatted }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName?.trim() || !formData.lastName?.trim() || !formData.dob || !formData.phone) {
      alert("Please fill in all required fields");
      return;
    }

    const normalizedPhone = normalizePhoneNumber(formData.phone);
    if (normalizedPhone.length !== 10) {
      alert("Please enter a valid 10-digit phone number");
      return;
    }

    const newPatient: Patient = {
      id: newId(),
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      dob: formData.dob,
      phone: formatPhoneNumber(normalizedPhone),
      allergies: [],
    };

    if (isSupabaseConfigured() && supabase) {
      supabase
        .from("patients")
        .insert(patientToRow(newPatient))
        .then(({ error }) => {
          if (error) {
            console.error("Error creating patient in Supabase:", error);
            alert(`Could not save patient to database: ${error.message}\n\nCode: ${error.code}. Check Supabase dashboard (Table Editor, RLS, and API logs).`);
            return;
          }
          setPatients((prev) => [...prev, newPatient]);
          logAudit("patient.create", "patient", newPatient.id, getPatientDisplayName(newPatient));
          handleCloseModal();
        });
      return;
    }

    const updatedPatients = [...patients, newPatient];
    setPatients(updatedPatients);
    savePatients(updatedPatients);
    logAudit("patient.create", "patient", newPatient.id, getPatientDisplayName(newPatient));
    handleCloseModal();
  };

  const handleModalBackdropClick = (
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    if (e.target === e.currentTarget) {
      handleCloseModal();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Patients
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Manage patient information and records
              {typeof window !== "undefined" && (
                <span className="ml-2 text-xs">
                  (Storage: {isSupabaseConfigured() && supabase ? "Supabase" : "Local"})
                </span>
              )}
            </p>
          </div>
          <button
            onClick={handleAddPatient}
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
            New Patient
          </button>
        </div>

        {/* Search Bar — patients list only shows matching results (name, DOB, or phone) */}
        <div className="mb-6">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by name, date of birth, or phone number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-3 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-400 dark:focus:ring-blue-400"
            />
          </div>
        </div>

        {/* Patient List — only populates with matching patients */}
        <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
          <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 sm:px-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Patient List
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {searchTrimmed
                ? `${filteredPatients.length} ${filteredPatients.length === 1 ? "patient" : "patients"} matching "${searchTrimmed}"`
                : `${patients.length} established ${patients.length === 1 ? "patient" : "patients"}. Filter by name, date of birth, or phone (2+ characters).`}
            </p>
          </div>

          <div className="overflow-x-auto">
            {filteredPatients.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {searchTrimmed ? "No patients found matching your search." : "No established patients yet."}
                </p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:px-6">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:px-6">
                      Date of Birth
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:px-6">
                      Phone
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                  {filteredPatients.map((patient) => (
                    <tr
                      key={patient.id}
                      onClick={() => router.push(`/patients/${patient.id}`)}
                      className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-gray-900 dark:text-white sm:px-6">
                        {getPatientDisplayName(patient)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600 dark:text-gray-400 sm:px-6">
                        {formatDate(patient.dob)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600 dark:text-gray-400 sm:px-6">
                        {patient.phone ? formatPhoneNumber(normalizePhoneNumber(patient.phone)) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={handleModalBackdropClick}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white shadow-xl dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  New Patient
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="rounded-md text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">First name *</label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Last name *</label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
                      placeholder="Last name"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="dob"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    id="dob"
                    name="dob"
                    value={formData.dob}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Phone *
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  Add Patient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

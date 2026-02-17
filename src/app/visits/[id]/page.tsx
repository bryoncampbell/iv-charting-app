"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Encounter, Patient } from "@/types";
import { getPatientDisplayName } from "@/types";
import { nowIso } from "@/lib/ids";
import { parseLocalDate } from "@/lib/dates";
import { STORAGE_KEYS } from "@/lib/storage";

export default function VisitPage() {
  const params = useParams();
  const router = useRouter();
  const encounterId = params.id as string;

  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [treatment, setTreatment] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadEncounter();
  }, [encounterId]);

  const loadEncounter = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.encounters);
      if (stored) {
        const encounters: Encounter[] = JSON.parse(stored);
        const foundEncounter = encounters.find((e) => e.id === encounterId);
        if (foundEncounter) {
          setEncounter(foundEncounter);
          setTreatment(foundEncounter.treatment || "");
          setNotes(foundEncounter.notes || "");

          // Load patient info
          const patientsStored = localStorage.getItem(STORAGE_KEYS.patients);
          if (patientsStored) {
            const patients: Patient[] = JSON.parse(patientsStored);
            const foundPatient = patients.find(
              (p) => p.id === foundEncounter.patientId
            );
            if (foundPatient) {
              setPatient(foundPatient);
            }
          }
        }
      }
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading encounter:", error);
      setIsLoading(false);
    }
  };

  const saveEncounter = (updatedTreatment?: string, updatedNotes?: string) => {
    if (!encounter) return;

    const treatmentToSave = updatedTreatment !== undefined ? updatedTreatment : treatment;
    const notesToSave = updatedNotes !== undefined ? updatedNotes : notes;

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.encounters);
      if (stored) {
        const encounters: Encounter[] = JSON.parse(stored);
        const updatedEncounters = encounters.map((e) =>
          e.id === encounter.id
            ? { ...e, treatment: treatmentToSave, notes: notesToSave }
            : e
        );
        localStorage.setItem(
          STORAGE_KEYS.encounters,
          JSON.stringify(updatedEncounters)
        );
        setEncounter({ ...encounter, treatment: treatmentToSave, notes: notesToSave });
      }
    } catch (error) {
      console.error("Error saving encounter:", error);
    }
  };

  const handleCompleteVisit = () => {
    if (!encounter) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.encounters);
      if (stored) {
        const encounters: Encounter[] = JSON.parse(stored);
        const updatedEncounters = encounters.map((e) =>
          e.id === encounter.id
            ? { ...e, status: "completed" as const, treatment, notes, updatedAt: nowIso() }
            : e
        );
        localStorage.setItem(
          STORAGE_KEYS.encounters,
          JSON.stringify(updatedEncounters)
        );
      }
      router.push("/visits");
    } catch (error) {
      console.error("Error completing visit:", error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!encounter) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Visit Not Found
            </h1>
            <Link
              href="/visits"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              ← Back to Visits
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
            href="/visits"
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
            Back to Visits
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Visit - {encounter.patientName ?? "Unknown"}
              </h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {encounter.date ? formatDate(encounter.date) : formatDate(encounter.createdAt)} at {encounter.time ?? ""}
              </p>
            </div>
            <div className="flex gap-3">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  encounter.status === "completed"
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                }`}
              >
                {encounter.status === "completed" ? "Completed" : encounter.status === "ready_for_provider" ? "Ready for provider" : encounter.status === "in_progress" ? "In progress" : encounter.status}
              </span>
              {(encounter.status === "in_progress" || encounter.status === "draft") && (
                <button
                  onClick={handleCompleteVisit}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:bg-green-500 dark:hover:bg-green-600"
                >
                  Complete Visit
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Patient Info */}
        {patient && (
          <div className="mb-6 rounded-lg bg-white p-4 shadow dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <Link
                  href={`/patients/${patient.id}`}
                  className="text-lg font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  {getPatientDisplayName(patient)}
                </Link>
                {patient.allergies && patient.allergies.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs font-medium text-red-600 dark:text-red-400">
                      Allergies: {patient.allergies.map((a) => a.allergen).join(", ")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Visit Details Form */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Treatment
              </h2>
            </div>
            <div className="px-6 py-4">
              <select
                value={treatment}
                onChange={(e) => {
                  const newTreatment = e.target.value;
                  setTreatment(newTreatment);
                  saveEncounter(newTreatment, notes);
                }}
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400"
              >
                <option value="">Select treatment...</option>
                <option value="IV Hydration">IV Hydration</option>
                <option value="Vitamin Boost">Vitamin Boost</option>
                <option value="Energy Boost">Energy Boost</option>
                <option value="Recovery Drip">Recovery Drip</option>
                <option value="Hangover Relief">Hangover Relief</option>
                <option value="Immune Support">Immune Support</option>
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Notes
              </h2>
            </div>
            <div className="px-6 py-4">
              <textarea
                value={notes}
                onChange={(e) => {
                  const newNotes = e.target.value;
                  setNotes(newNotes);
                  saveEncounter(treatment, newNotes);
                }}
                rows={6}
                placeholder="Add visit notes..."
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

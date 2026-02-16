"use client";

import { useState } from "react";

interface Patient {
  id: string;
  name: string;
  dob: string;
  phone: string;
}

export default function PatientsPage() {
  const [patients] = useState<Patient[]>([
    {
      id: "1",
      name: "John Smith",
      dob: "1980-05-15",
      phone: "(555) 123-4567",
    },
    {
      id: "2",
      name: "Sarah Johnson",
      dob: "1992-08-22",
      phone: "(555) 234-5678",
    },
    {
      id: "3",
      name: "Michael Brown",
      dob: "1967-11-03",
      phone: "(555) 345-6789",
    },
    {
      id: "4",
      name: "Emily Davis",
      dob: "1995-02-18",
      phone: "(555) 456-7890",
    },
    {
      id: "5",
      name: "Robert Wilson",
      dob: "1958-09-27",
      phone: "(555) 567-8901",
    },
  ]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleAddPatient = () => {
    // Placeholder for add patient functionality
    alert("Add New Patient form would open here");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              IV Hydration Clinic - Patients
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Manage patient information and records
            </p>
          </div>
          <button
            onClick={handleAddPatient}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
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
            Add New Patient
          </button>
        </div>

        {/* Patient List */}
        <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Patient List
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {patients.length} total patients
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Date of Birth
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Phone
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                {patients.map((patient) => (
                  <tr
                    key={patient.id}
                    className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                      {patient.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(patient.dob)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {patient.phone}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

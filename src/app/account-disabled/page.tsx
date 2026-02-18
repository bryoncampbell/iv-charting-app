"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function AccountDisabledPage() {
  const auth = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow max-w-md w-full text-center">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Account disabled</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Your access has been deactivated. Contact an administrator to restore access.
        </p>
        <button
          type="button"
          onClick={() => auth?.signOut()}
          className="mt-6 rounded-lg bg-gray-200 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          Sign out
        </button>
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          <Link href="/login" className="text-blue-600 dark:text-blue-400 hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import type { AppRole } from "@/types/profile";

type AdminUser = {
  id: string;
  email?: string;
  created_at: string;
  last_sign_in_at?: string;
  banned_until?: string;
  role: string;
  display_name: string | null;
  is_active: boolean;
  profile_updated_at: string | null;
};

function getAuthHeaders(session: { access_token: string }): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

export default function AdminPage() {
  const auth = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sendingResetId, setSendingResetId] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [createEmail, setCreateEmail] = useState("");
  const [createDisplayName, setCreateDisplayName] = useState("");
  const [createRole, setCreateRole] = useState<AppRole>("nursing");
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{ email: string; temporary_password: string; email_sent: boolean } | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (!auth?.session?.access_token || !auth?.user) {
      setLoading(false);
      return;
    }
    setAccessDenied(false);
    const token = auth.session.access_token;
    fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (r.ok) return r.json();
        if (r.status === 403) return { users: null, forbidden: true };
        return Promise.reject(new Error(r.statusText));
      })
      .then((data) => {
        if (data?.forbidden) {
          setAccessDenied(true);
          setError(null);
          setUsers([]);
          return;
        }
        setAccessDenied(false);
        setUsers(data.users ?? []);
        setError(null);
      })
      .catch((e) => {
        setError(e.message ?? "Failed to load users");
        setUsers([]);
      })
      .finally(() => setLoading(false));
  }, [auth?.session?.access_token, auth?.user]);

  const handleUpdateRole = async (userId: string, role: AppRole) => {
    if (!auth?.session?.access_token) return;
    setEditingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: getAuthHeaders(auth.session),
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? res.statusText);
      }
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
      setEditingId(null);
    } catch (e) {
      alert((e as Error).message);
      setEditingId(null);
    }
  };

  const handleSendPasswordReset = async (userId: string) => {
    if (!auth?.session?.access_token) return;
    setSendingResetId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/send-password-reset`, {
        method: "POST",
        headers: getAuthHeaders(auth.session),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = /rate limit|rate_limit|429/i.test(data.error ?? res.statusText)
          ? "Email rate limit exceeded. Wait an hour and try again."
          : (data.error ?? res.statusText);
        throw new Error(msg);
      }
      setSendingResetId(null);
      alert("Password reset email sent.");
    } catch (e) {
      alert((e as Error).message);
      setSendingResetId(null);
    }
  };

  const handleDeactivate = async (userId: string, ban: boolean) => {
    if (!auth?.session?.access_token) return;
    if (!confirm(ban ? "Ban this user from signing in?" : "Deactivate this user? They will not see app data until an admin reactivates them.")) return;
    setDeactivatingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/deactivate`, {
        method: "POST",
        headers: getAuthHeaders(auth.session),
        body: JSON.stringify({ ban }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? res.statusText);
      }
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active: false } : u)));
      setDeactivatingId(null);
    } catch (e) {
      alert((e as Error).message);
      setDeactivatingId(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.session?.access_token) return;
    setCreating(true);
    setCreateResult(null);
    try {
      const res = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: getAuthHeaders(auth.session),
        body: JSON.stringify({
          email: createEmail.trim(),
          display_name: createDisplayName.trim() || undefined,
          role: createRole,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setCreateResult({
        email: data.user?.email ?? createEmail,
        temporary_password: data.temporary_password ?? "",
        email_sent: data.email_sent ?? false,
      });
      setCreateEmail("");
      setCreateDisplayName("");
      setUsers((prev) => [...prev, { id: data.user.id, email: data.user.email, role: data.user.role, display_name: data.user.display_name, is_active: true, created_at: "", last_sign_in_at: undefined, banned_until: undefined, profile_updated_at: null }]);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleReactivate = async (userId: string) => {
    if (!auth?.session?.access_token) return;
    setEditingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: getAuthHeaders(auth.session),
        body: JSON.stringify({ is_active: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? res.statusText);
      }
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active: true } : u)));
      setEditingId(null);
    } catch (e) {
      alert((e as Error).message);
      setEditingId(null);
    }
  };

  if (!auth?.user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <p className="text-gray-600 dark:text-gray-400">Sign in to continue.</p>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <p className="text-gray-600 dark:text-gray-400">Loading…</p>
      </div>
    );
  }
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow max-w-md w-full text-center">
          <p className="text-gray-600 dark:text-gray-400">You don’t have access to this page.</p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">Your account must have the Admin role. Ask an admin or run in Supabase SQL: update profiles set role = 'admin' where user_id = 'your-user-uid';</p>
          <Link href="/dashboard" className="mt-4 inline-block text-blue-600 dark:text-blue-400">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm text-gray-600 dark:text-gray-400 hover:underline">← Dashboard</Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User management</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Create users (admin-only), assign roles, send password resets, and deactivate or ban users.
        </p>

        {/* Create user */}
        <div className="mt-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create user</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            The user will receive an email with a temporary password (if RESEND_API_KEY is set) or you can copy it and send it to them. They must set a new password on first sign-in.
          </p>
          {createResult && (
            <div className="mt-4 rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-sm">
              <p className="font-medium text-green-800 dark:text-green-300">User created.</p>
              <p className="mt-1 text-green-700 dark:text-green-400">
                {createResult.email_sent ? "A welcome email with the temporary password was sent." : "Copy the temporary password and send it to the user:"}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 rounded bg-gray-200 dark:bg-gray-700 px-2 py-1 font-mono text-sm">{createResult.temporary_password}</code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(createResult.temporary_password)}
                  className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Copy
                </button>
              </div>
              <button type="button" onClick={() => setCreateResult(null)} className="mt-2 text-sm text-gray-600 dark:text-gray-400 hover:underline">Dismiss</button>
            </div>
          )}
          {!createResult && (
            <form onSubmit={handleCreateUser} className="mt-4 flex flex-wrap items-end gap-4">
              <div>
                <label htmlFor="create-email" className="block text-xs font-medium text-gray-500 dark:text-gray-400">Email</label>
                <input
                  id="create-email"
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  required
                  className="mt-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="create-display-name" className="block text-xs font-medium text-gray-500 dark:text-gray-400">Display name (optional)</label>
                <input
                  id="create-display-name"
                  type="text"
                  value={createDisplayName}
                  onChange={(e) => setCreateDisplayName(e.target.value)}
                  className="mt-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="create-role" className="block text-xs font-medium text-gray-500 dark:text-gray-400">Role</label>
                <select
                  id="create-role"
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as AppRole)}
                  className="mt-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  <option value="nursing">Nursing</option>
                  <option value="provider">Provider</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={creating}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create user"}
              </button>
            </form>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <p className="mt-6 text-gray-600 dark:text-gray-400">Loading users…</p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Last sign-in</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((u) => (
                  <tr key={u.id} className={!u.is_active ? "bg-gray-100 dark:bg-gray-800/50" : ""}>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {u.email ?? "(no email)"}
                      {u.id === auth.user?.id && <span className="ml-2 text-gray-500">(you)</span>}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        disabled={editingId === u.id || u.id === auth.user?.id}
                        onChange={(e) => handleUpdateRole(u.id, e.target.value as AppRole)}
                        className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-white"
                      >
                        <option value="nursing">Nursing</option>
                        <option value="provider">Provider</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {u.is_active ? (
                        <span className="text-green-600 dark:text-green-400">Active</span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">Inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <button
                        type="button"
                        onClick={() => handleSendPasswordReset(u.id)}
                        disabled={sendingResetId === u.id || !u.email}
                        className="text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 mr-3"
                      >
                        {sendingResetId === u.id ? "Sending…" : "Send password reset"}
                      </button>
                      {u.is_active && u.id !== auth.user?.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleDeactivate(u.id, false)}
                            disabled={deactivatingId === u.id}
                            className="text-amber-600 dark:text-amber-400 hover:underline disabled:opacity-50 mr-3"
                          >
                            Deactivate
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeactivate(u.id, true)}
                            disabled={deactivatingId === u.id}
                            className="text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                          >
                            Ban
                          </button>
                        </>
                      ) : !u.is_active && u.id !== auth.user?.id ? (
                        <button
                          type="button"
                          onClick={() => handleReactivate(u.id)}
                          disabled={editingId === u.id}
                          className="text-green-600 dark:text-green-400 hover:underline disabled:opacity-50"
                        >
                          Reactivate
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

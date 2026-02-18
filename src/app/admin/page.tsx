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
  first_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null;
  phone?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  license_type?: string | null;
  license_number?: string | null;
  license_state?: string | null;
  license_expiry?: string | null;
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
  const [createFirstName, setCreateFirstName] = useState("");
  const [createLastName, setCreateLastName] = useState("");
  const [createDob, setCreateDob] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createStreetAddress, setCreateStreetAddress] = useState("");
  const [createCity, setCreateCity] = useState("");
  const [createState, setCreateState] = useState("");
  const [createZipCode, setCreateZipCode] = useState("");
  const [createLicenseType, setCreateLicenseType] = useState("");
  const [createLicenseNumber, setCreateLicenseNumber] = useState("");
  const [createLicenseState, setCreateLicenseState] = useState("");
  const [createLicenseExpiry, setCreateLicenseExpiry] = useState("");
  const [createRole, setCreateRole] = useState<AppRole>("nursing");
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{ email: string; temporary_password: string; email_sent: boolean } | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editProfileForm, setEditProfileForm] = useState<Partial<AdminUser>>({});

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
          first_name: createFirstName.trim() || undefined,
          last_name: createLastName.trim() || undefined,
          date_of_birth: createDob.trim() || undefined,
          phone: createPhone.trim() || undefined,
          street_address: createStreetAddress.trim() || undefined,
          city: createCity.trim() || undefined,
          state: createState.trim() || undefined,
          zip_code: createZipCode.trim() || undefined,
          license_type: createLicenseType.trim() || undefined,
          license_number: createLicenseNumber.trim() || undefined,
          license_state: createLicenseState.trim() || undefined,
          license_expiry: createLicenseExpiry.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setCreateResult({
        email: data.user?.email ?? createEmail,
        temporary_password: data.temporary_password ?? "",
        email_sent: data.email_sent ?? false,
      });
      const newUser: AdminUser = {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        display_name: data.user.display_name,
        is_active: true,
        created_at: "",
        last_sign_in_at: undefined,
        banned_until: undefined,
        profile_updated_at: null,
        first_name: createFirstName.trim() || null,
        last_name: createLastName.trim() || null,
        date_of_birth: createDob.trim() || null,
        phone: createPhone.trim() || null,
        street_address: createStreetAddress.trim() || null,
        city: createCity.trim() || null,
        state: createState.trim() || null,
        zip_code: createZipCode.trim() || null,
        license_type: createLicenseType.trim() || null,
        license_number: createLicenseNumber.trim() || null,
        license_state: createLicenseState.trim() || null,
        license_expiry: createLicenseExpiry.trim() || null,
      };
      setCreateEmail("");
      setCreateDisplayName("");
      setCreateFirstName("");
      setCreateLastName("");
      setCreateDob("");
      setCreatePhone("");
      setCreateStreetAddress("");
      setCreateCity("");
      setCreateState("");
      setCreateZipCode("");
      setCreateLicenseType("");
      setCreateLicenseNumber("");
      setCreateLicenseState("");
      setCreateLicenseExpiry("");
      setUsers((prev) => [...prev, newUser]);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const openEditProfile = (u: AdminUser) => {
    setEditingProfileId(u.id);
    setEditProfileForm({
      first_name: u.first_name ?? "",
      last_name: u.last_name ?? "",
      date_of_birth: u.date_of_birth ?? "",
      phone: u.phone ?? "",
      street_address: u.street_address ?? "",
      city: u.city ?? "",
      state: u.state ?? "",
      zip_code: u.zip_code ?? "",
      license_type: u.license_type ?? "",
      license_number: u.license_number ?? "",
      license_state: u.license_state ?? "",
      license_expiry: u.license_expiry ?? "",
      display_name: u.display_name ?? "",
    });
  };

  const handleSaveProfile = async () => {
    if (!editingProfileId || !auth?.session?.access_token) return;
    try {
      const res = await fetch(`/api/admin/users/${editingProfileId}`, {
        method: "PATCH",
        headers: getAuthHeaders(auth.session),
        body: JSON.stringify({
          display_name: editProfileForm.display_name?.trim() || null,
          first_name: editProfileForm.first_name?.trim() || null,
          last_name: editProfileForm.last_name?.trim() || null,
          date_of_birth: editProfileForm.date_of_birth?.trim() || null,
          phone: editProfileForm.phone?.trim() || null,
          street_address: editProfileForm.street_address?.trim() || null,
          city: editProfileForm.city?.trim() || null,
          state: editProfileForm.state?.trim() || null,
          zip_code: editProfileForm.zip_code?.trim() || null,
          license_type: editProfileForm.license_type?.trim() || null,
          license_number: editProfileForm.license_number?.trim() || null,
          license_state: editProfileForm.license_state?.trim() || null,
          license_expiry: editProfileForm.license_expiry?.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? res.statusText);
      }
      setUsers((prev) => prev.map((u) => (u.id === editingProfileId ? { ...u, ...editProfileForm } : u)));
      setEditingProfileId(null);
    } catch (e) {
      alert((e as Error).message);
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
        <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow max-w-lg w-full text-center">
          <p className="text-gray-600 dark:text-gray-400">You don’t have access to this page.</p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">Your account must have the Admin role. Run this in Supabase (SQL Editor):</p>
          <pre className="mt-3 text-left text-xs bg-gray-100 dark:bg-gray-900 p-3 rounded overflow-x-auto whitespace-pre-wrap">
{`-- Update existing profile to admin:
update profiles set role = 'admin', is_active = true where user_id = '${auth?.user?.id ?? ""}';

-- If you have no row yet:
insert into profiles (user_id, email, role, is_active)
values ('${auth?.user?.id ?? ""}', (select email from auth.users where id = '${auth?.user?.id ?? ""}'), 'admin', true)
on conflict (user_id) do update set role = 'admin', is_active = true;`}
          </pre>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">Your user ID: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{auth?.user?.id ?? "—"}</code></p>
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
            <form onSubmit={handleCreateUser} className="mt-4 space-y-6">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Login & role</p>
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <label htmlFor="create-email" className="block text-xs font-medium text-gray-500 dark:text-gray-400">Email *</label>
                    <input id="create-email" type="email" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} required className="mt-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white w-52" />
                  </div>
                  <div>
                    <label htmlFor="create-display-name" className="block text-xs font-medium text-gray-500 dark:text-gray-400">Display name</label>
                    <input id="create-display-name" type="text" value={createDisplayName} onChange={(e) => setCreateDisplayName(e.target.value)} className="mt-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white w-40" />
                  </div>
                  <div>
                    <label htmlFor="create-role" className="block text-xs font-medium text-gray-500 dark:text-gray-400">Role</label>
                    <select id="create-role" value={createRole} onChange={(e) => setCreateRole(e.target.value as AppRole)} className="mt-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white">
                      <option value="nursing">Nursing</option>
                      <option value="provider">Provider</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Profile (optional) — used for chart signing</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label htmlFor="create-first-name" className="block text-xs font-medium text-gray-500 dark:text-gray-400">First name</label>
                    <input id="create-first-name" type="text" value={createFirstName} onChange={(e) => setCreateFirstName(e.target.value)} className="mt-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white w-full" />
                  </div>
                  <div>
                    <label htmlFor="create-last-name" className="block text-xs font-medium text-gray-500 dark:text-gray-400">Last name</label>
                    <input id="create-last-name" type="text" value={createLastName} onChange={(e) => setCreateLastName(e.target.value)} className="mt-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white w-full" />
                  </div>
                  <div>
                    <label htmlFor="create-dob" className="block text-xs font-medium text-gray-500 dark:text-gray-400">Date of birth</label>
                    <input id="create-dob" type="date" value={createDob} onChange={(e) => setCreateDob(e.target.value)} className="mt-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white w-full" />
                  </div>
                  <div>
                    <label htmlFor="create-phone" className="block text-xs font-medium text-gray-500 dark:text-gray-400">Phone</label>
                    <input id="create-phone" type="tel" value={createPhone} onChange={(e) => setCreatePhone(e.target.value)} placeholder="(555) 123-4567" className="mt-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white w-full" />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="create-street" className="block text-xs font-medium text-gray-500 dark:text-gray-400">Street address</label>
                    <input id="create-street" type="text" value={createStreetAddress} onChange={(e) => setCreateStreetAddress(e.target.value)} className="mt-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white w-full" />
                  </div>
                  <div>
                    <label htmlFor="create-city" className="block text-xs font-medium text-gray-500 dark:text-gray-400">City</label>
                    <input id="create-city" type="text" value={createCity} onChange={(e) => setCreateCity(e.target.value)} className="mt-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white w-full" />
                  </div>
                  <div>
                    <label htmlFor="create-state" className="block text-xs font-medium text-gray-500 dark:text-gray-400">State</label>
                    <input id="create-state" type="text" value={createState} onChange={(e) => setCreateState(e.target.value)} placeholder="e.g. TX" className="mt-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white w-full" />
                  </div>
                  <div>
                    <label htmlFor="create-zip" className="block text-xs font-medium text-gray-500 dark:text-gray-400">ZIP code</label>
                    <input id="create-zip" type="text" value={createZipCode} onChange={(e) => setCreateZipCode(e.target.value)} className="mt-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white w-full" />
                  </div>
                  <div>
                    <label htmlFor="create-license-type" className="block text-xs font-medium text-gray-500 dark:text-gray-400">License type</label>
                    <input id="create-license-type" type="text" value={createLicenseType} onChange={(e) => setCreateLicenseType(e.target.value)} placeholder="e.g. RN, LPN, MD" className="mt-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white w-full" />
                  </div>
                  <div>
                    <label htmlFor="create-license-number" className="block text-xs font-medium text-gray-500 dark:text-gray-400">License number</label>
                    <input id="create-license-number" type="text" value={createLicenseNumber} onChange={(e) => setCreateLicenseNumber(e.target.value)} className="mt-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white w-full" />
                  </div>
                  <div>
                    <label htmlFor="create-license-state" className="block text-xs font-medium text-gray-500 dark:text-gray-400">License state</label>
                    <input id="create-license-state" type="text" value={createLicenseState} onChange={(e) => setCreateLicenseState(e.target.value)} placeholder="e.g. TX" className="mt-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white w-full" />
                  </div>
                  <div>
                    <label htmlFor="create-license-expiry" className="block text-xs font-medium text-gray-500 dark:text-gray-400">License expiry</label>
                    <input id="create-license-expiry" type="date" value={createLicenseExpiry} onChange={(e) => setCreateLicenseExpiry(e.target.value)} className="mt-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white w-full" />
                  </div>
                </div>
              </div>
              <button type="submit" disabled={creating} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
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
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Name</th>
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
                      {[u.first_name, u.last_name].filter(Boolean).join(" ") || u.display_name || "—"}
                    </td>
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
                        onClick={() => openEditProfile(u)}
                        className="text-gray-600 dark:text-gray-400 hover:underline mr-3"
                      >
                        Edit profile
                      </button>
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

        {/* Edit profile modal */}
        {editingProfileId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditingProfileId(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit profile</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Name, address, and license info are used when signing chart actions.</p>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">First name</label>
                    <input type="text" value={editProfileForm.first_name ?? ""} onChange={(e) => setEditProfileForm((f) => ({ ...f, first_name: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Last name</label>
                    <input type="text" value={editProfileForm.last_name ?? ""} onChange={(e) => setEditProfileForm((f) => ({ ...f, last_name: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Display name</label>
                  <input type="text" value={editProfileForm.display_name ?? ""} onChange={(e) => setEditProfileForm((f) => ({ ...f, display_name: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Date of birth</label>
                  <input type="date" value={editProfileForm.date_of_birth ?? ""} onChange={(e) => setEditProfileForm((f) => ({ ...f, date_of_birth: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Phone</label>
                  <input type="tel" value={editProfileForm.phone ?? ""} onChange={(e) => setEditProfileForm((f) => ({ ...f, phone: e.target.value }))} placeholder="(555) 123-4567" className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Street address</label>
                  <input type="text" value={editProfileForm.street_address ?? ""} onChange={(e) => setEditProfileForm((f) => ({ ...f, street_address: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">City</label>
                    <input type="text" value={editProfileForm.city ?? ""} onChange={(e) => setEditProfileForm((f) => ({ ...f, city: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">State</label>
                    <input type="text" value={editProfileForm.state ?? ""} onChange={(e) => setEditProfileForm((f) => ({ ...f, state: e.target.value }))} placeholder="TX" className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">ZIP</label>
                    <input type="text" value={editProfileForm.zip_code ?? ""} onChange={(e) => setEditProfileForm((f) => ({ ...f, zip_code: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">License (for chart signing)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Type</label>
                      <input type="text" value={editProfileForm.license_type ?? ""} onChange={(e) => setEditProfileForm((f) => ({ ...f, license_type: e.target.value }))} placeholder="RN, LPN, MD" className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Number</label>
                      <input type="text" value={editProfileForm.license_number ?? ""} onChange={(e) => setEditProfileForm((f) => ({ ...f, license_number: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">State</label>
                      <input type="text" value={editProfileForm.license_state ?? ""} onChange={(e) => setEditProfileForm((f) => ({ ...f, license_state: e.target.value }))} placeholder="TX" className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Expiry</label>
                      <input type="date" value={editProfileForm.license_expiry ?? ""} onChange={(e) => setEditProfileForm((f) => ({ ...f, license_expiry: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => setEditingProfileId(null)} className="rounded border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                <button type="button" onClick={handleSaveProfile} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

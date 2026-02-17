/**
 * Central storage keys and helpers for localStorage.
 * Use with /lib/audit and app-specific persistence.
 */

export const STORAGE_KEYS = {
  patients: "revive_patients",
  encounters: "revive_encounters",
  auditLog: "revive_audit_log",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getItem<T>(key: StorageKey): T | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function setItem(key: StorageKey, value: unknown): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("Storage setItem failed:", e);
  }
}

export function removeItem(key: StorageKey): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // no-op
  }
}

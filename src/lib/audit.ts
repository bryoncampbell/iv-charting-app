/**
 * Audit logging utility for view, edit, sign, and print actions.
 * Logs are stored in localStorage via STORAGE_KEYS.auditLog.
 */

import type { AuditEvent, AuditAction, AuditEntityType } from "@/types/audit";
import { STORAGE_KEYS, getItem, setItem } from "./storage";

const MAX_LOG_ENTRIES = 2000;

export type { AuditAction, AuditEvent } from "@/types/audit";

function getLog(): AuditEvent[] {
  const raw = getItem<AuditEvent[]>(STORAGE_KEYS.auditLog);
  return Array.isArray(raw) ? raw : [];
}

function saveLog(entries: AuditEvent[]) {
  if (typeof window === "undefined") return;
  try {
    const trimmed =
      entries.length > MAX_LOG_ENTRIES
        ? entries.slice(-MAX_LOG_ENTRIES)
        : entries;
    setItem(STORAGE_KEYS.auditLog, trimmed);
  } catch (e) {
    console.warn("Audit log save failed:", e);
  }
}

/**
 * Read audit log (newest-first order). Use for admin Audit Log page.
 */
export function getAuditLog(): AuditEvent[] {
  const log = getLog();
  return [...log].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Log an audit event. Safe to call from any component.
 */
export function logAudit(
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: string,
  details?: string
): void {
  const entry: AuditEvent = {
    timestamp: new Date().toISOString(),
    action,
    entityType,
    entityId,
    details,
  };
  const log = getLog();
  log.push(entry);
  saveLog(log);
}

/**
 * Generate a random ID for patients and encounters using crypto.randomUUID().
 * URL-safe, non-guessable, no PHI. Use only these IDs in routes (e.g. /patients/[id], /encounters/[id]).
 */
export function generateRandomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  throw new Error(
    "crypto.randomUUID() is required for patient/encounter IDs. Use a supported environment (modern browser or Node 19+)."
  );
}

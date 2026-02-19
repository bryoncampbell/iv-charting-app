/**
 * Audit logging utility for view, edit, sign, and print actions.
 * When Supabase is configured, logs are stored in audit_log; otherwise localStorage.
 */

import type { AuditEvent, AuditAction, AuditEntityType } from "@/types/audit";
import { STORAGE_KEYS, getItem, setItem } from "./storage";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

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
 * Returns a Promise so the Audit page can load from Supabase when configured.
 */
export async function getAuditLog(): Promise<AuditEvent[]> {
  if (typeof window !== "undefined" && isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase
      .from("audit_log")
      .select("timestamp, action, entity_type, entity_id, details")
      .order("timestamp", { ascending: false });
    if (error) {
      console.error("Error loading audit log from Supabase:", error);
      return [];
    }
    return (data ?? []).map((row) => ({
      timestamp: row.timestamp,
      action: row.action as AuditEvent["action"],
      entityType: row.entity_type as AuditEntityType,
      entityId: row.entity_id,
      details: row.details ?? undefined,
    }));
  }
  const log = getLog();
  return [...log].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Log an audit event. Safe to call from any component.
 * When Supabase is configured, writes to audit_log; otherwise localStorage.
 */
export function logAudit(
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: string,
  details?: string
): void {
  const timestamp = new Date().toISOString();
  const entry: AuditEvent = { timestamp, action, entityType, entityId, details };
  if (typeof window !== "undefined" && isSupabaseConfigured() && supabase) {
    supabase
      .from("audit_log")
      .insert({
        timestamp,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details: details ?? null,
      })
      .then(({ error }) => {
        if (error) {
          // Ignore audit log write failures in production; they shouldn't block user flows.
        }
      });
    return;
  }
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

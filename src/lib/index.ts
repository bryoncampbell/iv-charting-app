/**
 * /lib – storage, audit, and ID utilities
 *
 * - ids: newId, nowIso
 * - audit: logAudit, getAuditLog, generateRandomId, AuditAction, AuditEvent
 * - storage: STORAGE_KEYS, getItem, setItem, removeItem
 * - demo-data: getDemoPatients, resetDemoData (dev only)
 */

export { newId, nowIso } from "./ids";

export {
  logAudit,
  getAuditLog,
  generateRandomId,
  type AuditAction,
  type AuditEvent,
} from "./audit";

export { STORAGE_KEYS, getItem, setItem, removeItem, type StorageKey } from "./storage";

export { getDemoPatients, resetDemoData } from "./demo-data";

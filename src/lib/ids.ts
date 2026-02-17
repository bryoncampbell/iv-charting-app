/**
 * ID and timestamp helpers. Use for patient/encounter IDs and created/updated timestamps.
 */

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

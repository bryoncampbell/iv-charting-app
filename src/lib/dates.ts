/**
 * Parse a date-only string (YYYY-MM-DD) as local date.
 * Avoids UTC-offset shifting the calendar day when using new Date("YYYY-MM-DD").
 */
export function parseLocalDate(dateString: string): Date {
  const parts = dateString.split("-").map(Number);
  if (parts.length !== 3) return new Date(dateString);
  const [y, m, d] = parts;
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return new Date(dateString);
  return new Date(y, m - 1, d);
}

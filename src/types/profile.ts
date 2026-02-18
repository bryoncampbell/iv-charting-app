/** App role: nursing (nurse tabs only), provider (provider tab only), admin (full + user management). */
export type AppRole = "nursing" | "provider" | "admin";

export interface Profile {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: AppRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  phone: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  license_type: string | null;
  license_number: string | null;
  license_state: string | null;
  license_expiry: string | null;
}

/** Build display label for chart signing, e.g. "Jane Doe, RN #12345 (TX)" or "Jane Doe". */
export function profileSigningLabel(p: Pick<Profile, "first_name" | "last_name" | "license_type" | "license_number" | "license_state"> | null): string {
  if (!p) return "";
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  const lic = p.license_type?.trim();
  const licNum = p.license_number?.trim();
  const licState = p.license_state?.trim();
  const licensePart = lic ? `, ${lic}${licNum ? ` #${licNum}` : ""}${licState ? ` (${licState})` : ""}` : "";
  return name ? `${name}${licensePart}` : (licensePart ? licensePart.replace(/^, /, "") : "");
}

/** True if license_expiry is set and within 30 days of today or already past. Use to warn user to update license. */
export function isLicenseExpiringSoon(licenseExpiry: string | null | undefined): boolean {
  if (!licenseExpiry?.trim()) return false;
  const expiry = new Date(licenseExpiry.trim());
  if (Number.isNaN(expiry.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntil = Math.round((expiry.getTime() - today.getTime()) / msPerDay);
  return daysUntil <= 30;
}

/** True when the user should see the license warning (banner/toast). Applies to all roles (nursing, provider, admin). */
export function shouldShowLicenseWarning(profile: Pick<Profile, "license_type" | "license_expiry"> | null): boolean {
  if (!profile) return false;
  const expiry = profile.license_expiry ?? (profile as { licenseExpiry?: string }).licenseExpiry;
  const licenseType = (profile.license_type ?? (profile as { licenseType?: string }).licenseType)?.trim();
  if (licenseType && !expiry?.trim()) return true;
  return isLicenseExpiringSoon(expiry);
}

/** True if license_expiry date is before today. */
export function isLicenseExpired(licenseExpiry: string | null | undefined): boolean {
  if (!licenseExpiry?.trim()) return false;
  const expiry = new Date(licenseExpiry.trim());
  if (Number.isNaN(expiry.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return expiry.getTime() < today.getTime();
}

/** Status for styling: expired (red), within 30 days (yellow), or ok. */
export type LicenseExpiryStatus = "expired" | "expiring_soon" | "ok";

export function getLicenseExpiryStatus(licenseExpiry: string | null | undefined): LicenseExpiryStatus {
  if (!licenseExpiry?.trim()) return "ok";
  const expiry = new Date(licenseExpiry.trim());
  if (Number.isNaN(expiry.getTime())) return "ok";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntil = Math.round((expiry.getTime() - today.getTime()) / msPerDay);
  if (daysUntil < 0) return "expired";
  if (daysUntil <= 30) return "expiring_soon";
  return "ok";
}

/** Tailwind classes for license expiry input: red when expired, yellow when expiring within 30 days. */
export function getLicenseExpiryInputClass(licenseExpiry: string | null | undefined): string {
  const status = getLicenseExpiryStatus(licenseExpiry);
  if (status === "expired") return "border-red-500 bg-red-50 dark:bg-red-900/20 dark:border-red-600";
  if (status === "expiring_soon") return "border-amber-500 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-600";
  return "";
}

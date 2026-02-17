/**
 * Central export for app types.
 * Minimal but practical for IV hydration charting.
 */

// ---------------------------------------------------------------------------
// Allergy & Patient
// ---------------------------------------------------------------------------

/** Reaction type options for allergies. "Other" uses reactionOther for free text. */
export type AllergyReactionType =
  | "Rash"
  | "Hives"
  | "Anaphylaxis"
  | "Pruritus"
  | "Other";

export interface Allergy {
  id: string;
  allergen: string;
  /** Reaction type from fixed list; use reactionOther when type is "Other". */
  reactionType?: AllergyReactionType;
  /** Free-text reaction description when reactionType is "Other". */
  reactionOther?: string;
  reaction?: string;
  severity?: string;
  notes?: string;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  phone?: string;
  /** Cell phone (optional; phone may be primary) */
  cellPhone?: string;
  email?: string;
  /** Street address */
  streetAddress?: string;
  /** City */
  city?: string;
  /** State (e.g. two-letter code) */
  state?: string;
  /** Zip code */
  zipCode?: string;
  /** Agreement to be on mailing list */
  mailingListAgreement?: boolean;
  /** License/ID photo stored as data URL (from camera or file upload) */
  licensePhoto?: string;
  allergies?: Allergy[];
  /** Current medications list (persistent on profile for future visits). */
  currentMedications?: string[];
  /** Past medical history list (persistent on profile for future visits). */
  pastMedicalHistory?: string[];
}

/** Display name for UI (no PHI in URLs). */
export function getPatientDisplayName(p: Patient): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || "Unknown";
}

// ---------------------------------------------------------------------------
// Encounter status
// ---------------------------------------------------------------------------

export type EncounterStatus =
  | "draft"
  | "in_progress"
  | "ready_for_provider"
  | "completed"
  | "declined"
  | "cancelled";

// ---------------------------------------------------------------------------
// Nested encounter types
// ---------------------------------------------------------------------------

export interface Intake {
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  medications?: string;
  pastMedicalHistory?: string;
}

export interface Vital {
  id: string;
  timestamp: string;
  bloodPressure?: string;
  heartRate?: string;
  temperature?: string;
  oxygenSaturation?: string;
  respiratoryRate?: string;
  notes?: string;
}

export interface IvAccess {
  site?: string;
  gauge?: string;
  dateTime?: string;
  notes?: string;
}

export interface Administration {
  /** Requested order (nurse) – sent to provider for approval */
  fluidType?: string;
  volume?: string;
  rate?: string;
  additivesVitamins?: string;
  additivesMedications?: string;
  /** Administration record – filled after order approved */
  startTime?: string;
  endTime?: string;
  complications?: string;
  /** How patient tolerated: one of three required options */
  toleranceOption?: "tolerated_well" | "tolerated_complications" | "unable_to_tolerate";
  /** Free text; required. If not tolerated_well, must include reasoning. */
  tolerance?: string;
  notes?: string;
  /** Order approval (provider) */
  orderApprovedAt?: string;
  orderApprovedBy?: string;
  /** Nurse marks infusion complete and patient ready for discharge (pending provider review) */
  readyForDischargeAt?: string;
  readyForDischargeBy?: string;
}

export interface ProviderNote {
  content?: string;
}

export interface Discharge {
  instructions?: string;
  followUp?: string;
}

export interface Addendum {
  id: string;
  createdAt: string;
  authorName: string;
  text: string;
}

// ---------------------------------------------------------------------------
// Encounter
// ---------------------------------------------------------------------------

export interface Encounter {
  id: string;
  patientId: string;
  createdAt: string;
  updatedAt: string;
  status: EncounterStatus;
  location?: string;
  protocolName?: string;
  nursingSignedAt?: string;
  nursingSignedBy?: string;
  providerSignedAt?: string;
  providerSignedBy?: string;
  /** Provider declined to treat based on information provided */
  declinedToTreatAt?: string;
  declinedToTreatBy?: string;
  declinedToTreatReason?: string;
  /** Nurse acknowledged declination and closed the visit (conveyed to patient) */
  declineAcknowledgedAt?: string;
  declineAcknowledgedBy?: string;
  /** Visit cancelled (reason required); goes to history */
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  /** For future use */
  createdByUserId?: string;
  /** For future use */
  assignedProviderUserId?: string;
  intake?: Intake;
  vitals?: Vital[];
  ivAccess?: IvAccess;
  administration?: Administration;
  providerNote?: ProviderNote;
  discharge?: Discharge;
  addenda?: Addendum[];
  /** Denormalized for display (e.g. visit list); derive from patient if missing */
  patientName?: string;
  /** Display date (YYYY-MM-DD); derive from createdAt if missing */
  date?: string;
  /** Display time; derive from createdAt if missing */
  time?: string;
  /** Optional revenue/amount for reports */
  revenue?: number;
  /** Legacy / display */
  treatment?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Audit (keep existing audit types)
// ---------------------------------------------------------------------------

export type { AuditEvent, AuditAction, AuditEntityType } from "./audit";

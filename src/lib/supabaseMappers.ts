/**
 * Map Supabase rows (snake_case) to app types (camelCase) and back.
 * Used when reading/writing patients, encounters, audit_log.
 */

import type { Encounter, Patient } from "@/types";

/** Supabase encounters row shape (snake_case) */
export type EncounterRow = {
  id: string;
  patient_id: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  status: string;
  patient_name?: string | null;
  date?: string | null;
  time?: string | null;
  revenue?: number | null;
  treatment?: string | null;
  notes?: string | null;
  intake?: unknown;
  vitals?: unknown;
  iv_access?: unknown;
  administration?: unknown;
  provider_note?: unknown;
  discharge?: unknown;
  addenda?: unknown;
  location?: string | null;
  protocol_name?: string | null;
  nursing_signed_at?: string | null;
  nursing_signed_by?: string | null;
  provider_signed_at?: string | null;
  provider_signed_by?: string | null;
  declined_to_treat_at?: string | null;
  declined_to_treat_by?: string | null;
  declined_to_treat_reason?: string | null;
  decline_acknowledged_at?: string | null;
  decline_acknowledged_by?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;
};

export function encounterRowToEncounter(row: EncounterRow): Encounter {
  return {
    id: row.id,
    patientId: row.patient_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status as Encounter["status"],
    patientName: row.patient_name ?? undefined,
    date: row.date ?? undefined,
    time: row.time ?? undefined,
    revenue: row.revenue ?? undefined,
    treatment: row.treatment ?? undefined,
    notes: row.notes ?? undefined,
    intake: row.intake as Encounter["intake"],
    vitals: row.vitals as Encounter["vitals"],
    ivAccess: row.iv_access as Encounter["ivAccess"],
    administration: row.administration as Encounter["administration"],
    providerNote: row.provider_note as Encounter["providerNote"],
    discharge: row.discharge as Encounter["discharge"],
    addenda: row.addenda as Encounter["addenda"],
    location: row.location ?? undefined,
    protocolName: row.protocol_name ?? undefined,
    nursingSignedAt: row.nursing_signed_at ?? undefined,
    nursingSignedBy: row.nursing_signed_by ?? undefined,
    providerSignedAt: row.provider_signed_at ?? undefined,
    providerSignedBy: row.provider_signed_by ?? undefined,
    declinedToTreatAt: row.declined_to_treat_at ?? undefined,
    declinedToTreatBy: row.declined_to_treat_by ?? undefined,
    declinedToTreatReason: row.declined_to_treat_reason ?? undefined,
    declineAcknowledgedAt: row.decline_acknowledged_at ?? undefined,
    declineAcknowledgedBy: row.decline_acknowledged_by ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    cancelledBy: row.cancelled_by ?? undefined,
    cancellationReason: row.cancellation_reason ?? undefined,
  };
}

/** Encounter → Supabase row (for insert/update). Pass createdBy when inserting to scope by user. */
export function encounterToRow(e: Encounter, createdBy?: string | null): EncounterRow {
  return {
    id: e.id,
    patient_id: e.patientId,
    ...(createdBy !== undefined && { created_by: createdBy }),
    created_at: e.createdAt,
    updated_at: e.updatedAt,
    status: e.status,
    patient_name: e.patientName ?? null,
    date: e.date ?? null,
    time: e.time ?? null,
    revenue: e.revenue ?? null,
    treatment: e.treatment ?? null,
    notes: e.notes ?? null,
    intake: e.intake ?? null,
    vitals: e.vitals ?? null,
    iv_access: e.ivAccess ?? null,
    administration: e.administration ?? null,
    provider_note: e.providerNote ?? null,
    discharge: e.discharge ?? null,
    addenda: e.addenda ?? null,
    location: e.location ?? null,
    protocol_name: e.protocolName ?? null,
    nursing_signed_at: e.nursingSignedAt ?? null,
    nursing_signed_by: e.nursingSignedBy ?? null,
    provider_signed_at: e.providerSignedAt ?? null,
    provider_signed_by: e.providerSignedBy ?? null,
    declined_to_treat_at: e.declinedToTreatAt ?? null,
    declined_to_treat_by: e.declinedToTreatBy ?? null,
    declined_to_treat_reason: e.declinedToTreatReason ?? null,
    decline_acknowledged_at: e.declineAcknowledgedAt ?? null,
    decline_acknowledged_by: e.declineAcknowledgedBy ?? null,
    cancelled_at: e.cancelledAt ?? null,
    cancelled_by: e.cancelledBy ?? null,
    cancellation_reason: e.cancellationReason ?? null,
  };
}

/** Supabase patients row shape */
export type PatientRow = {
  id: string;
  created_by?: string | null;
  first_name: string;
  last_name: string;
  dob: string;
  phone?: string | null;
  cell_phone?: string | null;
  email?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  mailing_list_agreement?: boolean | null;
  license_photo?: string | null;
  allergies?: unknown;
  current_medications?: unknown;
  past_medical_history?: unknown;
};

export function patientRowToPatient(row: PatientRow): Patient {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    dob: row.dob,
    phone: row.phone ?? undefined,
    cellPhone: row.cell_phone ?? undefined,
    email: row.email ?? undefined,
    streetAddress: row.street_address ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    zipCode: row.zip_code ?? undefined,
    mailingListAgreement: row.mailing_list_agreement ?? undefined,
    licensePhoto: row.license_photo ?? undefined,
    allergies: (row.allergies as Patient["allergies"]) ?? undefined,
    currentMedications: (row.current_medications as string[]) ?? undefined,
    pastMedicalHistory: (row.past_medical_history as string[]) ?? undefined,
  };
}

/** Patient → Supabase row (for insert/update). Pass createdBy when inserting to scope by user. */
export function patientToRow(p: Patient, createdBy?: string | null): PatientRow {
  return {
    id: p.id,
    ...(createdBy !== undefined && { created_by: createdBy }),
    first_name: p.firstName,
    last_name: p.lastName,
    dob: p.dob,
    phone: p.phone ?? null,
    cell_phone: p.cellPhone ?? null,
    email: p.email ?? null,
    street_address: p.streetAddress ?? null,
    city: p.city ?? null,
    state: p.state ?? null,
    zip_code: p.zipCode ?? null,
    mailing_list_agreement: p.mailingListAgreement ?? null,
    license_photo: p.licensePhoto ?? null,
    allergies: p.allergies ?? null,
    current_medications: p.currentMedications ?? null,
    past_medical_history: p.pastMedicalHistory ?? null,
  };
}

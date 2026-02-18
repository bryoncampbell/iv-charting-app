/**
 * Demo data and reset utility for development.
 * Reset clears all data; seedDemoDataForCustomer() loads 40 patients + encounters with varied vitals for demos.
 * When Supabase is configured, reset/seed operate on the DB; otherwise localStorage only.
 */

import type {
  Patient,
  Encounter,
  Allergy,
  Vital,
  Intake,
  IvAccess,
  Administration,
  ProviderNote,
  Discharge,
} from "@/types";
import { newId } from "./ids";
import { logAudit } from "./audit";
import { STORAGE_KEYS, setItem } from "./storage";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { patientToRow, encounterToRow } from "./supabaseMappers";

function allergy(id: string, allergen: string, reaction?: string): Allergy {
  return { id, allergen, reaction };
}

function demoPatient(overrides: Partial<Patient> & { firstName: string; lastName: string; dob: string; phone: string }): Patient {
  return {
    id: newId(),
    firstName: overrides.firstName,
    lastName: overrides.lastName,
    dob: overrides.dob,
    phone: overrides.phone,
    allergies: overrides.allergies ?? [],
  };
}

export function getDemoPatients(): Patient[] {
  return [
    demoPatient({ firstName: "John", lastName: "Smith", dob: "1980-05-15", phone: "(555) 123-4567" }),
    demoPatient({
      firstName: "Sarah",
      lastName: "Johnson",
      dob: "1992-08-22",
      phone: "(555) 234-5678",
      allergies: [allergy(newId(), "Penicillin")],
    }),
    demoPatient({ firstName: "Michael", lastName: "Brown", dob: "1967-11-03", phone: "(555) 345-6789" }),
    demoPatient({
      firstName: "Emily",
      lastName: "Davis",
      dob: "1995-02-18",
      phone: "(555) 456-7890",
      allergies: [allergy(newId(), "Latex")],
    }),
    demoPatient({ firstName: "Robert", lastName: "Wilson", dob: "1958-09-27", phone: "(555) 567-8901" }),
  ];
}

// Seed data for customer demo: 40 patients with varied demographics
const SEED_PATIENT_ROWS: Array<{
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  cellPhone?: string;
  email?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  allergies?: string[];
}> = [
  { firstName: "James", lastName: "Wilson", dob: "1975-03-12", phone: "(555) 101-1001", city: "Austin", state: "TX", zipCode: "78701" },
  { firstName: "Maria", lastName: "Garcia", dob: "1988-07-22", phone: "(555) 101-1002", email: "maria.g@email.com", allergies: ["Penicillin"] },
  { firstName: "David", lastName: "Chen", dob: "1962-11-05", phone: "(555) 101-1003", cellPhone: "(555) 201-1003", city: "Seattle", state: "WA", zipCode: "98101" },
  { firstName: "Jennifer", lastName: "Martinez", dob: "1995-01-30", phone: "(555) 101-1004", allergies: ["Latex", "Shellfish"] },
  { firstName: "Robert", lastName: "Taylor", dob: "1955-09-18", phone: "(555) 101-1005", streetAddress: "100 Oak St", city: "Denver", state: "CO", zipCode: "80202" },
  { firstName: "Lisa", lastName: "Anderson", dob: "1982-04-25", phone: "(555) 101-1006", email: "lisa.a@email.com", allergies: ["Sulfa"] },
  { firstName: "Michael", lastName: "Thomas", dob: "1970-12-08", phone: "(555) 101-1007", city: "Phoenix", state: "AZ", zipCode: "85001" },
  { firstName: "Sarah", lastName: "Jackson", dob: "1990-06-14", phone: "(555) 101-1008", cellPhone: "(555) 201-1008" },
  { firstName: "Christopher", lastName: "White", dob: "1968-02-28", phone: "(555) 101-1009", streetAddress: "42 Elm Ave", city: "Portland", state: "OR", zipCode: "97201" },
  { firstName: "Amanda", lastName: "Harris", dob: "1985-08-03", phone: "(555) 101-1010", email: "amanda.h@email.com", allergies: ["Aspirin"] },
  { firstName: "Daniel", lastName: "Martin", dob: "1978-05-19", phone: "(555) 101-1011", city: "Nashville", state: "TN", zipCode: "37201" },
  { firstName: "Jessica", lastName: "Thompson", dob: "1993-10-11", phone: "(555) 101-1012", allergies: ["Iodine"] },
  { firstName: "Matthew", lastName: "Moore", dob: "1965-07-07", phone: "(555) 101-1013", cellPhone: "(555) 201-1013", city: "Charlotte", state: "NC", zipCode: "28201" },
  { firstName: "Ashley", lastName: "Clark", dob: "1987-12-22", phone: "(555) 101-1014", email: "ashley.c@email.com" },
  { firstName: "Andrew", lastName: "Lewis", dob: "1959-04-16", phone: "(555) 101-1015", streetAddress: "200 Pine Rd", city: "Atlanta", state: "GA", zipCode: "30301" },
  { firstName: "Emily", lastName: "Lee", dob: "1991-09-09", phone: "(555) 101-1016", allergies: ["Peanuts"] },
  { firstName: "Joseph", lastName: "Walker", dob: "1972-01-24", phone: "(555) 101-1017", city: "Miami", state: "FL", zipCode: "33101" },
  { firstName: "Stephanie", lastName: "Hall", dob: "1984-06-30", phone: "(555) 101-1018", email: "stephanie.h@email.com", allergies: ["Penicillin", "Codeine"] },
  { firstName: "Joshua", lastName: "Allen", dob: "1960-11-12", phone: "(555) 101-1019", cellPhone: "(555) 201-1019", city: "Boston", state: "MA", zipCode: "02101" },
  { firstName: "Nicole", lastName: "Young", dob: "1996-03-05", phone: "(555) 101-1020", streetAddress: "88 Maple Dr", city: "Chicago", state: "IL", zipCode: "60601" },
  { firstName: "Ryan", lastName: "King", dob: "1981-08-18", phone: "(555) 101-1021", email: "ryan.k@email.com" },
  { firstName: "Elizabeth", lastName: "Wright", dob: "1974-02-14", phone: "(555) 101-1022", city: "Dallas", state: "TX", zipCode: "75201", allergies: ["Latex"] },
  { firstName: "Brandon", lastName: "Scott", dob: "1989-07-27", phone: "(555) 101-1023", cellPhone: "(555) 201-1023" },
  { firstName: "Lauren", lastName: "Green", dob: "1963-12-01", phone: "(555) 101-1024", streetAddress: "15 Cedar Ln", city: "San Diego", state: "CA", zipCode: "92101" },
  { firstName: "Kevin", lastName: "Baker", dob: "1992-05-08", phone: "(555) 101-1025", email: "kevin.b@email.com", allergies: ["Sulfa"] },
  { firstName: "Megan", lastName: "Adams", dob: "1977-10-20", phone: "(555) 101-1026", city: "Minneapolis", state: "MN", zipCode: "55401" },
  { firstName: "Brian", lastName: "Nelson", dob: "1956-04-03", phone: "(555) 101-1027", allergies: ["Morphine"] },
  { firstName: "Rachel", lastName: "Carter", dob: "1986-09-15", phone: "(555) 101-1028", cellPhone: "(555) 201-1028", city: "Detroit", state: "MI", zipCode: "48201" },
  { firstName: "Timothy", lastName: "Mitchell", dob: "1994-01-28", phone: "(555) 101-1029", email: "timothy.m@email.com", streetAddress: "77 Birch St", city: "Philadelphia", state: "PA", zipCode: "19101" },
  { firstName: "Heather", lastName: "Perez", dob: "1969-06-11", phone: "(555) 101-1030", allergies: ["Eggs"] },
  { firstName: "Jason", lastName: "Roberts", dob: "1983-11-24", phone: "(555) 101-1031", city: "Houston", state: "TX", zipCode: "77001" },
  { firstName: "Samantha", lastName: "Turner", dob: "1979-08-06", phone: "(555) 101-1032", email: "samantha.t@email.com", allergies: ["Penicillin"] },
  { firstName: "Justin", lastName: "Phillips", dob: "1997-02-17", phone: "(555) 101-1033", cellPhone: "(555) 201-1033", city: "San Francisco", state: "CA", zipCode: "94102" },
  { firstName: "Christina", lastName: "Campbell", dob: "1967-05-29", phone: "(555) 101-1034", streetAddress: "33 Walnut Ave", city: "Columbus", state: "OH", zipCode: "43201" },
  { firstName: "Eric", lastName: "Parker", dob: "1980-12-09", phone: "(555) 101-1035", email: "eric.p@email.com" },
  { firstName: "Kelly", lastName: "Evans", dob: "1991-03-21", phone: "(555) 101-1036", city: "Las Vegas", state: "NV", zipCode: "89101", allergies: ["Aspirin", "NSAIDs"] },
  { firstName: "Steven", lastName: "Edwards", dob: "1958-07-14", phone: "(555) 101-1037", cellPhone: "(555) 201-1037" },
  { firstName: "Angela", lastName: "Collins", dob: "1988-10-02", phone: "(555) 101-1038", email: "angela.c@email.com", allergies: ["Latex"] },
  { firstName: "Edward", lastName: "Stewart", dob: "1971-04-26", phone: "(555) 101-1039", city: "Baltimore", state: "MD", zipCode: "21201" },
  { firstName: "Michelle", lastName: "Sanchez", dob: "1995-09-18", phone: "(555) 101-1040", streetAddress: "99 Spruce Way", city: "New York", state: "NY", zipCode: "10001" },
];

// Vitals templates for variety (BP, HR, temp °F, O2%, RR)
const VITAL_SETS: Array<{ bloodPressure: string; heartRate: string; temperature: string; oxygenSaturation: string; respiratoryRate: string }> = [
  { bloodPressure: "118/72", heartRate: "68", temperature: "98.2", oxygenSaturation: "99", respiratoryRate: "14" },
  { bloodPressure: "124/78", heartRate: "72", temperature: "98.6", oxygenSaturation: "98", respiratoryRate: "16" },
  { bloodPressure: "112/70", heartRate: "64", temperature: "97.9", oxygenSaturation: "100", respiratoryRate: "12" },
  { bloodPressure: "130/82", heartRate: "76", temperature: "99.0", oxygenSaturation: "97", respiratoryRate: "18" },
  { bloodPressure: "120/75", heartRate: "70", temperature: "98.4", oxygenSaturation: "99", respiratoryRate: "14" },
  { bloodPressure: "128/80", heartRate: "74", temperature: "98.8", oxygenSaturation: "96", respiratoryRate: "16" },
  { bloodPressure: "115/68", heartRate: "62", temperature: "97.6", oxygenSaturation: "100", respiratoryRate: "12" },
  { bloodPressure: "122/76", heartRate: "78", temperature: "99.1", oxygenSaturation: "98", respiratoryRate: "15" },
  { bloodPressure: "118/74", heartRate: "66", temperature: "98.0", oxygenSaturation: "99", respiratoryRate: "13" },
  { bloodPressure: "126/79", heartRate: "80", temperature: "98.5", oxygenSaturation: "97", respiratoryRate: "17" },
  { bloodPressure: "110/65", heartRate: "60", temperature: "97.4", oxygenSaturation: "100", respiratoryRate: "12" },
  { bloodPressure: "132/84", heartRate: "82", temperature: "99.2", oxygenSaturation: "96", respiratoryRate: "18" },
  { bloodPressure: "116/71", heartRate: "69", temperature: "98.1", oxygenSaturation: "99", respiratoryRate: "14" },
  { bloodPressure: "121/77", heartRate: "73", temperature: "98.7", oxygenSaturation: "98", respiratoryRate: "15" },
  { bloodPressure: "127/81", heartRate: "75", temperature: "98.9", oxygenSaturation: "97", respiratoryRate: "16" },
];

/** Returns 40 patients for customer demo seed (varied demographics, some allergies). */
export function getSeedPatientsForDemo(): Patient[] {
  return SEED_PATIENT_ROWS.map((row) => {
    const id = newId();
    const allergies: Allergy[] = (row.allergies ?? []).map((a) => allergy(newId(), a));
    return {
      id,
      firstName: row.firstName,
      lastName: row.lastName,
      dob: row.dob,
      phone: row.phone,
      cellPhone: row.cellPhone,
      email: row.email,
      streetAddress: row.streetAddress,
      city: row.city,
      state: row.state,
      zipCode: row.zipCode,
      allergies: allergies.length ? allergies : undefined,
    };
  });
}

// Administration presets: fluid type, additivesVitamins (comma-separated), additivesMedications (Zofran, Toradol), and computed revenue (base 180 + 30/med + 20 if extra fluid)
const ADMIN_PRESETS: Array<{
  fluidType: string;
  additivesVitamins: string;
  additivesMedications: string;
  revenue: number;
}> = [
  { fluidType: "Normal Saline (NS)", additivesVitamins: "Vitamin C, B Complex", additivesMedications: "", revenue: 180 },
  { fluidType: "Lactated Ringer's (LR)", additivesVitamins: "B Complex, Magnesium Sulfate", additivesMedications: "Zofran", revenue: 210 },
  { fluidType: "D5W", additivesVitamins: "Vitamin C, Glutathione", additivesMedications: "Toradol", revenue: 210 },
  { fluidType: "Normal Saline (NS)", additivesVitamins: "Vitamin C, B12, Extra 500 mL of Hydration", additivesMedications: "Zofran, Toradol", revenue: 260 },
  { fluidType: "Lactated Ringer's (LR)", additivesVitamins: "B Complex, Extra 500 mL of Hydration", additivesMedications: "Zofran", revenue: 230 },
  { fluidType: "D5½NS", additivesVitamins: "Vitamin C, NAC", additivesMedications: "", revenue: 180 },
  { fluidType: "Normal Saline (NS)", additivesVitamins: "B12, Magnesium Sulfate, Extra 500 mL of Hydration", additivesMedications: "Toradol", revenue: 230 },
  { fluidType: "Plasma-Lyte", additivesVitamins: "Vitamin C, B Complex, Glutathione", additivesMedications: "Zofran, Toradol", revenue: 240 },
  { fluidType: "Lactated Ringer's (LR)", additivesVitamins: "Vitamin C, B12", additivesMedications: "Zofran", revenue: 210 },
  { fluidType: "D5W", additivesVitamins: "B Complex, Extra 500 mL of Hydration", additivesMedications: "", revenue: 200 },
  { fluidType: "Normal Saline (NS)", additivesVitamins: "Vitamin C, B Complex, Magnesium Sulfate", additivesMedications: "Toradol", revenue: 210 },
  { fluidType: "D5LR", additivesVitamins: "B12, NAC, Extra 500 mL of Hydration", additivesMedications: "Zofran, Toradol", revenue: 260 },
  { fluidType: "½ Normal Saline", additivesVitamins: "Vitamin C", additivesMedications: "", revenue: 180 },
  { fluidType: "Lactated Ringer's (LR)", additivesVitamins: "B Complex, Vitamin D, Extra 500 mL of Hydration", additivesMedications: "Zofran", revenue: 230 },
  { fluidType: "Normal Saline (NS)", additivesVitamins: "Vitamin C, B12, Lysine", additivesMedications: "Toradol", revenue: 210 },
  { fluidType: "D5W", additivesVitamins: "Glutathione, ALA, Extra 500 mL of Hydration", additivesMedications: "Zofran, Toradol", revenue: 260 },
  { fluidType: "Lactated Ringer's (LR)", additivesVitamins: "Vitamin C, B Complex", additivesMedications: "", revenue: 180 },
  { fluidType: "Normal Saline (NS)", additivesVitamins: "B12, Extra 500 mL of Hydration", additivesMedications: "Zofran", revenue: 230 },
  { fluidType: "Plasma-Lyte", additivesVitamins: "Vitamin C, Magnesium Sulfate", additivesMedications: "Toradol", revenue: 210 },
  { fluidType: "D5½NS", additivesVitamins: "B Complex, NAC, Extra 500 mL of Hydration", additivesMedications: "Zofran, Toradol", revenue: 260 },
];

/** Returns encounters with varied vitals and administration (Zofran, Toradol, extra IV fluids) for customer demo. */
function getSeedEncountersForDemo(patients: Patient[]): Encounter[] {
  const now = new Date();
  const encounters: Encounter[] = [];
  const status: Encounter["status"] = "completed";
  const iso = () => new Date(now.getTime() - Math.random() * 14 * 24 * 60 * 60 * 1000).toISOString();

  for (let i = 0; i < Math.min(28, patients.length); i++) {
    const patient = patients[i];
    const created = iso();
    const dateStr = created.slice(0, 10);
    const vitalsSet = VITAL_SETS[i % VITAL_SETS.length];
    const preset = ADMIN_PRESETS[i % ADMIN_PRESETS.length];
    const vitals: Vital[] = [
      {
        id: newId(),
        timestamp: created,
        bloodPressure: vitalsSet.bloodPressure,
        heartRate: vitalsSet.heartRate,
        temperature: vitalsSet.temperature,
        oxygenSaturation: vitalsSet.oxygenSaturation,
        respiratoryRate: vitalsSet.respiratoryRate,
      },
    ];
    const encounter: Encounter = {
      id: newId(),
      patientId: patient.id,
      patientName: [patient.firstName, patient.lastName].join(" "),
      createdAt: created,
      updatedAt: created,
      status,
      date: dateStr,
      time: created.slice(11, 16),
      intake: {
        chiefComplaint: i % 3 === 0 ? "Dehydration" : i % 3 === 1 ? "Fatigue" : "Recovery post-activity",
        historyOfPresentIllness: "Patient reports need for IV hydration.",
      },
      vitals,
      ivAccess: { site: "Left AC", gauge: "20", dateTime: created, notes: "Clean insertion." },
      administration: {
        fluidType: preset.fluidType,
        volume: "1000",
        rate: "250",
        additivesVitamins: preset.additivesVitamins,
        additivesMedications: preset.additivesMedications,
        startTime: created,
        endTime: new Date(new Date(created).getTime() + 45 * 60 * 1000).toISOString(),
        toleranceOption: "tolerated_well",
        orderApprovedAt: created,
        orderApprovedBy: "Dr. Smith",
      },
      providerNote: { content: "IV hydration completed without complications. Patient tolerated well." },
      discharge: { instructions: "Increase oral fluids. Return if symptoms worsen." },
      revenue: preset.revenue,
    };
    encounters.push(encounter);
  }

  return encounters.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Seed 40 patients and encounters with varied vitals for customer demo.
 * Call from "Load sample data" on the dashboard.
 * When Supabase is configured, inserts into DB; pass createdBy to scope by user (e.g. auth.session.user.id).
 */
export async function seedDemoDataForCustomer(createdBy?: string | null): Promise<void> {
  if (typeof window === "undefined") return;
  const patients = getSeedPatientsForDemo();
  const encounters = getSeedEncountersForDemo(patients);

  if (isSupabaseConfigured() && supabase) {
    try {
      await resetDemoData();
      const { error: patientsError } = await supabase.from("patients").insert(patients.map((p) => patientToRow(p, createdBy)));
      if (patientsError) {
        console.warn("Seed demo data (patients) failed:", patientsError);
        return;
      }
      const { error: encountersError } = await supabase.from("encounters").insert(encounters.map((e) => encounterToRow(e, createdBy)));
      if (encountersError) {
        console.warn("Seed demo data (encounters) failed:", encountersError);
        return;
      }
      logAudit("demo_data.seed_customer", "system", "app", "Seeded 40 patients and encounters for customer demo");
    } catch (e) {
      console.warn("Seed demo data failed:", e);
    }
    return;
  }

  try {
    setItem(STORAGE_KEYS.patients, patients);
    setItem(STORAGE_KEYS.encounters, encounters);
    setItem(STORAGE_KEYS.auditLog, []);
    logAudit("demo_data.seed_customer", "system", "app", "Seeded 40 patients and encounters for customer demo");
  } catch (e) {
    console.warn("Seed demo data failed:", e);
  }
}

/**
 * Reset all demo data: clear patients, encounters, and audit log.
 * Call from developer-only "Reset Demo Data" button.
 * When Supabase is configured, deletes from DB (encounters first, then patients, then audit_log); otherwise localStorage only.
 */
export async function resetDemoData(): Promise<void> {
  if (typeof window === "undefined") return;

  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase.from("audit_log").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("encounters").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("patients").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      logAudit("demo_data.reset", "system", "app", "Demo data reset");
    } catch (e) {
      console.warn("Reset demo data failed:", e);
    }
    return;
  }

  const patients: Patient[] = [];
  const encounters: Encounter[] = [];
  const audit: unknown[] = [];
  try {
    setItem(STORAGE_KEYS.patients, patients);
    setItem(STORAGE_KEYS.encounters, encounters);
    setItem(STORAGE_KEYS.auditLog, audit);
    logAudit("demo_data.reset", "system", "app", "Demo data reset");
  } catch (e) {
    console.warn("Reset demo data failed:", e);
  }
}

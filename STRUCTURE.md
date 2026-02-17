# App folder structure

```
src/
├── app/                    # Next.js App Router
│   ├── dashboard/         # Dashboard – overview, stats, reset demo (dev)
│   │   └── page.tsx
│   ├── patients/          # Patients – list, search, new patient
│   │   ├── page.tsx
│   │   └── [id]/          # Patient profile – demographics, allergies, Start Visit
│   │       └── page.tsx
│   ├── encounters/        # Encounters – full encounter record (tabs, sign-off)
│   │   └── [id]/
│   │       ├── page.tsx   # Intake, Vitals, IV Access, Administration, Provider, Amendments
│   │       └── summary/
│   │           └── page.tsx   # Visit summary + Print/PDF
│   ├── visits/            # Visits – list with date filter (Today / Last 7 / All), click → encounter
│   │   └── page.tsx
│   ├── reports/           # Reports – date range, visit counts, protocol breakdown, revenue
│   │   └── page.tsx
│   ├── layout.tsx
│   ├── page.tsx           # Redirects to /dashboard
│   └── globals.css
│
├── lib/                   # Storage + audit utilities
│   ├── audit.ts           # logAudit(), generateRandomId(), audit types
│   ├── storage.ts         # STORAGE_KEYS, getItem(), setItem(), removeItem()
│   ├── demo-data.ts       # getDemoPatients(), resetDemoData()
│   └── index.ts           # Re-exports for @/lib
│
├── components/            # Reusable UI
│   ├── Navigation.tsx     # Top bar (desktop) + bottom nav (mobile), nav links
│   └── ResetDemoDataButton.tsx   # Dev-only reset (dashboard)
│
└── types/
    └── patient.ts         # Patient, Encounter, VitalReading, AmendmentEntry, etc.
```

## Routes

| Path | Purpose |
|------|--------|
| `/` | Redirect to `/dashboard` |
| `/dashboard` | Dashboard; dev-only “Reset Demo Data” at bottom |
| `/patients` | Patient list (search, New Patient) |
| `/patients/[id]` | Patient profile; Start Visit → creates encounter, goes to `/encounters/[id]` |
| `/encounters/[id]` | Encounter form (tabs, sign-off); “Visit Summary” link |
| `/encounters/[id]/summary` | Visit summary; Print/PDF |
| `/visits` | Visit list (Today / Last 7 Days / All); row click → `/encounters/[id]` |
| `/reports` | Reports (date range, counts, protocol, optional revenue) |

## Lib usage

- **Storage:** `STORAGE_KEYS.patients`, `STORAGE_KEYS.encounters`, `STORAGE_KEYS.auditLog`; `getItem<T>(key)`, `setItem(key, value)`, `removeItem(key)`.
- **Audit:** `logAudit(action, entityType, entityId, details?)`; `generateRandomId()` for URLs.
- **Demo:** `getDemoPatients()`, `resetDemoData()` (clears encounters + audit, restores patients with new random IDs).

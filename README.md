This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## IV Charting App

IV hydration and recovery visit charting: patients, visits, encounter workflow (intake, vitals, IV access, orders, administration), visit summary, and optional SMS link to share summaries.

### How to run

Install dependencies and start the dev server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

### Optional environment variables

- **`NEXT_PUBLIC_APP_URL`** – Base URL of the app (e.g. `https://your-domain.com`). Used when generating share links for visit summaries so links work when opened by the patient.
- **Twilio (SMS)** – To send the visit-summary link via SMS instead of opening the device SMS app with a pre-filled message, set:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_PHONE_NUMBER`  
  If these are not set, “Text link to patient” opens the default SMS app with the link pre-filled.

Create a `.env.local` file in the project root for local development (see [Next.js env docs](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)).

### Data storage (current state)

- **Patients, encounters, audit log** – Currently stored in the browser’s **localStorage** (no shared server DB yet). Use the Dashboard “Reset demo data” to repopulate sample data.  
  This is fine for local development and demos, but **not suitable for PHI / HIPAA**.
- **Shared visit summaries** – Stored in a **file-based store** on the server (directory `.data/share-summaries`, or `os.tmpdir()` if that directory isn’t writable). Share links are valid until the server process restarts or the file is removed; on serverless (e.g. Vercel) you’ll need a shared store (e.g. Vercel KV, Redis) for links to work across instances.

---

## Hosting & backend roadmap (Path A: Vercel + Supabase)

This is the working plan for making the app multi‑user and hosted, starting with the most beginner‑friendly / cost‑effective path.

### Phase 1 – Host the app as‑is on Vercel

- **Goal:** Get a real URL to share (single‑browser data only).
- **Steps:**
  - Push the repo to GitHub.
  - In Vercel: **New Project → Import from GitHub → select this repo**.
  - Set env vars in Vercel:
    - `NEXT_PUBLIC_APP_URL` (e.g. `https://your-app.vercel.app`)
    - Optional Twilio vars for SMS: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
  - Deploy.

Result: The app is publicly reachable, but each browser still has its **own** data because storage is localStorage.

### Phase 2 – Add Supabase (shared DB, simple auth)

- **Goal:** Shared data across users/locations using Supabase (Postgres + auth + optional realtime).
- **Steps (high level):**
  - Create a Supabase project and add to `.env.local`:
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Create tables:
    - `patients` – matches the `Patient` type (names, DOB, phones, address, allergies, etc.).
    - `encounters` – matches the `Encounter` type (intake, vitals, IV access, administration, status, revenue, etc.).
    - `audit_log` – matches existing audit events.
  - Add `@supabase/supabase-js` and `src/lib/supabaseClient.ts`.
  - **First screen to migrate:** `visits/page.tsx`
    - Replace `localStorage.getItem(STORAGE_KEYS.encounters)` with `supabase.from("encounters").select("*")`.
    - Show visits list from Supabase instead of localStorage.
  - Then migrate:
    - `encounters/[id]/page.tsx` (visit in progress) – reads/writes encounters via Supabase.
    - `patients/page.tsx` and `patients/[id]/page.tsx` – list and profile via Supabase.
    - `audit` – write audit events into `audit_log` instead of localStorage.

At the end of Phase 2, **localStorage is no longer the source of truth** for patients/encounters.

### Phase 3 – Realtime visit status (optional, via Supabase Realtime)

- **Goal:** When one user updates a visit (status, order approved, infusion started, etc.), other users’ `Visits` page updates automatically.
- **Steps (high level):**
  - Enable Realtime on the `encounters` table in Supabase.
  - On `visits/page.tsx`, subscribe to changes:
    - On any insert/update/delete, re‑fetch encounters from Supabase (or apply the delta).

### HIPAA note

- Vercel + Supabase free tiers are great for **development and demos**, but are **not HIPAA‑compliant by default** (no BAA).
- For true PHI/HIPAA production, the same app structure can be moved later to a vendor that signs a **BAA** (e.g. Supabase enterprise / AWS + BAA), with proper encryption, logging, and access controls.

---

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

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

Open [1 ](http://localhost:3000) with your browser.

### Optional environment variables

- **`NEXT_PUBLIC_APP_URL`** – Base URL of the app (e.g. `https://your-domain.com`). Used when generating share links for visit summaries so links work when opened by the patient.
- **Twilio (SMS)** – To send the visit-summary link via SMS instead of opening the device SMS app with a pre-filled message, set:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_PHONE_NUMBER`  
  If these are not set, “Text link to patient” opens the default SMS app with the link pre-filled.

Create a `.env.local` file in the project root for local development (see [Next.js env docs](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)).

**Admin-only access (no self sign-up):** Only admins can create users. In **Supabase Dashboard → Authentication → Providers → Email**, turn **off** “Enable email signup” so new users cannot register themselves. Admins create users from the Admin page; the system sends a temporary password (via email if `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set) and the user must set a new password on first sign-in.

### Data storage

- **Patients, encounters, audit log** – When Supabase is configured, data is stored in **Supabase (Postgres)** and shared across users. The app uses Supabase for visits, encounters, patients, and audit; localStorage is only used as a fallback when Supabase is not configured (e.g. local dev without env vars). Use the Dashboard “Reset demo data” to clear and repopulate sample data (requires RLS policies from `supabase/auth-admin-see-all.sql`).
- **Auth & profiles** – Supabase Auth + `profiles` table (roles: nursing, provider, admin). Run `supabase/profiles.sql` and optionally `supabase/auth-scope-created-by.sql` and `supabase/auth-admin-see-all.sql` for RLS.
- **Shared visit summaries** – Share links are stored in **`share_summaries`** (run `supabase/share-summaries.sql` once). “Share link” / “Text link” work across instances.

---

## Hosting & backend roadmap (Path A: Vercel + Supabase)

### Phase 1 – Host the app on Vercel

- **Goal:** Get a real URL to share.
- **Steps:** Push the repo to GitHub → Vercel **New Project** → Import repo → set env vars (`NEXT_PUBLIC_APP_URL`, optional Twilio). Deploy.

### Phase 2 – Supabase (shared DB, auth) — complete

- **Goal:** Shared data and auth across users. **Done:** the app uses Supabase as the source of truth for patients, encounters, audit log, and auth/profiles when configured.
- **Setup (one-time):**
  1. **Env vars** – `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and for admin/backend: `SUPABASE_SERVICE_ROLE_KEY`. Add in Vercel as needed.
  2. **Tables** – Run in Supabase SQL Editor: **`supabase/schema.sql`** (creates `patients`, `encounters`, `audit_log`), then **`supabase/profiles.sql`**, **`supabase/rls-policies.sql`**. Optional: **`supabase/auth-scope-created-by.sql`** (scope by `created_by`) and **`supabase/auth-admin-see-all.sql`** (all roles see/update/delete all visits and patients).
  3. **Share summaries** – Run **`supabase/share-summaries.sql`** for share links.

**Result:** localStorage is no longer the source of truth when Supabase is configured.

### Phase 3 – Realtime visit status — complete

- **Goal:** When one user updates a visit, other users’ Visits page updates automatically.
- **One-time setup:** In Supabase → **SQL Editor**, run **`supabase/realtime-enable.sql`** (adds `encounters` to the Realtime publication). Or in **Database → Replication**, enable Realtime for the `encounters` table.
- **App:** The Visits page already subscribes to `postgres_changes` on `encounters` and refetches the list on any insert/update/delete, so the list stays in sync across tabs and users.

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

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

### Data storage

- **Patients, encounters, audit log** – Stored in the browser’s **localStorage** (no server database by default). Use the Dashboard “Reset demo data” to repopulate sample data.
- **Shared visit summaries** – Stored in a **file-based store** on the server (directory `.data/share-summaries`, or `os.tmpdir()` if that directory isn’t writable). Share links are valid until the server process restarts or the file is removed; on serverless (e.g. Vercel) you’ll need a shared store (e.g. Vercel KV, Redis) for links to work across instances.

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

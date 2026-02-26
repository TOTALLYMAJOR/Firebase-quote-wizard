# React + Firebase Quote Wizard

This scaffold ports the design language from `index-quote-wizard.html` into a clean React app with a Firebase-ready structure.

## Quick Start

1. `cd react-firebase-quote-wizard`
2. `npm install`
3. `npm run dev`

## Firebase Setup

Copy `.env.example` to `.env` in this folder and set:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

If env vars are missing, app falls back to local default catalog data.

## Deploy

### Vercel

1. Push this repo to GitHub.
2. Import the repo in Vercel (`Add New Project`).
3. Framework preset: `Vite` (auto-detected).
4. Add the `VITE_FIREBASE_*` environment variables in Vercel project settings.
5. Deploy.

Build settings (default):

- Build command: `npm run build`
- Output directory: `dist`

### Firebase Hosting

1. Install Firebase CLI: `npm i -g firebase-tools`
2. Login: `firebase login`
3. Initialize hosting in this project:
   - `firebase init hosting`
   - Select your Firebase project.
   - Public directory: `dist`
   - Configure as single-page app: `Yes`
   - Set up automatic builds/deploys with GitHub: optional
4. Build and deploy:
   - `npm run build`
   - `firebase deploy --only hosting`

## Firestore Collections

- `catalogPackages` (doc id is package id): `{ name, ppp }`
- `catalogAddons` (doc id is addon id): `{ name, type, price }`
- `catalogRentals` (doc id is rental id): `{ name, price, qtyPerGuests }`
- `pricing/settings`: `{ perMileRate, serviceFeePct, taxRate, depositPct, quoteValidityDays, serverRate, chefRate }`
- `quotes` (auto id): quote submission records from `Accept & Continue`

## Admin + Save Flow

- Use `Admin Catalog` in the header to edit catalog and pricing settings.
- `Save Catalog` writes to Firestore (when configured) and local cache.
- `Accept & Continue` saves a quote to Firestore `quotes` (or local cache fallback).
- Quotes now include status workflow (`draft/sent/viewed/accepted/declined/expired`) and expiration dates.
- `Quote History` supports filtering, status updates, proposal PDF export, and copyable email template text.
- `Dashboard` shows conversion KPIs, pipeline value, and a monthly trend table.

## File Map

- `src/App.jsx`: wizard shell + step navigation
- `src/components/WizardSteps.jsx`: step forms and review table
- `src/components/LiveBreakdown.jsx`: right-side real-time totals panel
- `src/components/AdminCatalogModal.jsx`: catalog/settings editor UI
- `src/components/QuoteHistoryModal.jsx`: status workflow + export/email actions
- `src/components/ReportingDashboardModal.jsx`: KPI dashboard
- `src/lib/quoteCalculator.js`: pure quote math
- `src/lib/firebase.js`: Firebase bootstrap
- `src/lib/quoteStore.js`: quote lifecycle + persistence + email template builder
- `src/lib/proposalExport.js`: printable proposal/PDF export helper
- `src/hooks/useCatalogData.js`: catalog/settings data source hook

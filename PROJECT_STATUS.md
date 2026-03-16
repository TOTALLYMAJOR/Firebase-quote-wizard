# Project Status

Last updated: March 15, 2026

## Summary

The Firebase Quote Wizard is a production-ready catering quote application with live Firebase hosting, configurable pricing/catalog controls, proposal PDF/email outputs, event scheduling, and booking workflows from proposal acceptance to contract confirmation.

Current state:

- local development works
- production build passes
- Firebase Hosting is live
- GitHub is up to date
- automated unit tests and Playwright smoke coverage are in repo
- booking conversion and confirmation tracking are implemented
- in-app session diagnostics and runtime error logging are implemented
- Docker implementation restored (`Dockerfile`, `docker-compose.yml`, nginx SPA config)
- Vercel is optional and not required for current operation

## Live Status

- Firebase project: `tonicatering`
- Firebase Hosting URL: `https://tonicatering.web.app`
- GitHub repository: `https://github.com/TOTALLYMAJOR/Firebase-quote-wizard`
- Current branch: `main`

## What Has Been Built

### Core App

- React + Vite quote wizard app
- Firebase-ready data layer with local fallback
- live quote breakdown as selections change
- multi-step workflow for event details, menu/services, and review

### Pricing and Catalog

- package pricing
- add-on pricing
- rental pricing
- menu item pricing with `per_event` and `per_person` options
- configurable travel pricing
- configurable service fee tiers
- configurable tax regions
- seasonal pricing profiles
- event templates
- bartender pricing and staffing calculations

### Admin Controls

- Admin Catalog modal for editing:
  - packages
  - add-ons
  - rentals
  - menu item pricing
  - quote metadata
  - pricing settings
  - advanced JSON-backed rules

### Quote Output

- on-screen branded quote-sheet layout
- client and event information capture
- menu section display
- pricing lines for staffing, bartender, travel, gratuity, tax, total, and deposit
- PDF proposal export

### Operations Features

- quote history modal
- quote status lifecycle tracking
- payment/deposit status tracking
- booking conversion flow with availability checks (proposal -> contract)
- booking confirmation tracking (`pending`, `sent`, `confirmed`, `cancelled`)
- diagnostics modal with recent runtime errors, session context, and JSON export
- reporting dashboard
- scenario comparison modal
- recommendation/upsell support

### Deployment and Repo Setup

- Firebase Hosting deploy scaffolding added
- Firestore rules and indexes files added
- `.firebaserc.example` added
- environment validation script added
- Docker local runtime scaffolding added for dev and production parity
- CI quality workflow now includes a Docker production image build smoke check
- GitHub remote configured and pushed
- local Firebase CLI state ignored in `.gitignore`

## Completed Milestones

- [x] React app scaffolded and running
- [x] quote wizard core flow working
- [x] Firebase configuration wired
- [x] Firebase Hosting deployed live
- [x] GitHub repository updated and pushed
- [x] menu imported from catering menu image
- [x] menu item pricing editable from catalog
- [x] quote review upgraded to a more professional quote-sheet format
- [x] professional README written

## Current Known State

### Working Now

- `npm run dev`
- `npm run build`
- `npm run test:unit`
- `npm run test:e2e`
- Firebase env validation via `npm run check:env`
- Firebase Hosting deployment via `npm run deploy:firebase`
- Docker dev runtime via `docker compose up --build web-dev`
- Docker production runtime via `docker compose up --build web`

### Not Yet Completed

- Vercel deployment not configured yet
- custom domain connection not configured yet
- production security hardening for Firestore rules not done yet
- CI checks are configured but blocked by GitHub billing lock until account is restored

## Known Risks / Gaps

### Firestore Security

Current Firestore rules are permissive for speed of launch. This is acceptable for initial setup/testing but should be tightened before wider business use.

### Testing

Unit tests, wizard/proposal visual snapshots, and Playwright smoke tests are now present.

### Bundle Size

Production builds pass, but Vite reports a large JS chunk warning. This is non-blocking right now.

### Vercel

Vercel support files exist, but Vercel has not been completed because Firebase Hosting is already sufficient for launch.

## Recommended Next Steps

### Immediate Next

1. test the live Firebase app end-to-end
2. create a few real sample quotes
3. verify PDF proposal output with real client data
4. confirm catalog edits persist after refresh
5. verify mobile layout on phone

### Business-Ready Next

1. tighten Firestore rules with authentication and role-based access
2. connect a custom domain or business-site link to Firebase Hosting
3. add a client-facing handoff/training document
4. finalize sales proposal and pricing materials
5. prioritize production reporting depth, CRM integrations, and operational audit controls

### Engineering Next

1. restore CI execution after GitHub billing lock is resolved
2. extend end-to-end coverage for scheduling and booking confirmation paths
3. build deeper operations audit controls (retry dashboards, sync health trends, role-based action logs)
4. split large production bundle if performance becomes a concern

## Important Files

- `README.md`: project overview and setup
- `GO_LIVE_OPTION1.md`: launch checklist
- `DEV_TASKS.md`: roadmap backlog
- `firebase.json`: Firebase Hosting config
- `firestore.rules`: Firestore access rules
- `src/App.jsx`: main app shell
- `src/components/WizardSteps.jsx`: wizard steps and review layout
- `src/components/AdminCatalogModal.jsx`: catalog and pricing editor
- `src/lib/quoteCalculator.js`: quote math engine
- `src/lib/quoteStore.js`: save/history/payment flow
- `src/lib/proposalExport.js`: PDF export

## Notes

- Firebase Hosting is currently the primary deployment path.
- Vercel can be added later if preview deploys or a separate deployment workflow are needed.
- Docker can now be used as a reproducible local runtime path independent of host Node setup.

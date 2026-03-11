# AGENTS.md

Last updated: March 10, 2026

## Mission
Maintain the Firebase Quote Wizard as a reliable production tool for Tony Catering.
Ship changes that are safe, testable, and documented.

## Project Facts
- Frontend: React 18 + Vite 5
- Services: Firebase Auth, Firestore, Firebase Hosting
- Main deployment target: Firebase Hosting (`https://tonicatering.web.app`)
- Secondary deployment target: Vercel (optional)
- Current quote lifecycle statuses: `draft`, `sent`, `viewed`, `accepted`, `booked`, `declined`, `expired`

## Required Workflow
1. Read `README.md`, `DEV_TASKS.md`, `PROJECT_STATUS.md`, and `CHANGELOG.md`.
2. Identify affected areas (quote math, catalog data, Firebase persistence, auth, UI).
3. Apply focused changes and preserve backward compatibility for existing quote documents.
4. Validate locally:
   - `npm run check:env`
   - `npm run build`
5. Update docs when behavior or process changes:
   - `CHANGELOG.md`
   - `PROJECT_STATUS.md`
   - `DEV_TASKS.md`
6. Report outcomes with changed files, validations run, and remaining risks.

## Guardrails
- Never commit secrets (`.env`, private keys, service credentials).
- Treat `firestore.rules` and `firestore.indexes.json` as high-risk files.
- Preserve local fallback behavior when Firebase configuration is missing.
- Keep customer-facing proposal output accurate when touching pricing logic.
- Keep admin-only capabilities role-gated and authenticated.

## High-Risk Files
- `src/lib/quoteCalculator.js`
- `src/lib/quoteStore.js`
- `src/lib/firebase.js`
- `src/lib/authClient.js`
- `src/lib/proposalExport.js`
- `firestore.rules`
- `firestore.indexes.json`

## Definition of Done
- Build passes.
- User-visible behavior matches requested scope.
- Related docs are updated.
- Diff is focused and reviewable.
- Known risks and follow-up items are explicit.

## Local Skill Pack
Skill folders are in `.codex/skills/`:
- `quote-wizard-maintainer`
- `quote-wizard-release-manager`

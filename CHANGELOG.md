# Changelog

All notable project changes are documented in this file.

This changelog is backfilled from git history and will be maintained going forward.

## [Unreleased]

### Added

- Booking workflow upgrades: availability-aware proposal-to-contract conversion and confirmation tracking in quote history.
- Unit tests for booking conversion and confirmation lifecycle in local fallback mode.
- Visual snapshot tests covering Event/Menu/Review wizard states and the proposal sheet output.
- Session diagnostics module with runtime error capture (`window.error` and `unhandledrejection`) and a staff diagnostics modal with export/clear tools.
- Docker runtime scaffolding with multi-stage `Dockerfile`, `docker-compose.yml`, `.dockerignore`, and nginx SPA config.
- Canonical documentation ownership spec (`docs/DOC_SYSTEM.md`) with update triggers and data ownership matrix.
- Agent governance, performance guardrail docs, and technology exception log.
- Governance enforcement script (`scripts/check-doc-governance.mjs`) and bundle budget gate (`scripts/check-bundle-budget.mjs`).
- Lighthouse CI configuration and bundle baseline file for hard UX/performance gates.

### Changed

- Event schedule cards now surface contract number and confirmation state for accepted/booked events.
- Updated `@vitejs/plugin-react` to a Vite 7 compatible major version so `npm ci` succeeds for CI and container builds.
- Added a CI Docker smoke check job that runs `docker compose build web` on pushes/PRs.
- Hardened Playwright smoke selectors with exact label matching to avoid `Venue`/`Venue address` strict-mode collisions.
- Updated Playwright history assertion to validate persisted quote row data that is actually rendered (`E2E Staff` and edited guest count).
- Added `Governance + Perf Gates` CI job to enforce doc sync/security/drift checks plus bundle/CWV thresholds.
- Consolidated canonical docs to remove duplicated status/backlog/process narrative across top-level files.
- Replaced legacy go-live content with pointer to canonical launch runbook (`docs/LAUNCH_RUNBOOK.md`).
- Hardened doc governance diff/path parsing and added explicit code/process/deploy/backlog doc ownership enforcement.
- Updated Lighthouse CI to run against `vite preview` on `127.0.0.1` for deterministic smoke checks.
- Ignored local `.lighthouseci/` artifacts to prevent accidental commit noise.

## [2026-03-10]

### Added

- `7a99d13`: Added integration config and sync audit ops modal.

### Changed

- `fe4d60b`: Disabled QuickBooks workflow and kept CRM integration ops active.
- `a942410`: Removed remaining QuickBooks references and aligned docs.

## [2026-03-09]

### Added

- `219fc4d`: Added configurable branding theme and logo upload.
- `7e82941`: Added booking status and submit-time availability checks.
- `1222c4a`: Added schedule calendar modal with month and week views.
- `35a1868`: Enhanced schedule staffing board and conflict checks.

## [2026-03-08]

### Added

- `d628cc4`: Added auth roles, customer portal, and hosting hardening.

## [2026-03-05]

### Changed

- `621057c`: Removed customer card surcharge from quote totals and UI.

## [2026-03-04]

### Changed

- `77c75bc`: Updated branding, quote preview, and PDF export.
- `dd48ef5`: Updated quote wizard content and pricing settings.

## [2026-03-03]

### Added

- `8b858e9`: Added project status summary document.

## [2026-03-02]

### Added

- `d833bfc`: Added professional project README.
- `2a029bc`: Enhanced quote sheet details and added Option 1 deployment scaffolding.

### Changed

- `a6dffbb`: Ignored local Firebase CLI state.

## [2026-02-27]

### Added

- `3b5f902`: Implemented beauty, capability, and configurability upgrades.
- `fa4e6a7`: Added editable menu item pricing to catalog and quote totals.

## [2026-02-26]

### Added

- `1ce0a73`: Initial commit with React Firebase quote wizard and dashboard/history baseline.
- `e062c93`: Added `.env.example` and deployment guides for Vercel/Firebase Hosting.
- `1f219a8`: Added branded header images and gold/black theme.

### Fixed

- `dd35879`: Fixed PDF export by generating downloadable files with jsPDF.

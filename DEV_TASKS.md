# Dev Tasks

## Priority Now

- [x] Add automated quote-calculation tests with fixtures covering package, addon, rental, labor, mileage, tax, and deposit scenarios.
- [x] Generate proposal PDFs and email payloads from quote data with consistent branding and verification snapshots.
- [x] Add Playwright end-to-end coverage for key quote-builder flows (new quote, edit quote, save quote, export/send actions).

## Beauty Backlog

- [ ] Create a full design token system (typography, spacing, radii, shadows, brand colors) and apply it app-wide.
- [ ] Add richer visual storytelling in the wizard (food imagery, section art, and themed backgrounds per step).
- [ ] Improve motion design with intentional step transitions and subtle live-breakdown feedback animations.
- [ ] Upgrade proposal visual polish (cover page, event theme accents, cleaner totals hierarchy).
- [ ] Add mobile-first layout refinements for review tables and pricing cards.

## Capability Backlog

- [ ] Add a side-by-side quote comparison mode (multiple packages, guests, and staffing plans).
- [ ] Build a recommendation layer for upsells based on guest count, event type, and selected menu.
- [ ] Add lead and client workflow stages with reminders (follow-up dates, status prompts, conversion tracking).
- [ ] Add payment/deposit link support and confirmation tracking.
- [ ] Add basic analytics events for funnel drop-off by step and most-selected add-ons.
- [ ] Add production reporting modules (prep sheets, labor plans, purchasing projections, and post-event actuals).
- [ ] Add accounting integration for invoice, payment, deposit, and reconciliation sync (deferred for now).
- [ ] Add CRM integrations (HubSpot/Salesforce or webhook adapters) for lead and client record sync.
- [x] Add event scheduling with calendar views, staffing assignments, and kitchen timeline checkpoints.
- [x] Add booking workflows with availability checks, proposal-to-contract conversion, and confirmation tracking.
- [ ] Add a more robust operations architecture (integration retries, sync logs, audit trails, and role-based workflow controls).

## Configurability Backlog

- [ ] Move pricing and rule logic to config-driven policies (service fee rules, delivery thresholds, tax regions).
- [ ] Support per-event templates (wedding, corporate, birthday, church) with preloaded defaults.
- [ ] Add seasonal/holiday menu profiles with effective date ranges.
- [ ] Add feature flags to enable/disable modules without code changes.
- [ ] Add role-based admin controls for catalog edits, quote approvals, and reporting visibility.

## Platform and Quality

- [ ] Add CI checks for lint, unit tests, and Playwright smoke suite.
- [x] Add visual regression snapshots for major wizard states and proposal output.
- [x] Add error tracking and user-session diagnostics for production troubleshooting.

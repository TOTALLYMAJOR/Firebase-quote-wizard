# Dev Tasks

Last updated: March 19, 2026

## P0 - Deferred Architecture (Come Back To This)
- Implement multi-tenant organization scoping across app + Firestore + Cloud Functions (parked initiative).
- Use the phased execution plan in [docs/MULTI_TENANT_ORG_SCOPING_PLAN.md](docs/MULTI_TENANT_ORG_SCOPING_PLAN.md).
- Target migration style: additive/dual-read transition first, then deprecate global writes.

## P0 - Security and Reliability
- Re-establish staging sign-off workflow and release checklist enforcement before broadening `main` merge velocity.
- Tighten Firestore rules for production-grade least-privilege access.
- Add targeted E2E scenarios for booking conversion/confirmation edge cases.
- Add automated secret scanning for non-markdown assets (scripts/config) in CI.

## P1 - Performance and UX
- Reduce largest JavaScript chunk size (split proposal/export-heavy paths where practical).
- Improve wizard mobile layout for dense review/pricing states.
- Add intentional transition/motion polish for step changes and live breakdown updates.

## P1 - Product Capability
- Add lead/client follow-up workflow stages with reminder prompts.
- Add basic analytics events for funnel drop-off and add-on selection trends.
- Extend operations audit controls (retry dashboards, sync health trends, role-based action logs).

## P2 - Integrations
- Add CRM adapters (HubSpot/Salesforce or webhook bridge).
- Add accounting sync for invoicing and reconciliation flows.
- Add two-way owner/client SMS thread support.

## P2 - Configurability
- Move more pricing behavior to config-driven policies.
- Add feature flags for optional modules.
- Add finer role-based controls for approvals/report visibility.

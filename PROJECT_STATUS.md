# Project Status

Last updated: March 16, 2026

## Operational Health
- Runtime: app is live on Firebase Hosting (`https://tonicatering.web.app`).
- Build: `npm run build` passes locally for this branch.
- Test coverage: unit + Playwright smoke suites are configured in CI.
- CI gates: `Unit + Build`, `Governance + Perf Gates`, `Docker Build Smoke`, and `Playwright Smoke` are configured.
- Delivery controls: canonical doc ownership and governance checks are now enforced in CI.
- Commerce resilience: Twilio SMS failures are non-blocking for quote save and Stripe checkout.
- Buyer onboarding: Integrations Ops now includes an in-app setup assistant for optional Twilio configuration.

## Active Risks
- Firestore production hardening is still pending deeper policy tightening.
- Bundle size remains a watch item; budget/CWV gates now prevent uncontrolled regressions.
- Functions integrations (Stripe/Twilio) remain optional and require secure runtime configuration.

## Current Focus (Near-Term)
1. Tighten Firestore rules for wider production usage.
2. Expand end-to-end coverage for scheduling/booking edge paths.
3. Improve large-chunk performance while staying inside bundle/CWV guardrails.
4. Maintain per-merge documentation sync discipline under `docs/DOC_SYSTEM.md`.

## Notes
- Canonical status ownership is defined in [docs/DOC_SYSTEM.md](docs/DOC_SYSTEM.md).
- Launch operations guidance now lives in [docs/LAUNCH_RUNBOOK.md](docs/LAUNCH_RUNBOOK.md).
- Backlog prioritization is tracked in [DEV_TASKS.md](DEV_TASKS.md).

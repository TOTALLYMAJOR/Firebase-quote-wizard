# Project Status

Last updated: March 17, 2026

## Operational Health
- Runtime: app is live on Firebase Hosting (`https://tonicatering.web.app`).
- Build: `npm run build` passes locally for this branch.
- Test coverage: unit + Playwright smoke suites are configured in CI.
- CI gates: `Unit + Build`, `Governance + Perf Gates`, `Docker Build Smoke`, and `Playwright Smoke` are configured.
- Deploy gate: production deploy workflow now runs only after successful `CI Quality` completion on `main` pushes (or controlled manual dispatch).
- Delivery controls: canonical doc ownership and governance checks are now enforced in CI.
- Commerce resilience: Twilio SMS failures are non-blocking for quote save and Stripe checkout.
- Buyer onboarding: Integrations Ops now includes an in-app setup assistant for optional Twilio configuration.
- Production guardrail: `ENABLE_FUNCTIONS_DEPLOY=false` (default locked state).
- Production fail-safe integration mode: `notifications.sms_provider="none"` in Firebase Functions config.
- Last known good production deploy:
  - commit: `393cef7c22ce1964f5d722ef2f20990cd566c957`
  - workflow run: `Deploy Firebase Hosting (+ Optional Functions)` #23174414155 (March 17, 2026 UTC)

## Active Risks
- Firestore production hardening is still pending deeper policy tightening.
- Bundle size remains a watch item; budget/CWV gates now prevent uncontrolled regressions.
- Functions integrations (Stripe/Twilio) remain optional and require secure runtime configuration.
- Staging sign-off routine must be re-established to keep `main` release-only under higher delivery velocity.

## Current Focus (Near-Term)
1. Tighten Firestore rules for wider production usage.
2. Re-establish staging sign-off workflow before broadening merge velocity into `main`.
3. Expand end-to-end coverage for scheduling/booking edge paths.
4. Improve large-chunk performance while staying inside bundle/CWV guardrails.
5. Maintain per-merge documentation sync discipline under `docs/DOC_SYSTEM.md`.

## Notes
- Canonical status ownership is defined in [docs/DOC_SYSTEM.md](docs/DOC_SYSTEM.md).
- Launch operations guidance now lives in [docs/LAUNCH_RUNBOOK.md](docs/LAUNCH_RUNBOOK.md).
- Release-only branch and rollback policy live in [docs/VERSION_CONTROL.md](docs/VERSION_CONTROL.md).
- Backlog prioritization is tracked in [DEV_TASKS.md](DEV_TASKS.md).

# Release Playbook

## 1) Confirm Scope
- Identify included features/fixes/docs updates.
- Confirm deferred work is explicit.

## 2) Run Release Checks
```bash
npm run check:env
npm run build
npm run check:docs:governance
npm run check:perf:bundle
```
Optional CWV gate:
```bash
npm run check:perf:cwv
```

## 3) Curate Release Notes
- Update `CHANGELOG.md` with concise user-facing entries.
- Include risk and rollback notes for high-risk areas.

## 4) Sync Operational State
- Update `PROJECT_STATUS.md` (health, risks, next actions).
- Ensure ownership rules match `docs/DOC_SYSTEM.md`.

## 5) Tag and Deploy
- Ensure `main` contains only intended release commits.
- Tag semantic version (`vX.Y.Z`).
- Deploy from tagged `main` commit.

## 6) Post-Release Verification
- Confirm hosting availability.
- Smoke test quote creation/save/export.
- Log and triage any production issues immediately.

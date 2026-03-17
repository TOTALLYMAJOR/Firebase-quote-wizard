## Summary
- What changed:
- Why it changed:

## Validation
- [ ] `npm run check:env`
- [ ] `npm run build`
- [ ] Manual behavior check completed (if needed)

## Risk Review
- Risk level: low / medium / high
- Affected areas:
- Rollback approach:

## Production Release Gate
- Production impact: none / production-triggering
- [ ] If production-triggering: all CI jobs are green (`Unit + Build`, `Governance + Perf Gates`, `Docker Build Smoke`, `Playwright Smoke`)
- [ ] If production-triggering: 10-minute UAT checklist from `docs/LAUNCH_RUNBOOK.md` passed
- [ ] If production-triggering: rollback SHA/path is confirmed against `PROJECT_STATUS.md`

## Documentation
- [ ] `CHANGELOG.md` updated (if user-visible change)
- [ ] `PROJECT_STATUS.md` updated (if milestone/status changed)
- [ ] `DEV_TASKS.md` updated (if roadmap priorities changed)
- [ ] `README.md` or `CONTRIBUTING.md` updated (if setup/process changed)

## Doc Impact Declaration
- Canonical docs touched:
- Why each update was needed under `docs/DOC_SYSTEM.md`:
- If no canonical doc changed, justify why:

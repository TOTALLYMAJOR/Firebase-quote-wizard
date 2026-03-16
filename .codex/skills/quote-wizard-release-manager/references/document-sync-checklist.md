# Document Sync Checklist

## Canonical Ownership
- Use `docs/DOC_SYSTEM.md` as the ownership matrix.
- Update only owning docs for changed topics.
- Link to canonical docs instead of duplicating content.

## Required Updates by Change Type
- Behavior/code changes: `CHANGELOG.md`
- Operational state/risk changes: `PROJECT_STATUS.md`
- Priority/backlog changes: `DEV_TASKS.md`
- Setup/process/deploy entrypoint changes: `README.md`

## Consistency Pass
- Dates are current.
- Runtime version claims match `package.json`.
- No secret-like values in docs.
- No stale references to replaced runbooks or removed files.

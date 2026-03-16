# Safe Change Checklist

## Before Editing
- Confirm requested scope and non-goals.
- Identify whether change touches pricing math, persistence, auth, or security rules.
- Note user-visible behaviors that must remain stable.

## During Editing
- Keep changes small and focused.
- Avoid renaming persisted field keys unless migration is explicit.
- Preserve quote status enum semantics.
- Keep fallback behavior for missing Firebase env vars.

## After Editing
- Run `scripts/run-maintainer-checks.sh`.
- Smoke-check impacted flows in app.
- Update canonical docs per `docs/DOC_SYSTEM.md` where relevant.
- Report residual risk and follow-up tasks.

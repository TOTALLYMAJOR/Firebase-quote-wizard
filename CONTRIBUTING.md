# Contributing to Firebase Quote Wizard

Last updated: March 10, 2026

## Development Setup
1. Use Node.js 18+.
2. Run `npm install`.
3. Create `.env` from `.env.example`.
4. Validate setup with `npm run check:env`.
5. Start local dev with `npm run dev`.

## Branching Strategy
- `main`: production-ready branch.
- `feature/<scope>-<topic>`: new features.
- `fix/<scope>-<topic>`: bug fixes.
- `docs/<topic>`: documentation-only updates.
- `chore/<topic>`: maintenance tasks.

## Commit Convention
Use Conventional Commits for clean history and changelog generation.

Examples:
- `feat(quote): add menu section subtotal grouping`
- `fix(pdf): correct deposit value on export`
- `docs(git): add release workflow guidance`
- `chore(ci): add build smoke check`

## Pull Request Expectations
1. Keep PR scope focused.
2. Include a clear summary of behavior changes.
3. Include test or verification evidence.
4. Update docs when behavior or process changed.
5. Note any follow-up work explicitly.

## Validation Checklist
Run these before opening or merging a PR:
- `npm run check:env`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run build`

If you changed quote logic, Firestore behavior, or PDF output, include manual validation notes in the PR description.

## Documentation Discipline
Update these files when relevant:
- `CHANGELOG.md` for notable changes.
- `PROJECT_STATUS.md` for milestone/status movement.
- `DEV_TASKS.md` for roadmap reprioritization.
- `README.md` for setup or architecture changes.

## Release Discipline
- Keep `main` releasable.
- Prefer small, frequent merges.
- Tag releases with semantic versions (for example `v0.2.0`).
- Record release notes in `CHANGELOG.md`.

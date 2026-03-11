# Version Control Playbook

Last updated: March 10, 2026

## Goals
- Keep `main` stable and deployable.
- Keep history understandable.
- Reduce risky late-stage merge conflicts.

## Daily Workflow
1. Sync from remote:
   ```bash
   git checkout main
   git pull origin main
   ```
2. Create a scoped branch:
   ```bash
   git checkout -b feature/quote-<topic>
   ```
3. Implement focused changes.
4. Run project checks:
   ```bash
   npm run check:env
   npm run test:unit
   npm run test:e2e
   npm run build
   ```
5. Commit with a conventional message.
6. Open PR with verification notes.

## Branch Naming
- `feature/<scope>-<topic>`
- `fix/<scope>-<topic>`
- `docs/<topic>`
- `chore/<topic>`
- `release/<version>`

## Commit Quality Rules
- Commit logical units, not unrelated batches.
- Do not mix refactors with behavior changes unless necessary.
- Include doc updates in the same PR when behavior changed.
- Avoid committing generated local state (`dist/`, `.firebase/`, `.env`).

## Release Workflow
1. Create `release/<version>` branch from `main`.
2. Finalize `CHANGELOG.md` and `PROJECT_STATUS.md`.
3. Run checks:
   - `npm run check:env`
   - `npm run test:unit`
   - `npm run test:e2e`
   - `npm run build`
4. Merge release PR to `main`.
5. Tag and push:
   ```bash
   git tag v<major>.<minor>.<patch>
   git push origin v<major>.<minor>.<patch>
   ```
6. Deploy from `main` after tag confirmation.

## Hotfix Workflow
1. Branch from `main` as `fix/<scope>-<topic>`.
2. Patch only the urgent issue.
3. Re-run checks and merge quickly.
4. Record the fix in `CHANGELOG.md`.
5. Tag a patch release.

## Documentation Requirements Per Merge
- User-visible changes: update `CHANGELOG.md`.
- Operational status changes: update `PROJECT_STATUS.md`.
- Priority changes: update `DEV_TASKS.md`.
- Onboarding/config changes: update `README.md` and/or `CONTRIBUTING.md`.

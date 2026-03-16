# Version Control Playbook

Last updated: March 16, 2026

## Goals
- Keep `main` stable and deployable.
- Preserve traceable, reviewable history.
- Keep canonical docs synchronized per merge.

## Daily Flow
1. Sync:
```bash
git checkout main
git pull origin main
```
2. Branch:
```bash
git checkout -b feature/<scope>-<topic>
```
3. Implement focused changes.
4. Run required checks (see `CONTRIBUTING.md`).
   - For CI workflow edits, confirm the CI gate steps are runnable in GitHub Actions and documented in `CHANGELOG.md`.
5. Update canonical docs per `docs/DOC_SYSTEM.md`.
6. Open PR with validation evidence and doc impact declaration.

## Branch Naming
- `feature/<scope>-<topic>`
- `fix/<scope>-<topic>`
- `docs/<topic>`
- `chore/<topic>`
- `release/<version>`

## Commit Quality Rules
- Commit logical units only.
- Avoid mixing unrelated refactors and behavior changes.
- Never commit local state or secrets.

## Release Workflow
1. Create `release/<version>` from `main`.
2. Finalize `CHANGELOG.md` and `PROJECT_STATUS.md`.
3. Run release checks.
4. Merge release PR to `main`.
5. Tag semantic version:
```bash
git tag v<major>.<minor>.<patch>
git push origin v<major>.<minor>.<patch>
```
6. Deploy from tagged `main` commit.

## Doc Sync Rule
`docs/DOC_SYSTEM.md` is the canonical ownership matrix.
If a topic changes, only update the owning doc and cross-link from others.

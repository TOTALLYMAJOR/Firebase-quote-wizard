# Local Skill Index

Last updated: March 10, 2026

This repository includes a local Codex skill pack under `.codex/skills/`.

## Available Skills

### `quote-wizard-maintainer`
Use for day-to-day implementation work:
- feature delivery
- bug fixes
- refactors
- safe updates to quote logic, Firebase flows, and docs

Entry file:
- `.codex/skills/quote-wizard-maintainer/SKILL.md`

### `quote-wizard-release-manager`
Use for release and operational readiness work:
- changelog curation
- release notes preparation
- pre-deploy checks
- release risk review

Entry file:
- `.codex/skills/quote-wizard-release-manager/SKILL.md`

## Maintenance Notes
- Validate skill structure after edits:
  ```bash
  python3 /home/totallymajor/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/<skill-name>
  ```
- Keep skill `description` fields precise so trigger matching stays reliable.

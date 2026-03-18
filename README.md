# Firebase Quote Wizard

Production-ready catering quote application built with React, Vite, Firebase, and jsPDF.

## Quick Links
- Live app: https://tonicatering.web.app
- Repository: https://github.com/TOTALLYMAJOR/Firebase-quote-wizard
- Launch runbook: [docs/LAUNCH_RUNBOOK.md](docs/LAUNCH_RUNBOOK.md)
- Canonical doc system: [docs/DOC_SYSTEM.md](docs/DOC_SYSTEM.md)

## Product Scope
The app supports quote intake, pricing configuration, proposal export, customer portal updates, and operations workflows (history, scheduling, reporting, diagnostics).

## Architecture Snapshot
- Frontend: React 18 + Vite 7
- Data/Auth: Firebase Firestore + Firebase Auth
- Deploy target: Firebase Hosting (primary), Vercel (optional)
- Local runtime options: Node (`npm run dev`) or Docker Compose (`web-dev` / `web`)

## Local Setup
### Prerequisites
- Node.js 20+
- npm

### Install + Validate
```bash
npm install
npm run check:env
```

### Run (Node)
```bash
npm run dev
```

### Run (Docker)
Dev server:
```bash
docker compose up --build web-dev
```

Production-like image:
```bash
docker compose up --build web
```

## Environment
Create `.env` from `.env.example` and set required Firebase keys:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Optional:
- `VITE_FIREBASE_FUNCTIONS_REGION`
- `VITE_BOOTSTRAP_ADMIN_EMAILS`

## Quality Gates
```bash
npm run check:env
npm run test:unit
npm run test:e2e
npm run build
npm run check:docs:governance
npm run check:perf:bundle
npm run check:perf:cwv
```

## Firestore Menu Seed
Populate baseline dynamic menu collections (`eventTypes`, `menuCategories`, `menuItems`) without touching quotes or pricing.

Dry run:
```bash
npm run seed:menu:firestore -- --project <your-project-id> --dry-run
```

Apply seed:
```bash
npm run seed:menu:firestore -- --project <your-project-id>
```

Notes:
- The script is idempotent and only creates missing docs.
- It never deletes or rewrites existing menu docs.
- Auth uses Firebase Admin ADC/service credentials (`GOOGLE_APPLICATION_CREDENTIALS`) or emulator config.

## Deploy Entry Points
- Firebase hosting/functions: `npm run deploy:firebase`
- Firebase functions only: `npm run deploy:firebase:functions`
- Vercel (optional): `npm run deploy:vercel`

## Governance Docs
- Contributor workflow: [CONTRIBUTING.md](CONTRIBUTING.md)
- Version/release playbook: [docs/VERSION_CONTROL.md](docs/VERSION_CONTROL.md)
- Agent governance: [docs/AGENT_GOVERNANCE.md](docs/AGENT_GOVERNANCE.md)
- Skill index: [docs/SKILLS.md](docs/SKILLS.md)
- Performance guardrails: [docs/PERFORMANCE_GUARDRAILS.md](docs/PERFORMANCE_GUARDRAILS.md)
- Current operational state: [PROJECT_STATUS.md](PROJECT_STATUS.md)
- Prioritized backlog: [DEV_TASKS.md](DEV_TASKS.md)
- Change history: [CHANGELOG.md](CHANGELOG.md)

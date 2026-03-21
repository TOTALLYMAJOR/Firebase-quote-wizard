#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${E2E_FIREBASE_PROJECT_ID:-demo-e2e}"
ORG_ID="${E2E_FIREBASE_ORG_ID:-e2e-org}"
EMAIL="${E2E_FIREBASE_EMAIL:-e2e-admin@local.test}"
PASSWORD="${E2E_FIREBASE_PASSWORD:-Passw0rd!}"

node ./scripts/seed-firestore-menu.mjs --project "$PROJECT_ID" --organization "$ORG_ID"
node ./scripts/seed-e2e-emulator-user.mjs --project "$PROJECT_ID" --organization "$ORG_ID" --email "$EMAIL" --password "$PASSWORD"

bash ./scripts/run-playwright.sh test --config=playwright.firebase.config.js e2e/firebase-auth-rules.smoke.spec.js

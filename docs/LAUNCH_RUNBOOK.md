# Launch Runbook

Last updated: March 16, 2026

## Goal
Deploy Firebase Quote Wizard safely with environment validation, reproducible build checks, and clear post-launch verification.

## 1) Prepare Firebase
1. Create/select Firebase project.
2. Enable Firestore Database.
3. Create Firebase Web App and capture `VITE_FIREBASE_*` values.
4. Enable Authentication providers needed by staff (`Email/Password`, `Google`).

## 2) Configure Local Environment
1. Copy `.env.example` to `.env`.
2. Set required values:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
3. Validate and build:
```bash
npm run check:env
npm run build
```

## 3) Deploy Hosting + Firestore
```bash
npx firebase-tools login
npx firebase-tools use --add
npm run deploy:firebase
```

## 4) Configure CI Variables
Set repository variables/secrets used by deploy workflow:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- optional: `VITE_FIREBASE_FUNCTIONS_REGION`
- optional: `ENABLE_FUNCTIONS_DEPLOY=true` (requires Blaze plan)

## 5) Optional Functions (Stripe + Twilio)
Set configuration with your own credentials (never commit real secrets):
```bash
npx firebase-tools functions:config:set \
  stripe.secret_key="<your_stripe_secret>" \
  stripe.webhook_secret="<your_stripe_webhook_secret>" \
  twilio.account_sid="<your_twilio_account_sid>" \
  twilio.auth_token="<your_twilio_auth_token>" \
  twilio.from_number="<your_twilio_from_number>" \
  notifications.owner_phone="<your_owner_phone>" \
  app.base_url="https://tonicatering.web.app"
```

Deploy functions:
```bash
npm run deploy:firebase:functions
```

Stripe webhook endpoint:
- `https://us-central1-tonicatering.cloudfunctions.net/stripeWebhook`
- event: `checkout.session.completed`

## 6) Post-Launch Verification
1. Create a quote end-to-end.
2. Confirm quote appears in history.
3. Export PDF proposal.
4. Verify customer portal accept/decline updates.
5. Validate mobile layout and key interaction flows.

## 7) Rollback
- Re-deploy previous known-good commit from `main`.
- Re-run `npm run check:env` and `npm run build` before re-deploy.

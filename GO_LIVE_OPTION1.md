# Option 1 Go-Live (Vercel + Firebase)

Target: stand this up in about 30-90 minutes.

## 1) Create Firebase project

1. Go to Firebase Console and create/select project.
2. Enable Firestore Database.
3. In Project Settings -> General -> Your apps, create a Web app.
4. Copy the Firebase config values.

## 2) Local env setup

1. Copy `.env.example` to `.env`.
2. Fill these keys:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
3. Run:

```bash
npm run check:env
npm run build
```

Optional bootstrap admins:

```env
VITE_BOOTSTRAP_ADMIN_EMAILS=owner@yourdomain.com,manager@yourdomain.com
```

## 3) Deploy Firestore rules + Hosting (Firebase CLI path)

1. Login and set project:

```bash
npx firebase-tools login
npx firebase-tools use --add
```

2. Deploy:

```bash
npm run deploy:firebase
```

## 4) Deploy on Vercel (recommended app URL)

1. Push repo to GitHub.
2. In Vercel, import project.
3. Add all `VITE_FIREBASE_*` env vars in Project Settings.
4. Deploy.

Optional CLI:

```bash
npx vercel login
npm run deploy:vercel
```

## 5) Connect to business site

Use one of:

1. Add a button/link on the business site to `quotes.yourdomain.com`
2. Add an iframe embed to the Vercel/Firebase URL

Best practice: subdomain (`quotes.yourdomain.com`) + direct link.

## 6) Enable authentication and roles

1. In Firebase Console -> Authentication -> Sign-in method:
   - enable Email/Password
   - enable Google
2. Sign in once with your owner account.
3. In Firestore, verify `userRoles/{uid}` has role `admin` for your owner user.
4. Add `sales` role docs for internal users who need quote access but not admin catalog control.

## 7) Post-launch checklist

1. Create at least one test quote.
2. Confirm quote appears in Quote History.
3. Confirm Admin Catalog save persists after refresh.
4. Copy customer portal link from Quote History and verify accept/decline updates status.
5. Export one PDF proposal.
6. Confirm mobile layout on iPhone + Android viewport.

## 8) Optional: Stripe Deposit + Owner SMS

1. Configure functions runtime values:

```bash
npx firebase-tools functions:config:set \
  stripe.secret_key="sk_live_..." \
  stripe.webhook_secret="whsec_..." \
  twilio.account_sid="AC..." \
  twilio.auth_token="..." \
  twilio.from_number="+12055550100" \
  notifications.owner_phone="+12055550123" \
  app.base_url="https://tonicatering.web.app"
```

2. Deploy functions:

```bash
npm run deploy:firebase:functions
```

3. In Stripe Dashboard, add webhook endpoint:

- `https://us-central1-tonicatering.cloudfunctions.net/stripeWebhook`
- event: `checkout.session.completed`

## Security note

Current `firestore.rules` are role-gated:

- authenticated staff (`sales` / `admin`) can operate the quote workspace
- only `admin` can modify catalog and pricing settings
- customer portal links can only update limited status fields

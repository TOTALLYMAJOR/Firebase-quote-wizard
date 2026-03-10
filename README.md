# Firebase Quote Wizard

A production-ready catering quote application built with React, Vite, Firebase, and jsPDF.

This project helps catering businesses create polished quotes, manage pricing, update menu items, track quote history, and export client-ready proposal PDFs from a single workflow.

## Live App

- Firebase Hosting: https://tonicatering.web.app
- GitHub Repository: https://github.com/TOTALLYMAJOR/Firebase-quote-wizard

## Overview

Firebase Quote Wizard is designed for service-based food businesses that need a fast and configurable quoting workflow.

The app supports:

- event intake and client details
- package, addon, rental, and menu-item pricing
- staffing, bartender, travel, service fee, tax, and deposit calculations
- client-facing quote sheet presentation
- proposal PDF export
- quote history and status tracking
- admin-controlled catalog and pricing updates
- Firebase-backed persistence for live use
- email/Google staff authentication with role-gated admin controls
- customer quote portal links for view/accept/decline updates

## Core Features

### Quote Builder

- multi-step event and menu workflow
- live pricing breakdown as selections change
- configurable service styles, tax regions, and seasonal pricing profiles
- support for per-person and per-event menu pricing

### Catalog Management

- editable packages, add-ons, rentals, and menu items
- admin-controlled pricing settings
- configurable quote metadata such as prepared-by, deposit notice, and business contact info
- configurable branding settings (brand name, tagline, logo upload/path, hero copy, crew display, and brand colors)
- advanced JSON-backed settings for pricing tiers, templates, and seasonal rules

### Proposal Output

- polished on-screen quote layout
- PDF export using `jsPDF`
- client/event details, menu selections, and pricing summary included in output

### Operations and Reporting

- quote save flow with local fallback or Firebase persistence
- quote lifecycle tracking: `draft`, `sent`, `viewed`, `accepted`, `booked`, `declined`, `expired`
- deposit payment status tracking
- reporting dashboard with pipeline and conversion metrics
- customer portal record sync in Firestore (`customerPortalQuotes`)
- availability checks against existing accepted/booked events on submit

## Tech Stack

- React 18
- Vite 5
- Firebase 11
- jsPDF
- Plain CSS

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Firebase project for live deployment

### Local Development

```bash
cd react-firebase-quote-wizard
npm install
npm run dev
```

Vite will start the local development server and print the local URL in the terminal.

### Production Build

```bash
npm run build
```up

### Preview Production Build

```bash
npm run preview
```

## Environment Variables

Create a `.env` file in the project root using `.env.example`.

Required Firebase variables:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Validate environment configuration with:

```bash
npm run check:env
```

If Firebase variables are not present, the app falls back to local defaults and local cache where supported.

Optional role bootstrap:

```env
VITE_BOOTSTRAP_ADMIN_EMAILS=owner@yourdomain.com,manager@yourdomain.com
```

## Available Scripts

```bash
npm run dev
npm run build
npm run preview
npm run check:env
npm run deploy:firebase
npm run deploy:vercel
npm run deploy:vercel:build
```

## Deployment

### Firebase Hosting

This repository already includes Firebase deployment scaffolding.

```bash
npx firebase-tools login
npx firebase-tools use --add
npm run deploy:firebase
```

Supporting files:

- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`
- `.firebaserc.example`

### Vercel

Vercel support is included but optional.

```bash
npx vercel login
npm run deploy:vercel
```

Use the same `VITE_FIREBASE_*` environment variables in the Vercel project settings.

### Launch Guide

For the fastest launch path, see `GO_LIVE_OPTION1.md`.

## Firestore Data Model

Primary collections used by the app:

- `catalogPackages`
- `catalogAddons`
- `catalogRentals`
- `pricing/settings`
- `quotes`
- `customerPortalQuotes`
- `userRoles`

The `pricing/settings` document contains configurable quote logic such as:

- mileage pricing
- service fee tiers
- tax regions
- deposit percentage
- staffing rates
- menu sections and menu item pricing
- event templates
- seasonal profiles
- quote meta content
- brand/hero content and brand color palette

## Project Structure

```text
src/
  components/
    AdminCatalogModal.jsx
    LiveBreakdown.jsx
    QuoteCompareModal.jsx
    QuoteHistoryModal.jsx
    ReportingDashboardModal.jsx
    WizardSteps.jsx
  data/
    mockCatalog.js
  hooks/
    useCatalogData.js
  lib/
    firebase.js
    proposalExport.js
    quoteCalculator.js
    quoteStore.js
    recommendations.js
  App.jsx
  main.jsx
  styles.css
```

## Operational Notes

- Firebase Hosting is live at `https://tonicatering.web.app`
- `.env` is ignored and should never be committed
- `.firebase/` is ignored as local CLI state
- Firestore rules enforce authentication, role-gated admin writes, and controlled customer portal status updates

## Roadmap

See `DEV_TASKS.md` for planned enhancements across:

- beauty and branding
- advanced capability
- configurability
- testing and platform quality

Requested operations expansion includes:

- production reporting for planning and post-event review
- QuickBooks integration for accounting sync
- CRM integration for lead/client lifecycle management
- event scheduling and staffing calendar workflows
- booking workflows from quote to confirmation
- a more robust integration and audit foundation

## Status

The application is currently configured for live Firebase hosting and local development, with GitHub deployment history already in place.

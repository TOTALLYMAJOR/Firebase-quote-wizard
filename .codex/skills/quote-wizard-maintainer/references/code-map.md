# Code Map

## App Shell and UI Flow
- `src/App.jsx`: top-level shell and modal orchestration.
- `src/components/WizardSteps.jsx`: quote-builder step flow and main interaction surface.
- `src/components/LiveBreakdown.jsx`: pricing transparency and live totals display.

## Pricing and Persistence
- `src/lib/quoteCalculator.js`: canonical pricing math and totals.
- `src/lib/quoteStore.js`: save/load, lifecycle state transitions, and persistence behavior.
- `src/lib/recommendations.js`: recommendation and upsell logic.

## Firebase and Auth
- `src/lib/firebase.js`: Firebase initialization.
- `src/lib/authClient.js`: client auth helpers.
- `src/hooks/useAuthSession.js`: auth session state handling.
- `src/hooks/useCatalogData.js`: catalog and settings data fetch/write behavior.

## Admin and Operations UI
- `src/components/AdminCatalogModal.jsx`: packages/add-ons/rentals/menu/pricing config.
- `src/components/QuoteHistoryModal.jsx`: historic quote records.
- `src/components/ReportingDashboardModal.jsx`: conversion/pipeline metrics.
- `src/components/EventScheduleModal.jsx`: scheduling and capacity views.
- `src/components/IntegrationOpsModal.jsx`: integration logs and admin ops controls.

## Platform and Deployment
- `firestore.rules`: Firestore access controls.
- `firestore.indexes.json`: query index definitions.
- `firebase.json`: hosting and Firebase deployment config.
- `vercel.json`: optional Vercel deployment config.

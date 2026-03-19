# Feature Matrix

Last updated: March 18, 2026

This matrix maps the master feature checklist to current implementation and source locations.

## Status Legend
- `Implemented`: shipped and wired in the app.
- `Partial`: present but not complete against all desired behaviors.
- `Optional`: optional capability tracked but not required for core flow.

## Master Checklist Mapping

| # | Feature Area | Status | Primary Evidence |
|---|---|---|---|
| 1 | Data + architecture collections/model | Implemented | `firestore.rules`, `src/lib/menuService.js`, `src/data/mockCatalog.js`, `scripts/seed-firestore-menu.mjs` |
| 2 | Dynamic menu system (Firestore + event filtering + grouping + active items) | Implemented | `src/hooks/useCatalogData.js`, `src/lib/menuService.js`, `src/components/WizardSteps.jsx` |
| 3 | Pricing engine (`per_item`, `per_person`, `per_event`) | Implemented | `src/lib/quoteCalculator.js`, `src/components/WizardSteps.jsx`, `src/components/LiveBreakdown.jsx` |
| 4 | 5-step quote builder wizard | Implemented | `src/App.jsx` (`STEP_LABELS` + step rendering), `src/components/WizardSteps.jsx` |
| 5 | Live sticky summary panel with real-time totals | Implemented | `src/components/LiveBreakdown.jsx`, `src/styles.css` (`.breakdown-panel`) |
| 6 | Quote system (create/update, snapshots, statuses) | Implemented | `src/lib/quoteStore.js` (`submitQuote`, `updateQuote`), `src/components/QuoteHistoryModal.jsx` |
| 7 | Quote history + versioning | Implemented | `src/lib/quoteStore.js` (`saveQuoteVersion`, `getQuoteHistory`), `firestore.rules` (`quoteHistory`) |
| 8 | Quote management UI (list, sort, filters, actions) | Implemented | `src/components/QuoteHistoryModal.jsx` |
| 9 | Admin panel tabbed UX + hierarchical menu management | Implemented | `src/components/AdminCatalogModal.jsx`, `src/styles.css` (`.admin-tabs`) |
| 10 | Inline editing with blur/enter persistence | Implemented | `src/components/AdminCatalogModal.jsx` (`handleManagedMenuItemBlur`, `handleManagedMenuItemKeyDown`) |
| 11 | Duplicate quote feature | Implemented | `src/lib/quoteStore.js` (`duplicateQuote`), `src/components/QuoteHistoryModal.jsx` |
| 12 | UX polish (loading/empty/toasts/confirmations) | Implemented | `src/App.jsx` (toast queue), `src/components/QuoteHistoryModal.jsx` (delete confirmation), modal/wizard loading states across components |
| 13 | Global event context across surfaces | Implemented | `src/context/EventTypeContext.jsx`, `src/main.jsx`, `src/App.jsx`, `src/components/AdminCatalogModal.jsx` |
| 14 | Optional: admin role/security/audit logging | Partial / Optional | Role gating via auth/session and rules present: `src/hooks/useAuthSession.js`, `src/components/AuthGate.jsx`, `firestore.rules`; integration audit logs in `src/lib/quoteStore.js` |
| 15 | QA acceptance tests and checks | Implemented (core) | Unit tests under `src/lib/__tests__/`, UI snapshots under `src/components/__tests__/`, scripts in `package.json` |

## Guided Flow (Where It Lives)
- Wizard flow entry and steps: `src/App.jsx`
- Step components: `src/components/WizardSteps.jsx`
- Guided recommendation engine: `src/lib/recommendations.js`
- Guided selling toggle and rules config: `src/components/AdminCatalogModal.jsx`
- Default guided rules and normalization: `src/data/mockCatalog.js`

## Notes
- Non-dev fail-fast catalog behavior is implemented in `src/hooks/useCatalogData.js` and surfaced by blocking UI in `src/App.jsx`.
- Menu backfill for `pricingType` + `active` is implemented in `scripts/seed-firestore-menu.mjs`.

# Multi-Tenant Organization Scoping Plan (Deferred)

Last updated: March 19, 2026  
Status: Parked for return implementation

## Objective
Transform the app from single-tenant to organization-scoped multi-tenant architecture using org subcollections and additive migration.

## Context
The current app uses global Firestore collections and bootstrap-admin assumptions. We need SaaS-ready org isolation without breaking quote/menu workflows.

## Decisions
- Use `organizations/{orgId}` as the tenant root.
- Store business data in org subcollections.
- Keep migration additive first.
- Use server-side or privileged bootstrap for org creation.
- Nest quote versions under each quote.
- Keep legacy fallback only temporarily.

## Target Data Model
```text
organizations/{orgId}
  settings/config
  eventTypes/{eventTypeId}
  menuCategories/{categoryId}
  menuItems/{itemId}
  customers/{customerId}
  quotes/{quoteId}
  quotes/{quoteId}/versions/{versionId}
  catalogPackages/{packageId}
  catalogAddons/{addonId}
  catalogRentals/{rentalId}
```

## File Scope
- `src/lib/organizationService.js`
- `src/context/OrganizationContext.jsx`
- `src/lib/menuService.js`
- `src/lib/quoteStore.js`
- `src/hooks/useCatalogData.js`
- `src/hooks/useAuthSession.js`
- `firestore.rules`
- `firestore.indexes.json`
- `scripts/seed-firestore-menu.mjs`
- `scripts/migrate-to-multi-tenant.mjs`
- `functions/index.js`
- `src/main.jsx`

## Required Changes
- Create `organizations` root collection and org profile schema.
- Add `organizationId` to `userRoles/{uid}`.
- Implement org bootstrap via callable or transaction-safe privileged path.
- Add `OrganizationContext` with org readiness state.
- Refactor menu/catalog reads+writes to org paths.
- Refactor quote/history/version operations to org paths.
- Store quote versions at `quotes/{quoteId}/versions/{versionId}`.
- Update Firestore rules to enforce same-org access.
- Replace generic ownership checks with tokenized or explicitly modeled customer portal access.
- Update seed script to require `--organization <orgId>` and seed org defaults.
- Add migration script to copy legacy global data into a default org.
- Add temporary dual-read fallback behind a feature flag.
- Add only indexes required by org-scoped query paths.
- Update functions to read/write org-scoped collections.

## Constraints
- No breaking change to current quote-creation flow during migration.
- No client-only trust for tenant creation.
- Legacy fallback must be removable.
- Rules must deny cross-org access.
- Emulator and local dev must continue working.

## Verification
- First admin bootstrap creates exactly one org and links the user.
- Org-scoped menu and quote reads/writes work.
- Cross-org reads/writes are denied in emulator tests.
- Seed script populates only the targeted org.
- Legacy data migrates into a default org successfully.
- Quote version history remains attached to the correct parent quote.

## Risk Areas
- Bootstrap race conditions.
- Rules complexity growth.
- Legacy fallback lingering too long.
- Over-indexing before stable query patterns are verified.

## Validation Signals
- Every business record is traceable by org path.
- No component loads catalog/quotes without org context.
- Bootstrap creates exactly one org for initial admin.
- Cross-org denial tests pass before deploy.

## Best-Practice Tips
- Tenant creation is a control-plane action; keep it out of regular client CRUD.
- Use path-based tenancy as source of truth; duplicate `organizationId` only when needed for querying/analytics.

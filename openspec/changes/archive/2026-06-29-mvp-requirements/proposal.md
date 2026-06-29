# Proposal: MVP Requirements

## Intent

Document the existing FinanzasApp as a formal MVP product with complete, verifiable requirements across all six domains — auth, accounts, transactions, dashboard, budgets, and family collaboration — to serve as the single source of truth for future development.

## Scope

### In Scope
- User authentication (register, login, profile) — FE + BE
- Account management (CRUD, balance history) — BE complete, FE partial (list only)
- Transaction management (CRUD, filters, CSV export, sorting) — FE + BE
- Dashboard (balance summary, charts, monthly comparison) — FE + BE (charts wired, monthly comparison BE-only)
- Budget planning (CRUD, spending tracking, copy) — BE only
- Family collaboration (groups, invites, roles) — BE only

### Out of Scope
- Deployment configuration (Docker, CI/CD)
- Automated testing infrastructure
- Guest/offline mode
- Mobile native apps
- Dark mode or theme customization
- CSV import (only export supported)
- Notifications system

## Capabilities

### New Capabilities
- `user-auth`: Registration, login, profile management, JWT session handling
- `account-management`: Account CRUD, balance tracking, balance history
- `transaction-management`: Transaction CRUD, filtering, sorting, CSV export
- `dashboard-analytics`: Balance summary, spending charts, monthly comparison
- `budget-planning`: Budget CRUD, spending tracking against limits, budget copy
- `family-collaboration`: Family group creation, member invites, role management

### Modified Capabilities
None — this is the initial capability baseline for the MVP.

## Approach

SPA frontend (vanilla JS ES modules + Bootstrap 5.3 + Chart.js) consuming a REST API (Express.js ESM + Prisma ORM + PostgreSQL). JWT auth protects all endpoints. The canonical frontend lives in `js/app.js` (ES modules); legacy `app.js` is deprecated. All data flows through the API — no localStorage reads/writes in the canonical version.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `js/app.js` | Canonical FE | Main SPA module |
| `js/auth.js` | Canonical FE | Auth UI + token management |
| `js/api.js` | Canonical FE | API client wrapper |
| `index.html` | Modified | Bootstrap shell, routes both FEs |
| `app.js` | Deprecated | Legacy FE, no new features |
| `styles.css` | Modified | Shared styles |
| `api/src/server.js` | BE | Express app entry point |
| `api/src/routes/` | BE | 6 route modules (auth, accounts, transactions, dashboard, budgets, family) |
| `api/src/middleware/auth.js` | BE | JWT verification middleware |
| `api/src/middleware/errorHandler.js` | BE | Centralized error handling |
| `api/src/validations/schemas.js` | BE | Zod validation schemas |
| `api/src/lib/prisma.js` | BE | Prisma client singleton |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Two FE versions share DOM | High | Mark `app.js` as deprecated, document coexistence risk |
| No automated tests | High | Documented in scope — manual verification required |
| CORS mismatch (FE:3000, BE expects:5173) | Medium | Fix BE CORS config or FE base URL |
| Account balance drift on transfer | Medium | Fix transaction update to recalc both accounts |
| FE ignores backend pagination (limit:100) | Low | Document as deferred optimization |

## Rollback Plan

`git revert` the commit that introduces spec/docs changes. No data migration needed — this is documentation-only.

## Dependencies

- PostgreSQL database with existing schema
- Node.js >=18 for API server
- Existing Prisma schema and seed data

## Success Criteria

- [ ] All 6 capability domains have complete spec files with Given/When/Then scenarios
- [ ] Each spec covers CRUD operations, auth requirements, error states, and edge cases
- [ ] Feature gaps (budgets FE, family FE, account create/edit/delete FE) are explicitly documented
- [ ] Known bugs (balance drift, CORS mismatch) are recorded as known issues

# Design: FinanzasApp MVP — Architecture & Technical Approach

## Technical Approach

Current architecture: SPA frontend consuming REST API. Two frontends coexist — canonical (`js/app.js`, ES modules with `import`) and deprecated (`app.js`, script-global). Both share the same DOM/`index.html` and `styles.css`. The canonical FE fetches from Express API via `fetch()`; the legacy FE is localStorage-only with no API calls.

## Architecture Decisions

### Vanilla JS over framework (FE)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| React/Vue/Svelte | Build step, bundle size, JSX | **Rejected** — zero-build-step CDN delivery preferred |
| Vanilla JS + ES modules | No tooling, direct browser support | **Chosen** — `type="module"` scripts load via CDN |

### Express + Prisma + PostgreSQL (BE)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Express + Prisma | Migration tooling, type-safe queries | **Chosen** — matches existing schema (`api/prisma/schema.prisma`) |
| Fastify/other | Different ecosystem | Rejected — Express is the existing stack |

### JWT with 30-day expiry

| Option | Tradeoff | Decision |
|--------|----------|----------|
| JWT 30d | Long-lived, no refresh rotation | **Chosen** — simple, one token |
| Session-based | Server-side state, DB lookups | Rejected — JWT stateless fits SPA |

### Prisma $transaction for balance ops

Every create/update/delete of a transaction uses `prisma.$transaction` to atomically update the transaction record AND the account balance in the same DB transaction.

### ES modules for FE modularity

`js/app.js` imports from `js/api.js` and `js/auth.js`. Clean separation: auth lifecycle (`auth:ready` event) drives app initialization.

### CSS variables + dark mode toggle

Theming via `:root` CSS variables. Dark mode via `body.dark-mode` class toggle. Chart.js color updates fired manually in the toggle handler.

## Data Flow

```
Browser SPA ──fetch()──→ Express API ──Prisma──→ PostgreSQL
     │                      │
     │  index.html          │   middleware chain:
     │  styles.css           │   helmet → cors → rateLimit → express.json → routes
     │  js/auth.js          │
     │  js/api.js           │   Zod validation on every endpoint
     └── js/app.js          └── errorHandler (Prisma/JWT/ApiError)
```

**Auth flow**: Login → POST /api/auth/login → JWT stored in localStorage → `Authorization: Bearer <token>` on every authenticated request → verify via `authenticate` middleware.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| — | N/A | Documentation-only phase. No code changes. |

## Interfaces / Contracts

### API Route Table

| Method | Endpoint | Auth | Domain |
|--------|----------|------|--------|
| POST | `/api/auth/register` | No | Register |
| POST | `/api/auth/login` | No | Login |
| GET | `/api/auth/me` | Yes | Profile |
| PUT | `/api/auth/profile` | Yes | Update profile |
| GET | `/api/accounts` | Yes | List accounts |
| GET | `/api/accounts/:id` | Yes | Get account |
| POST | `/api/accounts` | Yes | Create account |
| PUT | `/api/accounts/:id` | Yes | Update account |
| DELETE | `/api/accounts/:id` | Yes | Soft-delete account |
| GET | `/api/accounts/:id/balance` | Yes | Balance history |
| GET | `/api/transactions` | Yes | List (paginated, filterable) |
| GET | `/api/transactions/:id` | Yes | Get transaction |
| POST | `/api/transactions` | Yes | Create transaction |
| PUT | `/api/transactions/:id` | Yes | Update transaction |
| DELETE | `/api/transactions/:id` | Yes | Delete transaction |
| POST | `/api/transactions/bulk` | Yes | Bulk create (CSV import) |
| GET | `/api/transactions/export` | Yes | CSV export |
| GET | `/api/budgets` | Yes | List budgets |
| POST | `/api/budgets` | Yes | Create budget |
| PUT | `/api/budgets/:id` | Yes | Update budget |
| DELETE | `/api/budgets/:id` | Yes | Delete budget |
| GET | `/api/budgets/summary` | Yes | Spending vs budget |
| POST | `/api/budgets/copy` | Yes | Copy budgets between months |
| GET | `/api/dashboard/summary` | Yes | Balance summary |
| GET | `/api/dashboard/expenses-by-category` | Yes | Category breakdown |
| GET | `/api/dashboard/daily-balance` | Yes | Balance evolution |
| GET | `/api/dashboard/monthly-comparison` | Yes | Monthly comparison (BE only) |
| POST | `/api/family` | Yes | Create group |
| POST | `/api/family/:id/invite` | Yes | Invite member |
| PUT | `/api/family/:id/members/:memberId/role` | Yes | Change role |
| DELETE | `/api/family/:id/members/:memberId` | Yes | Remove member |
| DELETE | `/api/family/:id` | Yes | Delete group |

## Known Gaps

| # | Gap | Severity | Recommendation |
|---|-----|----------|----------------|
| 1 | Two FEs share DOM — canonical (`js/app.js`) and legacy (`app.js`) both write to same element IDs | **High** | Deprecate `app.js`; remove its `<script>` tag from `index.html` |
| 2 | `API_BASE` hardcoded to `http://localhost:3000` in `js/api.js:2`; BE CORS expects `http://localhost:5173` | **Medium** | Unify via env or relative URL; fix BE `CORS_ORIGIN` or FE origin |
| 3 | Updating a transaction's `accountId` doesn't restore old account balance or adjust the new one (`api/src/routes/transactions.js:168-198`) | **High** | `PUT /transactions/:id` with changed `accountId` must debit old + credit new account inside `$transaction` |
| 4 | Frontend hardcodes `limit: 100` and ignores `pagination` from BE response (`js/app.js:170`) | **Low** | Implement page/chunked loading when dataset grows |
| 5 | Concept/substring filter (`filterConcepto`) reads from DOM but is never sent to API in canonical FE (`js/app.js:179` — omitted from `params`) | **Medium** | Add `search` param to API call, or re-enable client-side filtering from fetched data |
| 6 | Budgets, Family, Account CRUD have **zero** frontend UI — all BE endpoints exist but canonical FE has no forms, lists, or screens | **High** | Build UI for each missing domain; prioritize by user need |

## Testing Strategy

**Gap**: No test infrastructure exists. No test runner, no test files, no CI.

| Layer | Status |
|-------|--------|
| Unit | None |
| Integration | None |
| E2E | None |

Recommendation: introduce Vitest for unit tests (Zod schemas, balance helpers) and Playwright for E2E (happy-path auth + CRUD flows) as a follow-up change.

## Migration / Rollout

**Plan**: Deprecate legacy `app.js` in two steps:
1. **Phase 1** (docs): Mark `app.js` as deprecated in specs and design. Document that both FEs share the same DOM.
2. **Phase 2** (code): Remove the `<script src="app.js"></script>` tag from `index.html`, delete the file, and consolidate any missing features (concept filter) in the canonical FE.

No data migration required — legacy FE uses localStorage only; canonical FE uses API. Users lose localStorage data on migration, which is acceptable for MVP.

## Open Questions

- [ ] Should the monthly comparison dashboard chart be wired in the frontend, or deferred?
- [ ] Is the CORS mismatch blocking current development, or just a config annoyance?

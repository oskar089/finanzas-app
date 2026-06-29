# Tasks: MVP Requirements — Close Gaps Between Specs and Implementation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 900–1200 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | auto-forecast |
| Chain strategy | stacked-to-main |

```
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
```

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Foundation fixes: CORS, concept filter, balance drift, legacy deprecation | PR 1 | Base `main` — all independent fixes |
| 2 | Account CRUD FE UI + pagination UI | PR 2 | Base `main` — depends on PR 1 for `js/` pattern |
| 3 | Budgets FE UI + Family FE UI | PR 3 | Base `main` — large but cleanly separable modules |
| 4 | Monthly comparison chart + test infrastructure | PR 4 | Base `main` — depends on PR 1 for API wiring |

## Phase 1: Foundation Fixes & Deprecation

- [x] 1.1 Fix CORS mismatch: change `API_BASE` in `js/api.js:2` from `http://localhost:3000/api` to `/api` (relative) OR update BE `server.js:35` CORS origin to allow `localhost:3000`
- [x] 1.2 Add `search`/`concept` param to `getTransactions()` in `js/api.js:130-146` and pass `filterConcepto` in `js/app.js:167-179`
- [x] 1.3 Fix balance drift bug in `api/src/routes/transactions.js:155-208` — when `accountId` changes on PUT, restore old account balance and adjust new account inside `$transaction`
- [x] 1.4 Deprecate legacy `app.js`: remove `<script src="app.js">` from `index.html:406-408`, add deprecation notice comment at top of `app.js`

## Phase 2: Missing FE Core — Accounts CRUD + Pagination

- [x] 2.1 Add Account CRUD UI to `index.html`: create/edit/delete forms with name, type, initial balance fields
- [x] 2.2 Add `manageAccounts()` section to `js/app.js` wiring account create, update, delete API calls to the new forms
- [x] 2.3 Replace hardcoded `limit: 100` in `js/app.js:170` with paginated table: use `pagination` from API response, render prev/next controls and page indicator
- [x] 2.4 Add pagination page/limit params to `loadMovimientos()` state and re-fetch on page change

## Phase 3: Missing FE Domains — Budgets + Family

- [x] 3.1 Add Budgets FE sections to `index.html`: budget list card, create/edit form, summary with spent vs budgeted, copy-month button
- [x] 3.2 Create `js/budgets.js` module: `loadBudgets()`, `createBudget()`, `updateBudget()`, `deleteBudget()`, `copyBudgets()`, render budget cards with progress bars
- [x] 3.3 Add Family FE sections to `index.html`: groups list, create-group form, invite-member form, role management dropdown
- [x] 3.4 Create `js/family.js` module: `loadGroups()`, `createGroup()`, `inviteMember()`, `updateRole()`, `removeMember()`, `deleteGroup()`, render group cards with member tables

## Phase 4: Charts Wiring + Test Infrastructure

- [x] 4.1 Add monthly comparison chart section to `index.html` with `<canvas id="chartMensual">` in a card
- [x] 4.2 Wire `getDashboardMonthly()` in `js/app.js`: fetch data on load, render bar chart comparing income/expenses per month
- [x] 4.3 Add dark mode color sync for the new monthly chart in `js/app.js:488-505`
- [x] 4.4 Create FE test setup: `vitest.config.js`, `package.json` test script in project root, base test for `escapeHTML()` and `getCategoriasPorTipo()` (category-by-type validation)
- [x] 4.5 Create BE test setup: `api/vitest.config.js`, `api/src/__tests__/`, test Zod schema validation and balance calculation logic

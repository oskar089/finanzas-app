# Tasks: audit-remediation

## Phase 1: Security Hardening (PR 1/4)

- [x] 1.1 Add `RefreshToken` model to `api/prisma/schema.prisma` with userId, token, expiresAt, index
- [x] 1.2 Add `cookie-parser` dep to `api/package.json`
- [x] 1.3 Configure CSP nonce generation and cookie-parser in `api/src/server.js`
- [x] 1.4 Modify `api/src/middleware/auth.js` to read JWT from HttpOnly cookie (fallback Bearer)
- [x] 1.5 Add `generateRefreshToken()` and `verifyRefresh()` to auth middleware
- [x] 1.6 Add POST `/auth/refresh` rotation endpoint in `api/src/routes/auth.js`
- [x] 1.7 Set HttpOnly cookies on login/register in `api/src/routes/auth.js`
- [x] 1.8 Wrap registration in Prisma `$transaction` in `api/src/routes/auth.js`
- [x] 1.9 Remove `localStorage.setToken()` from `js/api.js`, keep Bearer fallback
- [x] 1.10 Replace hardcoded password in `docker-compose.yml` with `${DB_PASSWORD}`
- [x] 1.11 Test: POST /auth/login sets HttpOnly cookie; /me reads from cookie
- [x] 1.12 Test: Refresh token rotation — old invalidated, new pair issued
- [x] 1.13 Test: Duplicate email — 409, full Prisma $transaction rollback

## Phase 2: Performance (PR 2/4)

- [x] 2.1 Dashboard monthly aggregate with Prisma groupBy (single query, take:5 for recent)
- [x] 2.2 Budget N+1 fix with single GROUP BY

## Phase 3: Bug Fixes (PR 3/4) [COMPLETE]

- [x] 3.1 Normalize decimal separator in filter handlers (comma to dot)
- [x] 3.2 Wrap account soft-delete in Prisma $transaction (race condition fix)
- [x] 3.3 Import escapeHTML, showToast, showConfirm from shared.js in family.js
- [x] 3.4 Remove 3 duplicated utility functions from family.js
- [x] 3.5 Add chart error toast on API failure in actualizarChartMensual
- [x] 3.6 Test: Filter with comma decimal separator normalizes correctly
- [x] 3.7 Test: Soft-delete with concurrent requests — atomic $transaction rollback
- [x] 3.8 Test: Chart error shows toast; family uses shared functions

## Phase 4: UI/Design Polish (PR 4/4)

- [ ] 4.1 CSS transitions, motion reduction, palette, focus indicators
- [ ] 4.2 Replace emoji icons with Bootstrap Icons in index.html

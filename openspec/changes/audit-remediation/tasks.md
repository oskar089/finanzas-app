# Tasks: audit-remediation

## Phase 1: Security Hardening (PR 1/4)

- [x] 1.1 Add `RefreshToken` model to `api/prisma/schema.prisma` with userId, token, expiresAt, index
- [x] 1.2 Add `cookie-parser` dep to `api/package.json`
- [x] 1.3 Configure CSP nonce generation and cookie-parser in `api/src/server.js`
- [x] 1.4 Modify `api/src/middleware/auth.js` to read JWT from HttpOnly cookie (fallback Bearer)
- [x] 1.5 Add `generateRefreshToken()` and `verifyRefresh()` to auth middleware
- [ ] 1.6 Add POST `/auth/refresh` rotation endpoint in `api/src/routes/auth.js`
- [ ] 1.7 Set HttpOnly cookies on login/register in `api/src/routes/auth.js`
- [ ] 1.8 Wrap registration in Prisma `$transaction` in `api/src/routes/auth.js`
- [ ] 1.9 Remove `localStorage.setToken()` from `js/api.js`, keep Bearer fallback
- [ ] 1.10 Replace hardcoded password in `docker-compose.yml` with `${DB_PASSWORD}`
- [ ] 1.11 Test: POST /auth/login sets HttpOnly cookie; /me reads from cookie
- [ ] 1.12 Test: Refresh token rotation — old invalidated, new pair issued
- [ ] 1.13 Test: Duplicate email — 409, full Prisma $transaction rollback

## Phase 2: Performance (PR 2/4)

- [ ] 2.1 Dashboard monthly aggregate with Prisma groupBy
- [ ] 2.2 Budget N+1 fix with single GROUP BY

## Phase 3: Bug Fixes (PR 3/4)

- [ ] 3.1 Account delete race condition with $transaction

## Phase 4: UI/Design Polish (PR 4/4)

- [ ] 4.1 Normalize decimal comma in filter handlers
- [ ] 4.2 Remove duplicated functions from family.js, import from shared.js
- [ ] 4.3 CSS transitions, motion reduction, palette, focus indicators
- [ ] 4.4 Replace emoji icons with Bootstrap Icons in index.html

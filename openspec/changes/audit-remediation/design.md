# Design: Audit Remediation

## Technical Approach

19 findings across 4 categories, delivered in 4 chained PRs against `feat/audit-remediation` feature branch. Security first (breaking), then performance (isolated), bugs (low risk), design (cosmetic). JWT cookie migration uses backward-compatible dual-mode: new clients get HttpOnly cookies, old tokens from `Authorization` header still accepted during transition window.

## Architecture Decisions

### 1. JWT Cookie Migration Strategy

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Dual-mode (cookie + Bearer) | Slightly more code, safe rollout | **Chosen** — avoids forced re-login |
| Cut over immediately | Cleaner code, breaks sessions | Rejected — high blast radius |
| `cookie-parser` | Standard, less setup | **Chosen** — already proposed |

**Migration path**: PR #1 adds cookie-reading in `authenticate` middleware (fallback to Bearer), sets HttpOnly cookie on login/register. Subsequent deploy removes Bearer support.

### 2. Refresh Token Rotation

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Short-lived JWT + opaque refresh token | Revocable, rotate on use | **Chosen** — 15min JWT, 7d refresh |
| Long-lived JWT | Simpler, no revocation | Rejected — can't revoke compromised tokens |
| Store refresh in DB | Revocable, one extra query | **Chosen** — `RefreshToken` model |

### 3. CSP Migration Strategy

`'unsafe-inline'` → nonce-based for scripts, hash-based for inline styles. Generate nonce per request via `res.locals.nonce`. Chart.js and Bootstrap CDN scripts remain in allowlist.

### 4. Dashboard Optimisation

Replace 6-loop sequential query with single `GROUP BY` on `transactions` table. Dashboard main splits into aggregate query (sums, categories) + `take: 5` query (recent transactions).

### 5. Budget N+1 Fix

Replace `Promise.all(budgets.map(...))` with single aggregate query:
```sql
SELECT category, SUM(amount) as spent
FROM transactions
WHERE userId = ? AND type = 'EXPENSE'
  AND date >= ? AND date < ?
GROUP BY category
```
Join via JS map in Node.

## Data Flow

### JWT Cookie Exchange (PR #1)

```
Browser                      Express Server
  │                              │
  │  POST /auth/login            │
  │─────────────────────────────>│
  │                              ├─ verify credentials
  │                              ├─ generate JWT (15min)
  │                              ├─ generate refresh token (7d)
  │                              ├─ store refresh in DB
  │  Set-Cookie: jwt=...; HttpOnly; Secure; SameSite=Strict
  │  Set-Cookie: refresh=...; HttpOnly; Secure; Path=/auth/refresh
  │  JSON: { user, accessToken }  (backward compat)
  │<─────────────────────────────│
  │                              │
  │  GET /api/dashboard          │
  │  Cookie: jwt=...             │
  │─────────────────────────────>│
  │                              ├─ authenticate reads cookie
  │                              ├─ verify JWT
  │                              ├─ attach req.user
  │  JSON response               │
  │<─────────────────────────────│
```

### Refresh Rotation

```
  401 → /auth/refresh with refresh_token cookie
  → verify in DB → rotate (delete old, create new)
  → Set-Cookie: new jwt + new refresh
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `api/prisma/schema.prisma` | Modify | Add `RefreshToken` model |
| `api/package.json` | Modify | Add `cookie-parser` |
| `api/src/server.js` | Modify | CSP nonce, cookie-parser middleware |
| `api/src/middleware/auth.js` | Modify | Cookie reading, generateRefreshToken, verifyRefresh |
| `api/src/routes/auth.js` | Modify | Set-Cookie on login/register, `/auth/refresh` route |
| `api/src/routes/dashboard.js` | Modify | GROUP BY monthly, aggregate + take:5 main |
| `api/src/routes/budgets.js` | Modify | Single GROUP BY for spending |
| `api/src/routes/accounts.js` | Modify | $transaction wrapping soft-delete |
| `js/api.js` | Modify | Remove localStorage setToken, keep Bearer fallback |
| `js/app.js` | Modify | Normalize decimal in filter handlers (`.replace(",", ".")`) |
| `js/family.js` | Modify | Import from `shared.js`, remove 3 duplicated functions |
| `styles.css` | Modify | 7 CSS changes (transitions, motion, palette, icons, focus) |
| `index.html` | Modify | Replace remaining emojis with Bootstrap Icons |
| `docker-compose.yml` | Modify | Password via `${DB_PASSWORD}` env var |

## Interfaces / Contracts

```prisma
model RefreshToken {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  token     String   @unique
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([userId])
  @@map("refresh_tokens")
}
```

```http
Set-Cookie: jwt=<access_token>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=900
Set-Cookie: refresh=<refresh_token>; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=604800
```

**CSP nonce flow**: `res.locals.nonce = crypto.randomBytes(16).toString('hex')` in middleware → `'nonce-${nonce}'` in directives.

**Dashboard monthly aggregate**: Single query using Prisma `groupBy` on `Transaction` with `_sum(amount)` partitioned by month/year, filtered by userId.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | JWT cookie read in middleware | Mock req.headers.cookie, assert req.user set |
| Unit | Refresh token rotation | Create → verify → rotate → old invalid |
| Integration | Dashboard monthly perf | Time 6-loop vs GROUP BY (same response shape) |
| Integration | Account delete race | Concurrent requests to same account |
| E2E | Login → cookie set → /me works | Full browser flow |
| E2E | Filter with decimal comma | Set `filterMontoMin=1,5` → assert query parameter normalization |

## Migration / Rollout

1. **PR #1 (Security)**: Deploy cookie dual-mode. Existing sessions still work via Bearer. New logins get cookies. Monitor for 1 release cycle.
2. **PR #2-4**: No migration — purely internal refactors and CSS changes.
3. **Future**: Remove Bearer fallback from middleware (separate change).

## Open Questions

- [ ] Nonce injection for inline `<script>` tags in `index.html` — need to pass nonce to template or inline script.
- [ ] CSP hash for inline styles (Chart.js dynamic styles) — may need `'unsafe-inline'` for styleSrc during transition.

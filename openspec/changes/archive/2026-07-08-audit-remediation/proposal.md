# Proposal: Audit Remediation

## Intent

Remediate 19 findings from a comprehensive code audit: security vulnerabilities (XSS-vulnerable JWT storage, weak CSP, hardcoded credentials), production bugs (decimal separator, N+1 queries, race condition), and design system debt (CSS anti-patterns, accessibility gaps, emoji UI).

## Scope

### In Scope
- **Security**: JWT→HttpOnly cookie + refresh token, strict CSP, docker creds via `.env`, registration in Prisma `$transaction`
- **Bugs**: Decimal separator in filters, deduplicate `family.js` helpers, chart error→user toast
- **Performance**: Dashboard monthly GROUP BY (6→1 query), budget eager aggregate (N+1→1), `findMany`→`take:5`
- **Design**: Specific CSS transitions, `prefers-reduced-motion`, gradient palette, gradient text a11y, semantic side-stripe, emojis→SVG, focus-visible outline

### Out of Scope
- New features, CSS framework migration, test infrastructure

## Capabilities

### New Capabilities
None — remediation only.

### Modified Capabilities
- `user-auth`: JWT delivery from response body to HttpOnly cookie; refresh token rotation; registration seed in `$transaction`

## Approach

4 chained PRs against feature branch `feat/audit-remediation`:

1. **Security** — cookie middleware, CSP headers, docker secrets, refresh token
2. **Performance** — GROUP BY monthly, budget eager aggregation, `take:5`
3. **Bugs** — decimal parsing, `$transaction` soft-delete, deduplicate, chart toast
4. **Design** — CSS specificity, prefers-reduced-motion, SVG icons, palette, outline offset

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `api/server.js` | Modified | CSP headers, cookie parser |
| `api/routes/auth.js` | Modified | Cookie JWT, refresh token, `$transaction` |
| `api/routes/dashboard.js` | Modified | GROUP BY, `take:5`, error toast |
| `api/routes/budgets.js` | Modified | Eager aggregate |
| `api/routes/accounts.js` | Modified | `$transaction` soft-delete |
| `js/api.js` | Modified | Remove localStorage JWT |
| `js/transactions.js` | Modified | Decimal in filters |
| `js/family.js` | Modified | Deduplicate helpers |
| `css/style.css` | Modified | Transitions, motion, SVG, palette |
| `docker-compose.yml` | Modified | Secrets via `.env` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| JWT cookie breaks sessions | Med | Backward-compat header fallback first |
| CSP breaks inline handlers | Low | Audit before deploy |
| Design PR diff noise | Med | Separate PR keeps review focused |

## Rollback Plan

Rollback per chained PR: revert its commit and re-deploy. Feature branch stays gated until all 4 PRs verified.

## Dependencies

- `cookie-parser` npm package

## Success Criteria

- [ ] JWT stored in HttpOnly cookie; localStorage JWT removed
- [ ] CSP scan clean; docker creds from `.env`
- [ ] Registration seed in Prisma `$transaction`
- [ ] Decimal amounts work from all frontend inputs
- [ ] Dashboard monthly: 1 query instead of 6
- [ ] Budget summary: 1 query instead of N+1
- [ ] Account soft-delete race-condition-free
- [ ] `family.js` no longer duplicates shared helpers
- [ ] Charts show toast on failure
- [ ] `transition: all` eliminated from CSS
- [ ] `prefers-reduced-motion: reduce` respected
- [ ] Emoji UI replaced with SVG icons

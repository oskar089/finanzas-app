# Code Review Rules — FinanzasApp

## HTML
- Semantic HTML5 (`<main>`, `<section>`, `<article>`, `<nav>`)
- Bootstrap 5.3 classes (form-control, form-select, btn, etc.)
- Labels for all inputs — every `<input>` must have an associated `<label>`
- ARIA attributes on interactive elements where Bootstrap semantics don't cover it

## CSS
- No `!important` unless absolutely necessary (document why in a comment)
- CSS custom properties for colors, spacing, typography
- Mobile-first responsive approach
- Bootstrap utilities preferred over custom CSS

## JavaScript
- `const`/`let`, never `var`
- Arrow functions for callbacks
- Immutable patterns: spread, map, filter, reduce
- Input validation before processing (Zod on backend, HTML5 + manual on frontend)
- No `eval()`, no `innerHTML` with user input

## Backend (Express + Prisma)
- Zod schemas for all request validation
- Prisma for all DB access — no raw SQL
- JWT auth middleware on protected routes
- Error responses: consistent `{ error: string }` shape
- Passport.js strategies for OAuth

## Testing
- Vitest for backend tests
- Test behavior, not implementation
- Mock external services (OAuth providers) in integration tests

## Security
- Never hardcode secrets, tokens, or credentials
- Environment variables for all configuration
- HTTPS in production
- Rate limiting on auth endpoints

## Git
- Conventional commits: `feat:`, `fix:`, `refactor:`, `chore:`, `test:`
- No AI attribution in commits

## Comments
- WHY, not WHAT
- Document business rules (budget periods, family role permissions)
- Never comment obvious code

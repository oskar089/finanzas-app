# Finanzas App

Personal finance management application — track transactions, manage budgets, and collaborate with family members.

## Features

- **Multi-user auth**: Email/password, Google OAuth, and Apple Sign In
- **Accounts**: Checking, savings, credit card, and cash management
- **Transactions**: Full CRUD with filters, pagination, categories, and bulk import
- **Budgets**: Monthly budgets with spending tracking per category
- **Dashboard**: Financial overview with summaries
- **Family collaboration**: Multi-user groups with admin/member/viewer roles

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS, HTML5, CSS3 |
| Backend | Node.js, Express.js |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | JWT, Passport.js (Google OAuth 2.0, Apple Sign In) |
| Validation | Zod |
| Testing | Vitest |
| Infrastructure | Docker Compose |

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL (or Docker)

### Setup

```bash
# Clone and install
git clone https://github.com/oskar089/finanzas-app.git
cd finanzas-app

# Backend setup
cd api
npm install
cp .env.example .env   # edit with your credentials
npx prisma generate
npx prisma db push
npx prisma db seed
npm run dev             # starts on :3000
```

Open `http://localhost:3000` in your browser.

### Docker (database only)

```bash
docker compose up -d
```

Runs PostgreSQL on `:5432` and pgAdmin on `:5050`.

### Testing

```bash
cd api && npm test       # backend tests (Vitest)
```

## Project Structure

```
finanzas-app/
├── api/                  # Express.js backend
│   ├── prisma/           # Schema + migrations
│   ├── src/
│   │   ├── config/       # Passport strategies
│   │   ├── routes/       # Express route handlers
│   │   ├── middleware/    # Auth, validation
│   │   └── validations/  # Zod schemas
│   └── __tests__/
├── auth/                 # OAuth callback page
├── js/                   # Frontend app (SPA)
├── index.html            # Main entry point
├── styles.css
└── docker-compose.yml
```

## Environment Variables

Key variables (see `api/.env.example` for full list):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for JWT signing |
| `JWT_EXPIRES_IN` | Token expiry (default: 30d) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `APPLE_CLIENT_ID` | Apple Sign In service ID |
| `APPLE_TEAM_ID` | Apple Developer team ID |
| `APPLE_KEY_ID` | Apple private key ID |
| `APPLE_PRIVATE_KEY` | Apple private key (PKCS#8) |
| `FRONTEND_URL` | Frontend origin for CORS |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user profile |
| GET | `/api/auth/google` | Google OAuth login |
| GET | `/api/auth/apple` | Apple Sign In login |
| GET/POST/PUT/DELETE | `/api/accounts` | Account CRUD |
| GET/POST/PUT/DELETE | `/api/transactions` | Transaction CRUD |
| GET/POST/PUT/DELETE | `/api/budgets` | Budget CRUD |
| GET | `/api/dashboard` | Dashboard data |
| GET/POST/DELETE | `/api/family` | Family groups |

## License

MIT

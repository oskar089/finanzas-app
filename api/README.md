# FinanceApp API

Backend API for FinanceApp - Personal finance management application.

## 🚀 Features

- **Authentication**: JWT-based auth with register/login
- **Accounts**: Bank account management (checking, savings, credit card, cash)
- **Transactions**: Full CRUD with filtering, pagination, and bulk import
- **Budgets**: Monthly budget management with spending tracking
- **Dashboard**: Financial overview with charts and summaries
- **Family**: Multi-user collaboration with roles (admin/member/viewer)

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Validation**: Zod
- **Auth**: JWT + bcryptjs
- **Security**: Helmet, CORS, Rate Limiting

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/oskar089/login-page-fase1.git
cd login-page-fase1/api

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database with demo data
npm run db:seed

# Start development server
npm run dev
```

## 🗄️ Database Schema

### Users
- `id` (UUID)
- `email` (unique)
- `password` (hashed)
- `name`
- `avatarUrl` (optional)
- `defaultCurrency` (default: USD)

### Accounts
- `id` (UUID)
- `userId` (FK → Users)
- `name`
- `type` (CHECKING, SAVINGS, CREDIT_CARD, CASH)
- `balance`
- `currency`
- `isActive`

### Transactions
- `id` (UUID)
- `accountId` (FK → Accounts)
- `userId` (FK → Users)
- `amount`
- `type` (INCOME, EXPENSE, TRANSFER)
- `category`
- `description`
- `notes` (optional)
- `date`

### Budgets
- `id` (UUID)
- `userId` (FK → Users)
- `category`
- `amount`
- `month`
- `year`
- Unique constraint: [userId, category, month, year]

### Family Groups
- `id` (UUID)
- `name`
- `adminId` (FK → Users)

### Family Members
- `id` (UUID)
- `familyId` (FK → FamilyGroups)
- `userId` (FK → Users)
- `role` (ADMIN, MEMBER, VIEWER)

## 🔐 Authentication

All API endpoints (except `/health` and `/api/auth/*`) require a Bearer token:

```
Authorization: Bearer <your-jwt-token>
```

### Demo Credentials
- **Email**: demo@financeapp.com
- **Password**: Password123

## 📡 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/profile` | Update profile |

### Accounts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/accounts` | List all accounts |
| GET | `/api/accounts/:id` | Get account by ID |
| POST | `/api/accounts` | Create account |
| PUT | `/api/accounts/:id` | Update account |
| DELETE | `/api/accounts/:id` | Delete account |
| GET | `/api/accounts/:id/balance` | Get balance history |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions` | List transactions (with filters) |
| GET | `/api/transactions/:id` | Get transaction by ID |
| POST | `/api/transactions` | Create transaction |
| PUT | `/api/transactions/:id` | Update transaction |
| DELETE | `/api/transactions/:id` | Delete transaction |
| POST | `/api/transactions/bulk` | Bulk create transactions |

### Budgets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/budgets` | List budgets |
| GET | `/api/budgets/summary` | Get current month summary |
| GET | `/api/budgets/:id` | Get budget by ID |
| POST | `/api/budgets` | Create budget |
| PUT | `/api/budgets/:id` | Update budget |
| DELETE | `/api/budgets/:id` | Delete budget |
| POST | `/api/budgets/copy` | Copy budgets between months |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Get dashboard data |
| GET | `/api/dashboard/monthly` | Get monthly comparison |

### Family
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/family` | List family groups |
| POST | `/api/family` | Create family group |
| POST | `/api/family/:id/invite` | Invite member |
| DELETE | `/api/family/:id/members/:memberId` | Remove member |
| PUT | `/api/family/:id/members/:memberId/role` | Update member role |
| DELETE | `/api/family/:id` | Delete family group |

## 📝 Transaction Query Parameters

```
GET /api/transactions?
  page=1
  &limit=20
  &type=EXPENSE
  &category=alimentacion
  &accountId=uuid
  &startDate=2026-01-01T00:00:00Z
  &endDate=2026-12-31T23:59:59Z
  &minAmount=10
  &maxAmount=100
  &sortBy=date
  &sortOrder=desc
```

## 🔒 Security Features

- Password hashing with bcrypt (12 rounds)
- JWT expiration (30 days)
- Rate limiting (100 req/15min general, 20 req/15min for auth)
- CORS configuration
- Helmet security headers
- Input validation with Zod
- SQL injection prevention (Prisma ORM)

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

## 📊 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_SECRET` | Secret key for JWT signing | - |
| `JWT_EXPIRES_IN` | Token expiration time | 30d |
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment | development |
| `CORS_ORIGIN` | Allowed origin | http://localhost:5173 |

## 🚀 Deployment

### Docker
```bash
docker-compose up -d
```

### Manual
```bash
# Build
npm run build

# Start
npm start
```

## 📚 Documentation

- [API Documentation](./docs/API.md)
- [Database Schema](./prisma/schema.prisma)
- [Environment Setup](./.env.example)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

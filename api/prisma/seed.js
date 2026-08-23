import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Every helper below is find-or-create keyed on a stable attribute so the
// seed can re-run (CI, onboarding refreshes) without duplicating demo data
// or dying on unique constraints.

async function ensureUser() {
  const hashedPassword = await bcrypt.hash("Password123", 12);

  return prisma.user.upsert({
    where: { email: "demo@financeapp.com" },
    update: {},
    create: {
      email: "demo@financeapp.com",
      password: hashedPassword,
      name: "Demo User",
      defaultCurrency: "USD",
    },
  });
}

// Account has no natural unique constraint; userId+name is stable enough
// for demo data and keeps re-runs from stacking duplicate accounts.
async function ensureAccount(userId, name, data) {
  const existing = await prisma.account.findFirst({
    where: { userId, name },
  });
  if (existing) return existing;
  return prisma.account.create({ data: { userId, name, ...data } });
}

async function ensureTransaction(data) {
  const existing = await prisma.transaction.findFirst({
    where: {
      accountId: data.accountId,
      description: data.description,
      date: data.date,
    },
  });
  if (existing) return existing;
  return prisma.transaction.create({ data });
}

async function ensureBudget(userId, data) {
  return prisma.budget.upsert({
    where: {
      userId_category_month_year: {
        userId,
        category: data.category,
        month: data.month,
        year: data.year,
      },
    },
    update: {},
    create: { ...data, userId },
  });
}

async function ensureFamilyGroup(userId, name) {
  const existing = await prisma.familyGroup.findFirst({
    where: { adminId: userId, name },
  });
  if (existing) return existing;
  return prisma.familyGroup.create({
    data: {
      name,
      adminId: userId,
      members: {
        create: {
          userId,
          role: "ADMIN",
        },
      },
    },
  });
}

async function main() {
  console.log("🌱 Seeding database...");

  const user = await ensureUser();
  console.log("✅ Demo user ready:", user.email);

  const checkingAccount = await ensureAccount(user.id, "Main Checking", {
    type: "CHECKING",
    balance: 2500.0,
    currency: "USD",
  });

  const savingsAccount = await ensureAccount(user.id, "Savings Account", {
    type: "SAVINGS",
    balance: 10000.0,
    currency: "USD",
  });

  const creditCard = await ensureAccount(user.id, "Credit Card", {
    type: "CREDIT_CARD",
    balance: -450.0,
    currency: "USD",
  });

  console.log("✅ Demo accounts ready");

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const transactions = [
    {
      accountId: checkingAccount.id,
      userId: user.id,
      amount: 3500.0,
      type: "INCOME",
      category: "sueldo",
      description: "Monthly salary",
      date: new Date(currentYear, currentMonth, 1),
    },
    {
      accountId: checkingAccount.id,
      userId: user.id,
      amount: 850.0,
      type: "EXPENSE",
      category: "housing",
      description: "Rent payment",
      date: new Date(currentYear, currentMonth, 5),
    },
    {
      accountId: checkingAccount.id,
      userId: user.id,
      amount: 120.0,
      type: "EXPENSE",
      category: "utilities",
      description: "Electricity bill",
      date: new Date(currentYear, currentMonth, 10),
    },
    {
      accountId: checkingAccount.id,
      userId: user.id,
      amount: 350.0,
      type: "EXPENSE",
      category: "alimentacion",
      description: "Groceries",
      date: new Date(currentYear, currentMonth, 12),
    },
    {
      accountId: checkingAccount.id,
      userId: user.id,
      amount: 60.0,
      type: "EXPENSE",
      category: "transporte",
      description: "Gas",
      date: new Date(currentYear, currentMonth, 15),
    },
    {
      accountId: checkingAccount.id,
      userId: user.id,
      amount: 500.0,
      type: "INCOME",
      category: "freelance",
      description: "Freelance project",
      date: new Date(currentYear, currentMonth, 18),
    },
    {
      accountId: creditCard.id,
      userId: user.id,
      amount: 150.0,
      type: "EXPENSE",
      category: "entretenimiento",
      description: "Concert tickets",
      date: new Date(currentYear, currentMonth, 20),
    },
    {
      accountId: creditCard.id,
      userId: user.id,
      amount: 80.0,
      type: "EXPENSE",
      category: "salud",
      description: "Pharmacy",
      date: new Date(currentYear, currentMonth, 22),
    },
  ];

  for (const t of transactions) {
    await ensureTransaction(t);
  }

  console.log("✅ Demo transactions ready");

  const budgets = [
    {
      category: "housing",
      amount: 900.0,
      month: currentMonth + 1,
      year: currentYear,
    },
    {
      category: "alimentacion",
      amount: 500.0,
      month: currentMonth + 1,
      year: currentYear,
    },
    {
      category: "transporte",
      amount: 150.0,
      month: currentMonth + 1,
      year: currentYear,
    },
    {
      category: "utilities",
      amount: 200.0,
      month: currentMonth + 1,
      year: currentYear,
    },
    {
      category: "entretenimiento",
      amount: 100.0,
      month: currentMonth + 1,
      year: currentYear,
    },
  ];

  for (const b of budgets) {
    await ensureBudget(user.id, b);
  }

  console.log("✅ Demo budgets ready");

  const family = await ensureFamilyGroup(user.id, "Smith Family");

  console.log("✅ Demo family group ready:", family.name);

  console.log("\n🎉 Seed completed!");
  console.log("\n📋 Demo credentials:");
  console.log("   Email: demo@financeapp.com");
  console.log("   Password: Password123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

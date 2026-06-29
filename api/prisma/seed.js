import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create demo user
  const hashedPassword = await bcrypt.hash("Password123", 12);

  const user = await prisma.user.upsert({
    where: { email: "demo@financeapp.com" },
    update: {},
    create: {
      email: "demo@financeapp.com",
      password: hashedPassword,
      name: "Demo User",
      defaultCurrency: "USD",
    },
  });

  console.log("✅ Created demo user:", user.email);

  // Create demo accounts
  const checkingAccount = await prisma.account.create({
    data: {
      userId: user.id,
      name: "Main Checking",
      type: "CHECKING",
      balance: 2500.0,
      currency: "USD",
    },
  });

  const savingsAccount = await prisma.account.create({
    data: {
      userId: user.id,
      name: "Savings Account",
      type: "SAVINGS",
      balance: 10000.0,
      currency: "USD",
    },
  });

  const creditCard = await prisma.account.create({
    data: {
      userId: user.id,
      name: "Credit Card",
      type: "CREDIT_CARD",
      balance: -450.0,
      currency: "USD",
    },
  });

  console.log("✅ Created demo accounts");

  // Create demo transactions
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
    await prisma.transaction.create({ data: t });
  }

  console.log("✅ Created demo transactions");

  // Create demo budgets
  const budgets = [
    {
      userId: user.id,
      category: "housing",
      amount: 900.0,
      month: currentMonth + 1,
      year: currentYear,
    },
    {
      userId: user.id,
      category: "alimentacion",
      amount: 500.0,
      month: currentMonth + 1,
      year: currentYear,
    },
    {
      userId: user.id,
      category: "transporte",
      amount: 150.0,
      month: currentMonth + 1,
      year: currentYear,
    },
    {
      userId: user.id,
      category: "utilities",
      amount: 200.0,
      month: currentMonth + 1,
      year: currentYear,
    },
    {
      userId: user.id,
      category: "entretenimiento",
      amount: 100.0,
      month: currentMonth + 1,
      year: currentYear,
    },
  ];

  for (const b of budgets) {
    await prisma.budget.create({ data: b });
  }

  console.log("✅ Created demo budgets");

  // Create demo family group
  const family = await prisma.familyGroup.create({
    data: {
      name: "Smith Family",
      adminId: user.id,
      members: {
        create: {
          userId: user.id,
          role: "ADMIN",
        },
      },
    },
  });

  console.log("✅ Created demo family group:", family.name);

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

import { Router } from "express";
import prisma from "../lib/prisma.js";
import { dashboardQuerySchema } from "../validations/schemas.js";

const router = Router();

/**
 * GET /api/dashboard
 * Get dashboard data for current user
 */
router.get("/", async (req, res, next) => {
  try {
    const query = dashboardQuerySchema.parse(req.query);

    // Default to current month if no dates provided
    const now = new Date();
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = query.endDate ? new Date(query.endDate) : now;

    // Get all accounts balance
    const accounts = await prisma.account.findMany({
      where: { userId: req.user.id, isActive: true },
      select: {
        id: true,
        name: true,
        type: true,
        balance: true,
        currency: true,
      },
    });

    const totalBalance = accounts.reduce(
      (sum, acc) => sum + Number(acc.balance),
      0
    );

    // Get transactions for the period (aggregate data)
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: req.user.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        account: {
          select: {
            name: true,
            type: true,
          },
        },
      },
    });

    // Calculate income and expenses
    const income = transactions
      .filter((t) => t.type === "INCOME")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const expenses = transactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const netIncome = income - expenses;

    // Group expenses by category
    const expensesByCategory = transactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
        return acc;
      }, {});

    // Group income by category
    const incomeByCategory = transactions
      .filter((t) => t.type === "INCOME")
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
        return acc;
      }, {});

    // Get daily balance evolution
    const dailyBalance = transactions
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .reduce((acc, t) => {
        const date = t.date.toISOString().split("T")[0];
        const delta =
          t.type === "INCOME"
            ? Number(t.amount)
            : t.type === "TRANSFER"
              ? 0
              : -Number(t.amount);

        const lastBalance =
          acc.length > 0 ? acc[acc.length - 1].balance : totalBalance - netIncome;

        acc.push({
          date,
          balance: lastBalance + delta,
        });

        return acc;
      }, []);

    // Get recent transactions (last 5) — separate take:5 query
    const recentTransactions = await prisma.transaction.findMany({
      where: {
        userId: req.user.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: "desc" },
      take: 5,
      include: {
        account: {
          select: {
            name: true,
            type: true,
          },
        },
      },
    });

    // Get budget status for current month
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const budgets = await prisma.budget.findMany({
      where: {
        userId: req.user.id,
        month: currentMonth,
        year: currentYear,
      },
    });

    // Single GROUP BY for budget spending
    const budgetCategoryIds = budgets.map((b) => b.category);
    const spendingByCategory =
      budgetCategoryIds.length > 0
        ? await prisma.transaction.groupBy({
            by: ["category"],
            where: {
              userId: req.user.id,
              type: "EXPENSE",
              category: { in: budgetCategoryIds },
              date: {
                gte: new Date(currentYear, currentMonth - 1, 1),
                lt: new Date(currentYear, currentMonth, 1),
              },
            },
            _sum: { amount: true },
          })
        : [];

    // Merge spending into budgets
    const spendingMap = new Map(
      spendingByCategory.map((s) => [s.category, Number(s._sum.amount || 0)])
    );

    const budgetStatus = budgets.map((budget) => {
      const spent = spendingMap.get(budget.category) ?? 0;
      const budgetAmount = Number(budget.amount);

      return {
        category: budget.category,
        budget: budgetAmount,
        spent,
        remaining: budgetAmount - spent,
        percentage:
          budgetAmount > 0
            ? Math.round((spent / budgetAmount) * 100 * 100) / 100
            : 0,
      };
    });

    res.json({
      summary: {
        totalBalance,
        income,
        expenses,
        netIncome,
        transactionCount: transactions.length,
      },
      accounts,
      recentTransactions,
      charts: {
        expensesByCategory,
        incomeByCategory,
        dailyBalance,
      },
      budgetStatus,
      period: {
        startDate,
        endDate,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/dashboard/monthly
 * Get monthly comparison data
 */
router.get("/monthly", async (req, res, next) => {
  try {
    const { months: monthsParam = 6 } = req.query;
    const monthCount = parseInt(monthsParam, 10);
    const now = new Date();

    // Build the list of expected months (for padding empty ones)
    const expectedMonths = [];
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      expectedMonths.push({ month: d.getMonth() + 1, year: d.getFullYear() });
    }

    // Single query: fetch all transactions in the 6-month window
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - monthCount + 1, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: req.user.id,
        date: {
          gte: sixMonthsAgo,
          lte: endDate,
        },
      },
    });

    // Group by year+month in JS
    const grouped = new Map();
    for (const t of transactions) {
      const key = `${t.date.getFullYear()}-${t.date.getMonth() + 1}`;
      if (!grouped.has(key)) {
        grouped.set(key, { income: 0, expenses: 0, transactionCount: 0 });
      }
      const entry = grouped.get(key);
      if (t.type === "INCOME") {
        entry.income += Number(t.amount);
      } else if (t.type === "EXPENSE") {
        entry.expenses += Number(t.amount);
      }
      entry.transactionCount++;
    }

    // Build response — one entry per expected month, pad with zeros
    const monthlyData = expectedMonths.map(({ month, year }) => {
      const key = `${year}-${month}`;
      const data = grouped.get(key) ?? {
        income: 0,
        expenses: 0,
        transactionCount: 0,
      };
      return {
        month,
        year,
        income: data.income,
        expenses: data.expenses,
        net: data.income - data.expenses,
        transactionCount: data.transactionCount,
      };
    });

    res.json({ monthlyData });
  } catch (error) {
    next(error);
  }
});

export default router;

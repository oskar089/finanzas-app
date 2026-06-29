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

    // Get transactions for the period
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: req.user.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: "desc" },
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
          t.type === "INCOME" ? Number(t.amount) : -Number(t.amount);

        const lastBalance =
          acc.length > 0 ? acc[acc.length - 1].balance : totalBalance - netIncome;

        acc.push({
          date,
          balance: lastBalance + delta,
        });

        return acc;
      }, []);

    // Get recent transactions (last 5)
    const recentTransactions = transactions.slice(0, 5);

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

    const budgetStatus = await Promise.all(
      budgets.map(async (budget) => {
        const spending = await prisma.transaction.aggregate({
          where: {
            userId: req.user.id,
            type: "EXPENSE",
            category: budget.category,
            date: {
              gte: new Date(currentYear, currentMonth - 1, 1),
              lt: new Date(currentYear, currentMonth, 1),
            },
          },
          _sum: { amount: true },
        });

        const spent = Number(spending._sum.amount || 0);
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
      })
    );

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
    const { months = 6 } = req.query;
    const now = new Date();

    const monthlyData = [];

    for (let i = 0; i < months; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const transactions = await prisma.transaction.findMany({
        where: {
          userId: req.user.id,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      const income = transactions
        .filter((t) => t.type === "INCOME")
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const expenses = transactions
        .filter((t) => t.type === "EXPENSE")
        .reduce((sum, t) => sum + Number(t.amount), 0);

      monthlyData.unshift({
        month,
        year,
        income,
        expenses,
        net: income - expenses,
        transactionCount: transactions.length,
      });
    }

    res.json({ monthlyData });
  } catch (error) {
    next(error);
  }
});

export default router;

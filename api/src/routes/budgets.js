import { Router } from "express";
import prisma from "../lib/prisma.js";
import {
  createBudgetSchema,
  updateBudgetSchema,
} from "../validations/schemas.js";
import { ApiError } from "../middleware/errorHandler.js";

const router = Router();

/**
 * GET /api/budgets
 * Get all budgets for current user (optionally filter by month/year)
 */
router.get("/", async (req, res, next) => {
  try {
    const { month, year } = req.query;

    const where = {
      userId: req.user.id,
      ...(month && { month: parseInt(month) }),
      ...(year && { year: parseInt(year) }),
    };

    const budgets = await prisma.budget.findMany({
      where,
      orderBy: [{ year: "desc" }, { month: "desc" }, { category: "asc" }],
    });

    // Get spending for each budget
    const budgetsWithSpending = await Promise.all(
      budgets.map(async (budget) => {
        // Get total spending for this category in this month
        const spending = await prisma.transaction.aggregate({
          where: {
            userId: req.user.id,
            type: "EXPENSE",
            category: budget.category,
            date: {
              gte: new Date(budget.year, budget.month - 1, 1),
              lt: new Date(budget.year, budget.month, 1),
            },
          },
          _sum: { amount: true },
        });

        const spent = Number(spending._sum.amount || 0);
        const budgetAmount = Number(budget.amount);
        const remaining = budgetAmount - spent;
        const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;

        return {
          ...budget,
          spent,
          remaining,
          percentage: Math.round(percentage * 100) / 100,
          isOverBudget: spent > budgetAmount,
          isWarning: percentage >= 80 && percentage < 100,
        };
      })
    );

    res.json({ budgets: budgetsWithSpending });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/budgets/summary
 * Get budget summary for current month
 */
router.get("/summary", async (req, res, next) => {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const budgets = await prisma.budget.findMany({
      where: {
        userId: req.user.id,
        month: currentMonth,
        year: currentYear,
      },
    });

    // Get total budget and spending
    const totalBudget = budgets.reduce(
      (sum, b) => sum + Number(b.amount),
      0
    );

    const spending = await prisma.transaction.aggregate({
      where: {
        userId: req.user.id,
        type: "EXPENSE",
        date: {
          gte: new Date(currentYear, currentMonth - 1, 1),
          lt: new Date(currentYear, currentMonth, 1),
        },
      },
      _sum: { amount: true },
    });

    const totalSpent = Number(spending._sum.amount || 0);
    const remaining = totalBudget - totalSpent;
    const percentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    res.json({
      summary: {
        totalBudget,
        totalSpent,
        remaining,
        percentage: Math.round(percentage * 100) / 100,
        isOverBudget: totalSpent > totalBudget,
        isWarning: percentage >= 80 && percentage < 100,
      },
      month: currentMonth,
      year: currentYear,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/budgets/:id
 * Get budget by ID
 */
router.get("/:id", async (req, res, next) => {
  try {
    const budget = await prisma.budget.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!budget) {
      throw new ApiError(404, "Budget not found");
    }

    // Get spending for this budget
    const spending = await prisma.transaction.aggregate({
      where: {
        userId: req.user.id,
        type: "EXPENSE",
        category: budget.category,
        date: {
          gte: new Date(budget.year, budget.month - 1, 1),
          lt: new Date(budget.year, budget.month, 1),
        },
      },
      _sum: { amount: true },
    });

    const spent = Number(spending._sum.amount || 0);
    const budgetAmount = Number(budget.amount);

    res.json({
      budget: {
        ...budget,
        spent,
        remaining: budgetAmount - spent,
        percentage:
          budgetAmount > 0
            ? Math.round((spent / budgetAmount) * 100 * 100) / 100
            : 0,
        isOverBudget: spent > budgetAmount,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/budgets
 * Create a new budget
 */
router.post("/", async (req, res, next) => {
  try {
    const validatedData = createBudgetSchema.parse(req.body);

    // Check if budget already exists for this category/month/year
    const existingBudget = await prisma.budget.findUnique({
      where: {
        userId_category_month_year: {
          userId: req.user.id,
          category: validatedData.category,
          month: validatedData.month,
          year: validatedData.year,
        },
      },
    });

    if (existingBudget) {
      throw new ApiError(
        409,
        "Budget already exists for this category in this month"
      );
    }

    const budget = await prisma.budget.create({
      data: {
        ...validatedData,
        userId: req.user.id,
      },
    });

    res.status(201).json({
      message: "Budget created successfully",
      budget,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/budgets/:id
 * Update a budget
 */
router.put("/:id", async (req, res, next) => {
  try {
    const existingBudget = await prisma.budget.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!existingBudget) {
      throw new ApiError(404, "Budget not found");
    }

    const validatedData = updateBudgetSchema.parse(req.body);

    const budget = await prisma.budget.update({
      where: { id: req.params.id },
      data: validatedData,
    });

    res.json({
      message: "Budget updated successfully",
      budget,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/budgets/:id
 * Delete a budget
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const existingBudget = await prisma.budget.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!existingBudget) {
      throw new ApiError(404, "Budget not found");
    }

    await prisma.budget.delete({
      where: { id: req.params.id },
    });

    res.json({ message: "Budget deleted successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/budgets/copy
 * Copy budgets from one month to another
 */
router.post("/copy", async (req, res, next) => {
  try {
    const { fromMonth, fromYear, toMonth, toYear } = req.body;

    if (!fromMonth || !fromYear || !toMonth || !toYear) {
      throw new ApiError(400, "Source and target month/year are required");
    }

    // Get source budgets
    const sourceBudgets = await prisma.budget.findMany({
      where: {
        userId: req.user.id,
        month: fromMonth,
        year: fromYear,
      },
    });

    if (sourceBudgets.length === 0) {
      throw new ApiError(404, "No budgets found for source month");
    }

    // Create new budgets (skip duplicates)
    const created = [];
    for (const source of sourceBudgets) {
      const existing = await prisma.budget.findUnique({
        where: {
          userId_category_month_year: {
            userId: req.user.id,
            category: source.category,
            month: toMonth,
            year: toYear,
          },
        },
      });

      if (!existing) {
        const newBudget = await prisma.budget.create({
          data: {
            userId: req.user.id,
            category: source.category,
            amount: source.amount,
            month: toMonth,
            year: toYear,
          },
        });
        created.push(newBudget);
      }
    }

    res.json({
      message: `${created.length} budgets copied successfully`,
      count: created.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

import { Router } from "express";
import prisma from "../lib/prisma.js";
import {
  createAccountSchema,
  updateAccountSchema,
} from "../validations/schemas.js";
import { ApiError } from "../middleware/errorHandler.js";

const router = Router();

/**
 * GET /api/accounts
 * Get all accounts for current user
 */
router.get("/", async (req, res, next) => {
  try {
    const accounts = await prisma.account.findMany({
      where: { userId: req.user.id, isActive: true },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });

    res.json({ accounts });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/accounts/:id
 * Get account by ID
 */
router.get("/:id", async (req, res, next) => {
  try {
    const account = await prisma.account.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        transactions: {
          orderBy: { date: "desc" },
          take: 10,
        },
      },
    });

    if (!account) {
      throw new ApiError(404, "Account not found");
    }

    res.json({ account });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/accounts
 * Create a new account
 */
router.post("/", async (req, res, next) => {
  try {
    const validatedData = createAccountSchema.parse(req.body);

    const account = await prisma.account.create({
      data: {
        ...validatedData,
        userId: req.user.id,
      },
    });

    res.status(201).json({
      message: "Account created successfully",
      account,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/accounts/:id
 * Update an account
 */
router.put("/:id", async (req, res, next) => {
  try {
    // Check if account exists and belongs to user
    const existingAccount = await prisma.account.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!existingAccount) {
      throw new ApiError(404, "Account not found");
    }

    const validatedData = updateAccountSchema.parse(req.body);

    const account = await prisma.account.update({
      where: { id: req.params.id },
      data: validatedData,
    });

    res.json({
      message: "Account updated successfully",
      account,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/accounts/:id
 * Soft delete an account (set isActive to false)
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const existingAccount = await prisma.account.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!existingAccount) {
      throw new ApiError(404, "Account not found");
    }

    const txCount = await prisma.transaction.count({
      where: { accountId: req.params.id },
    });

    if (txCount > 0) {
      throw new ApiError(
        409,
        `Cannot delete account with ${txCount} existing transaction(s). Remove or reassign transactions first.`,
      );
    }

    await prisma.account.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/accounts/:id/balance
 * Get account balance history
 */
router.get("/:id/balance", async (req, res, next) => {
  try {
    const account = await prisma.account.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!account) {
      throw new ApiError(404, "Account not found");
    }

    // Get transactions grouped by date for balance history
    const transactions = await prisma.transaction.findMany({
      where: { accountId: req.params.id },
      orderBy: { date: "asc" },
      select: {
        amount: true,
        type: true,
        date: true,
      },
    });

    // Calculate balance history
    let runningBalance = Number(account.balance);
    const balanceHistory = [];

    // Process transactions in reverse to get historical balances
    for (let i = transactions.length - 1; i >= 0; i--) {
      const t = transactions[i];
      const delta = t.type === "INCOME" ? -Number(t.amount) : Number(t.amount);
      runningBalance -= delta;
      balanceHistory.unshift({
        date: t.date,
        balance: runningBalance,
      });
    }

    res.json({
      currentBalance: account.balance,
      balanceHistory,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

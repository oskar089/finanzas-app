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

    await prisma.$transaction(async (tx) => {
      // A transfer references TWO accounts: the source row (accountId) and
      // its destination leg (toAccountId). Either reference blocks deletion,
      // otherwise removing a destination would silently orphan the credit.
      const txCount = await tx.transaction.count({
        where: {
          OR: [{ accountId: req.params.id }, { toAccountId: req.params.id }],
        },
      });

      if (txCount > 0) {
        throw new ApiError(
          409,
          `Cannot delete account with ${txCount} existing transaction(s). Remove or reassign transactions first.`,
        );
      }

      await tx.account.update({
        where: { id: req.params.id },
        data: { isActive: false },
      });
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

    // Get transactions ordered by date for balance history. A transfer
    // touches this account through either leg, so incoming legs (rows whose
    // toAccountId points here) must join the replay or the derived starting
    // balance would drift from the real stored balance.
    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [{ accountId: req.params.id }, { toAccountId: req.params.id }],
      },
      orderBy: { date: "asc" },
      select: {
        accountId: true,
        toAccountId: true,
        amount: true,
        type: true,
        date: true,
      },
    });

    // Signed effect of a transaction on THIS account's balance.
    // Outgoing legs match getBalanceEffect() in transactions.js: INCOME adds;
    // EXPENSE and TRANSFER subtract (a transfer moves money OUT of the
    // account its row is attached to). Incoming transfer legs live on rows
    // attached to the source and credit this account by +amount.
    const signedEffect = (t) => {
      if (t.toAccountId === req.params.id && t.accountId !== req.params.id) {
        return Number(t.amount);
      }
      return t.type === "INCOME" ? Number(t.amount) : -Number(t.amount);
    };

    // Rebuild history forward: derive the starting balance by removing every
    // transaction's effect from the current balance, then replay in order.
    const startingBalance =
      Number(account.balance) -
      transactions.reduce((sum, t) => sum + signedEffect(t), 0);

    let runningBalance = startingBalance;
    const balanceHistory = [];

    for (const t of transactions) {
      runningBalance += signedEffect(t);
      balanceHistory.push({
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

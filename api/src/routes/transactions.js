import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import {
  createTransactionSchema,
  updateTransactionSchema,
  transactionQuerySchema,
} from "../validations/schemas.js";
import { ApiError } from "../middleware/errorHandler.js";

const router = Router();

// CSV imports arrive as one array; cap it so a huge file cannot hold a single
// interactive Prisma transaction open indefinitely.
const bulkCreateSchema = z.object({
  transactions: z.array(createTransactionSchema).min(1).max(1000),
});

/**
 * Calculate the balance effect of a transaction on its account.
 * INCOME → adds to balance; EXPENSE → subtracts; TRANSFER → no net effect
 * (dual-entry support requires a toAccountId field for proper transfer handling).
 */
function getBalanceEffect(type, amount) {
  if (type === "INCOME") return Number(amount);
  if (type === "TRANSFER") return 0;
  return -Number(amount);
}

/**
 * GET /api/transactions
 * Get all transactions for current user with filtering and pagination
 */
router.get("/", async (req, res, next) => {
  try {
    const query = transactionQuerySchema.parse(req.query);

    // Build where clause
    const where = {
      userId: req.user.id,
      ...(query.type && { type: query.type }),
      ...(query.category && { category: query.category }),
      ...(query.accountId && { accountId: query.accountId }),
      // Range bounds must nest inside ONE object per field: sibling conditional
      // spreads at the top level would replace each other instead of merging.
      ...((query.startDate || query.endDate) && {
        date: {
          ...(query.startDate && { gte: new Date(query.startDate) }),
          ...(query.endDate && { lte: new Date(query.endDate) }),
        },
      }),
      ...((query.minAmount || query.maxAmount) && {
        amount: {
          ...(query.minAmount && { gte: query.minAmount }),
          ...(query.maxAmount && { lte: query.maxAmount }),
        },
      }),
      ...(query.concept && {
        description: {
          contains: query.concept,
          mode: "insensitive",
        },
      }),
    };

    // Get total count
    const total = await prisma.transaction.count({ where });

    // Get paginated transactions
    const transactions = await prisma.transaction.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { [query.sortBy]: query.sortOrder },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    res.json({
      transactions,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/transactions/:id
 * Get transaction by ID
 */
router.get("/:id", async (req, res, next) => {
  try {
    const transaction = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new ApiError(404, "Transaction not found");
    }

    res.json({ transaction });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/transactions
 * Create a new transaction
 */
router.post("/", async (req, res, next) => {
  try {
    const validatedData = createTransactionSchema.parse(req.body);

    // Verify account exists and belongs to user
    const account = await prisma.account.findFirst({
      where: { id: validatedData.accountId, userId: req.user.id },
    });

    if (!account) {
      throw new ApiError(404, "Account not found");
    }

    // Create transaction and update account balance
    const [transaction] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          ...validatedData,
          userId: req.user.id,
          date: new Date(validatedData.date),
        },
      }),
      prisma.account.update({
        where: { id: validatedData.accountId },
        data: {
          balance: {
            increment: getBalanceEffect(validatedData.type, validatedData.amount),
          },
        },
      }),
    ]);

    res.status(201).json({
      message: "Transaction created successfully",
      transaction,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/transactions/:id
 * Update a transaction — handles accountId changes atomically to prevent balance drift.
 */
router.put("/:id", async (req, res, next) => {
  try {
    // Check if transaction exists and belongs to user
    const existingTransaction = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!existingTransaction) {
      throw new ApiError(404, "Transaction not found");
    }

    const validatedData = updateTransactionSchema.parse(req.body);

    // Compute the old transaction's balance effect
    const oldEffect = getBalanceEffect(
      existingTransaction.type,
      existingTransaction.amount,
    );

    // Determine effective new values (fall back to existing when not provided)
    const newType = validatedData.type || existingTransaction.type;
    const newAmount =
      validatedData.amount !== undefined
        ? Number(validatedData.amount)
        : Number(existingTransaction.amount);
    const newEffect = getBalanceEffect(newType, newAmount);

    const accountChanged =
      validatedData.accountId &&
      validatedData.accountId !== existingTransaction.accountId;

    // Build update data, converting date if provided
    const updateData = { ...validatedData };
    if (updateData.date) {
      updateData.date = new Date(updateData.date);
    }

    // IDOR protection: if the destination account changed, verify it exists and
    // belongs to the requesting user before any balance is moved into it.
    // Mirrors POST and bulk (404, no existence disclosure).
    if (accountChanged) {
      const targetAccount = await prisma.account.findFirst({
        where: { id: validatedData.accountId, userId: req.user.id },
      });
      if (!targetAccount) {
        throw new ApiError(404, "Account not found");
      }
    }

    // Interactive $transaction handles account changes atomically:
    // if accountId changed → restore old account + adjust new account
    // if same account → apply net delta
    const [transaction] = await prisma.$transaction(async (tx) => {
      if (accountChanged) {
        // Restore old account by reversing the original effect
        await tx.account.update({
          where: { id: existingTransaction.accountId },
          data: { balance: { increment: -oldEffect } },
        });
        // Apply the new effect on the destination account
        await tx.account.update({
          where: { id: validatedData.accountId },
          data: { balance: { increment: newEffect } },
        });
      } else {
        // Same account — just apply the net delta
        await tx.account.update({
          where: { id: existingTransaction.accountId },
          data: { balance: { increment: newEffect - oldEffect } },
        });
      }

      // Update the transaction record
      return tx.transaction.update({
        where: { id: req.params.id },
        data: updateData,
      });
    });

    res.json({
      message: "Transaction updated successfully",
      transaction,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/transactions/:id
 * Delete a transaction and reverse balance change
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const existingTransaction = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!existingTransaction) {
      throw new ApiError(404, "Transaction not found");
    }

    // Calculate balance reversal (reverse the original effect)
    const balanceReversal = -getBalanceEffect(
      existingTransaction.type,
      existingTransaction.amount,
    );

    // Delete transaction and reverse balance
    await prisma.$transaction([
      prisma.transaction.delete({
        where: { id: req.params.id },
      }),
      prisma.account.update({
        where: { id: existingTransaction.accountId },
        data: {
          balance: {
            increment: balanceReversal,
          },
        },
      }),
    ]);

    res.json({ message: "Transaction deleted successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/transactions/bulk
 * Bulk create transactions (for CSV import)
 */
router.post("/bulk", async (req, res, next) => {
  try {
    const { transactions: validatedTransactions } = bulkCreateSchema.parse(req.body);

    // IDOR protection: batch-verify that every referenced account belongs to
    // the requesting user before creating transactions or updating balances.
    // Mirrors the single-create POST handler (404, no existence disclosure).
    const accountIds = [...new Set(validatedTransactions.map((t) => t.accountId))];
    const ownedAccounts = await prisma.account.findMany({
      where: { id: { in: accountIds }, userId: req.user.id },
      select: { id: true },
    });
    if (ownedAccounts.length !== accountIds.length) {
      throw new ApiError(404, "Account not found");
    }

    // Create all transactions in a single transaction
    const result = await prisma.$transaction(async (tx) => {
      const created = [];

      for (const t of validatedTransactions) {
        const transaction = await tx.transaction.create({
          data: {
            ...t,
            userId: req.user.id,
            date: new Date(t.date),
          },
        });

        await tx.account.update({
          where: { id: t.accountId },
          data: {
            balance: {
              increment: getBalanceEffect(t.type, t.amount),
            },
          },
        });

        created.push(transaction);
      }

      return created;
    });

    res.status(201).json({
      message: `${result.length} transactions created successfully`,
      count: result.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

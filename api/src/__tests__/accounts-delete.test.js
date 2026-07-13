import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// Tests: Atomic account soft-delete (Task 3.7)
// ============================================================
// Verifies that DELETE /api/accounts/:id wraps the count-check
// and update in a Prisma $transaction to prevent race conditions.
// ============================================================

// Mock prisma before importing route handlers
vi.mock("../lib/prisma.js", () => ({
  default: {
    account: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    transaction: {
      count: vi.fn(),
    },
    $transaction: vi.fn((cb) => {
      // Execute the callback with prisma-as-tx (same mock shape)
      const tx = {
        account: {
          findFirst: vi.fn(),
          update: vi.fn(),
        },
        transaction: {
          count: vi.fn(),
        },
      };
      return cb(tx);
    }),
  },
}));

import prisma from "../lib/prisma.js";

describe("DELETE /api/accounts/:id — atomic $transaction", () => {
  let router;
  let req;

  beforeEach(async () => {
    vi.clearAllMocks();

    const mod = await import("../routes/accounts.js");
    router = mod.default;

    req = {
      user: { id: "user-1" },
      params: { id: "account-1" },
    };
  });

  function createRes() {
    const state = { statusCode: 200, body: null };
    const res = {
      status: vi.fn((code) => {
        state.statusCode = code;
        return res;
      }),
      json: vi.fn((data) => {
        state.body = data;
      }),
      state,
    };
    return res;
  }

  it("wraps count + update in a single $transaction call", async () => {
    // Account exists, has no transactions
    prisma.account.findFirst.mockResolvedValue({
      id: "account-1",
      userId: "user-1",
      name: "Test Account",
      isActive: true,
    });

    const res = createRes();
    const next = vi.fn();

    // Find the DELETE /:id route
    const deleteLayer = router.stack.find(
      (l) => l.route?.path === "/:id" && l.route.methods.delete,
    );
    if (!deleteLayer) {
      throw new Error("Could not find DELETE /:id route");
    }
    await deleteLayer.route.stack[0].handle(req, res, next);

    // $transaction was called
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));

    // Account was soft-deleted inside the transaction
    const txCb = prisma.$transaction.mock.calls[0][0];
    const tx = {
      account: { update: vi.fn().mockResolvedValue({ id: "account-1", isActive: false }) },
      transaction: { count: vi.fn().mockResolvedValue(0) },
    };
    await txCb(tx);

    expect(tx.transaction.count).toHaveBeenCalledWith({
      where: { accountId: "account-1" },
    });
    expect(tx.account.update).toHaveBeenCalledWith({
      where: { id: "account-1" },
      data: { isActive: false },
    });

    // Response is success
    expect(res.state.statusCode).toBe(200);
    expect(res.state.body.message).toBe("Account deleted successfully");
  });

  it("returns 409 when account has transactions (inside $transaction)", async () => {
    prisma.account.findFirst.mockResolvedValue({
      id: "account-1",
      userId: "user-1",
      name: "Test Account",
      isActive: true,
    });

    // Mock $transaction to throw ApiError when count > 0
    prisma.$transaction.mockImplementationOnce(async (cb) => {
      const tx = {
        account: { update: vi.fn() },
        transaction: { count: vi.fn().mockResolvedValue(3) },
      };
      return cb(tx);
    });

    const res = createRes();
    const next = vi.fn();

    const deleteLayer = router.stack.find(
      (l) => l.route?.path === "/:id" && l.route.methods.delete,
    );
    await deleteLayer.route.stack[0].handle(req, res, next);

    // Error was passed to next() — the 409 check happened inside $transaction
    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error.statusCode || error.status).toBe(409);
    expect(error.message).toContain("transaction");
  });

  it("returns 404 when account does not exist (before $transaction)", async () => {
    prisma.account.findFirst.mockResolvedValue(null);

    const res = createRes();
    const next = vi.fn();

    const deleteLayer = router.stack.find(
      (l) => l.route?.path === "/:id" && l.route.methods.delete,
    );
    await deleteLayer.route.stack[0].handle(req, res, next);

    // $transaction was NOT called — early exit before it
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error.statusCode || error.status).toBe(404);
  });
});

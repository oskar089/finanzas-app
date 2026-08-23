import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// Transfer destination-leg regression tests
// ============================================================
// A TRANSFER row carries toAccountId: creation credits the destination,
// deletion claws that credit back, and updates rebalance whichever legs
// changed. All balance math must stay atomic ($transaction).
// ============================================================

vi.mock("../lib/prisma.js", () => ({
  default: {
    account: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    transaction: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import prisma from "../lib/prisma.js";

const ACCOUNT_A = "123e4567-e89b-12d3-a456-426614174000";
const ACCOUNT_B = "123e4567-e89b-12d3-a456-426614174001";
const ACCOUNT_C = "123e4567-e89b-12d3-a456-426614174002";

const transferBody = {
  accountId: ACCOUNT_A,
  toAccountId: ACCOUNT_B,
  amount: 100,
  type: "TRANSFER",
  category: "transferencia",
  description: "Move money",
  date: "2026-06-15T10:00:00.000Z",
};

async function getHandler(method, path) {
  const mod = await import("../routes/transactions.js");
  const layer = mod.default.stack.find(
    (l) => l.route?.path === path && l.route.methods[method],
  );
  if (!layer) throw new Error(`Could not find ${method} ${path} route`);
  return layer.route.stack[0].handle;
}

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

// $transaction must serve BOTH forms used by the routes: array-form (POST,
// DELETE) and interactive callback form (PUT). The tx client reuses the
// top-level spies so every balance mutation lands in one assertion surface.
beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation(async (input) => {
    if (Array.isArray(input)) return Promise.all(input);
    const tx = {
      account: { update: prisma.account.update },
      transaction: { update: prisma.transaction.update },
    };
    return input(tx);
  });
});

async function runHandler(handler, req) {
  const next = vi.fn();
  const res = createRes();
  await handler(req, res, next);
  return { next, res };
}

describe("POST /api/transactions — TRANSFER destination leg", () => {
  it("debits the source AND credits the destination inside one $transaction", async () => {
    const handler = await getHandler("post", "/");

    // Ownership checks: source then destination, both owned
    prisma.account.findFirst
      .mockResolvedValueOnce({ id: ACCOUNT_A, userId: "user-1" })
      .mockResolvedValueOnce({ id: ACCOUNT_B, userId: "user-1" });
    prisma.transaction.create.mockResolvedValue({
      id: "t1",
      ...transferBody,
    });

    const res = createRes();
    await handler({ user: { id: "user-1" }, body: transferBody }, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(201);

    // Row records both legs
    expect(prisma.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: ACCOUNT_A,
        toAccountId: ACCOUNT_B,
      }),
    });

    // Balance effects: -amount source, +amount destination
    const updates = prisma.account.update.mock.calls.map((c) => c[0]);
    expect(updates).toContainEqual({
      where: { id: ACCOUNT_A },
      data: { balance: { increment: -100 } },
    });
    expect(updates).toContainEqual({
      where: { id: ACCOUNT_B },
      data: { balance: { increment: 100 } },
    });
  });

  it("rejects TRANSFER without toAccountId", async () => {
    const handler = await getHandler("post", "/");
    const { toAccountId, ...missingDestination } = transferBody;

    const { next } = await runHandler(handler, {
      user: { id: "user-1" },
      body: missingDestination,
    });

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].name).toBe("ZodError");
    // Balance side effects must not run on invalid input
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it("rejects TRANSFER whose destination equals the source", async () => {
    const handler = await getHandler("post", "/");

    const { next } = await runHandler(handler, {
      user: { id: "user-1" },
      body: { ...transferBody, toAccountId: ACCOUNT_A },
    });

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].name).toBe("ZodError");
  });

  it("rejects a destination carried by a non-TRANSFER type", async () => {
    const handler = await getHandler("post", "/");

    const { next } = await runHandler(handler, {
      user: { id: "user-1" },
      body: { ...transferBody, type: "INCOME" },
    });

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].name).toBe("ZodError");
  });

  it("returns 404 when the destination account is not owned by the user", async () => {
    const handler = await getHandler("post", "/");

    prisma.account.findFirst
      .mockResolvedValueOnce({ id: ACCOUNT_A, userId: "user-1" })
      .mockResolvedValueOnce(null);

    const { next } = await runHandler(handler, {
      user: { id: "user-1" },
      body: transferBody,
    });

    const error = next.mock.calls[0][0];
    expect(error.statusCode || error.status).toBe(404);
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/transactions/:id — transfer reversal", () => {
  it("claws back the destination credit when deleting a TRANSFER", async () => {
    const handler = await getHandler("delete", "/:id");

    prisma.transaction.findFirst.mockResolvedValue({
      id: "t9",
      accountId: ACCOUNT_A,
      toAccountId: ACCOUNT_B,
      type: "TRANSFER",
      amount: "100",
    });

    const res = createRes();
    await handler(
      { user: { id: "user-1" }, params: { id: "t9" } },
      res,
      vi.fn(),
    );

    const updates = prisma.account.update.mock.calls.map((c) => c[0]);
    expect(updates).toContainEqual({
      where: { id: ACCOUNT_A },
      data: { balance: { increment: 100 } },
    });
    expect(updates).toContainEqual({
      where: { id: ACCOUNT_B },
      data: { balance: { decrement: 100 } },
    });
  });

  it("only reverses the source leg for non-transfer deletions", async () => {
    const handler = await getHandler("delete", "/:id");

    prisma.transaction.findFirst.mockResolvedValue({
      id: "t8",
      accountId: ACCOUNT_A,
      toAccountId: null,
      type: "EXPENSE",
      amount: "40",
    });

    const res = createRes();
    await handler(
      { user: { id: "user-1" }, params: { id: "t8" } },
      res,
      vi.fn(),
    );

    expect(prisma.account.update).toHaveBeenCalledTimes(1);
    expect(prisma.account.update).toHaveBeenCalledWith({
      where: { id: ACCOUNT_A },
      data: { balance: { increment: 40 } },
    });
  });
});

describe("PUT /api/transactions/:id — converting to/from TRANSFER", () => {
  it("applies net source delta and opens the destination leg on EXPENSE→TRANSFER", async () => {
    const handler = await getHandler("put", "/:id");

    prisma.transaction.findFirst.mockResolvedValue({
      id: "t7",
      accountId: ACCOUNT_A,
      toAccountId: null,
      type: "EXPENSE",
      amount: "50",
    });
    // Destination ownership check for the NEW leg
    prisma.account.findFirst.mockResolvedValueOnce({
      id: ACCOUNT_B,
      userId: "user-1",
    });
    prisma.transaction.update.mockResolvedValue({ id: "t7" });

    const res = createRes();
    await handler(
      {
        user: { id: "user-1" },
        params: { id: "t7" },
        body: { type: "TRANSFER", toAccountId: ACCOUNT_B, amount: 80 },
      },
      res,
      vi.fn(),
    );

    // Source: old effect -50, new effect -80 → net delta -30 on A
    expect(prisma.account.update).toHaveBeenCalledWith({
      where: { id: ACCOUNT_A },
      data: { balance: { increment: -30 } },
    });
    // Destination: +80 on B
    expect(prisma.account.update).toHaveBeenCalledWith({
      where: { id: ACCOUNT_B },
      data: { balance: { increment: 80 } },
    });
    // Persisted row keeps the destination pointer
    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: "t7" },
      data: expect.objectContaining({ toAccountId: ACCOUNT_B }),
    });
  });

  it("closes the destination leg on TRANSFER→EXPENSE", async () => {
    const handler = await getHandler("put", "/:id");

    prisma.transaction.findFirst.mockResolvedValue({
      id: "t6",
      accountId: ACCOUNT_A,
      toAccountId: ACCOUNT_B,
      type: "TRANSFER",
      amount: "100",
    });
    prisma.transaction.update.mockResolvedValue({ id: "t6" });

    const res = createRes();
    await handler(
      {
        user: { id: "user-1" },
        params: { id: "t6" },
        body: { type: "EXPENSE" },
      },
      res,
      vi.fn(),
    );

    // Old destination credit reversed
    expect(prisma.account.update).toHaveBeenCalledWith({
      where: { id: ACCOUNT_B },
      data: { balance: { decrement: 100 } },
    });
    // Column cleared so no ghost leg remains
    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: "t6" },
      data: expect.objectContaining({ toAccountId: null }),
    });
  });

  it("rebalances the destination when the transfer target changes", async () => {
    const handler = await getHandler("put", "/:id");

    prisma.transaction.findFirst.mockResolvedValue({
      id: "t5",
      accountId: ACCOUNT_A,
      toAccountId: ACCOUNT_B,
      type: "TRANSFER",
      amount: "100",
    });
    prisma.account.findFirst.mockResolvedValueOnce({
      id: ACCOUNT_C,
      userId: "user-1",
    });
    prisma.transaction.update.mockResolvedValue({ id: "t5" });

    const res = createRes();
    await handler(
      {
        user: { id: "user-1" },
        params: { id: "t5" },
        body: { toAccountId: ACCOUNT_C },
      },
      res,
      vi.fn(),
    );

    // Reverse old credit on B, apply new credit on C
    expect(prisma.account.update).toHaveBeenCalledWith({
      where: { id: ACCOUNT_B },
      data: { balance: { decrement: 100 } },
    });
    expect(prisma.account.update).toHaveBeenCalledWith({
      where: { id: ACCOUNT_C },
      data: { balance: { increment: 100 } },
    });
    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: "t5" },
      data: expect.objectContaining({ toAccountId: ACCOUNT_C }),
    });
  });

  it("rejects a transfer pointing its destination at its own source", async () => {
    const handler = await getHandler("put", "/:id");

    prisma.transaction.findFirst.mockResolvedValue({
      id: "t4",
      accountId: ACCOUNT_A,
      toAccountId: null,
      type: "EXPENSE",
      amount: "50",
    });

    const next = vi.fn();
    const res = createRes();
    await handler(
      {
        user: { id: "user-1" },
        params: { id: "t4" },
        body: { type: "TRANSFER", toAccountId: ACCOUNT_A },
      },
      res,
      next,
    );

    const error = next.mock.calls[0][0];
    expect(error.statusCode || error.status).toBe(400);
  });
});

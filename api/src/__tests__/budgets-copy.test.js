import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// POST /api/budgets/copy — batched rewrite regression tests
// ============================================================
// The copy endpoint used to do findUnique+create PER category (N+1 with
// non-atomic writes). It must now read source+target state in one
// $transaction round trip and insert everything missing in ONE createMany
// guarded by skipDuplicates.
// ============================================================

vi.mock("../lib/prisma.js", () => ({
  default: {
    budget: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn((ops) => Promise.all(ops)),
  },
}));

import prisma from "../lib/prisma.js";

const SOURCE_BUDGETS = [
  { id: "b1", userId: "user-1", category: "alimentacion", amount: "500", month: 7, year: 2026 },
  { id: "b2", userId: "user-1", category: "transporte", amount: "200", month: 7, year: 2026 },
];

beforeEach(() => {
  vi.clearAllMocks();
});

async function getCopyHandler() {
  const mod = await import("../routes/budgets.js");
  const layer = mod.default.stack.find(
    (l) => l.route?.path === "/copy" && l.route.methods.post,
  );
  if (!layer) throw new Error("Could not find POST /copy route");
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

describe("POST /api/budgets/copy", () => {
  it("inserts all missing budgets in one createMany with skipDuplicates", async () => {
    const handler = await getCopyHandler();

    // $transaction([sourceRead, targetRead]) — ordered mocks
    prisma.budget.findMany
      .mockResolvedValueOnce(SOURCE_BUDGETS)
      .mockResolvedValueOnce([]); // nothing exists in August yet
    prisma.budget.createMany.mockResolvedValue({ count: 2 });

    const res = createRes();
    await handler(
      {
        user: { id: "user-1" },
        body: { fromMonth: 7, fromYear: 2026, toMonth: 8, toYear: 2026 },
      },
      res,
      vi.fn(),
    );

    expect(prisma.budget.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.budget.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "user-1",
          category: "alimentacion",
          amount: "500",
          month: 8,
          year: 2026,
        },
        {
          userId: "user-1",
          category: "transporte",
          amount: "200",
          month: 8,
          year: 2026,
        },
      ],
      skipDuplicates: true,
    });

    // Response shape preserved exactly
    expect(res.state.body).toEqual({
      message: "2 budgets copied successfully",
      count: 2,
    });
  });

  it("skips categories that already exist in the target month", async () => {
    const handler = await getCopyHandler();

    prisma.budget.findMany
      .mockResolvedValueOnce(SOURCE_BUDGETS)
      .mockResolvedValueOnce([{ category: "alimentacion" }]);
    prisma.budget.createMany.mockResolvedValue({ count: 1 });

    const res = createRes();
    await handler(
      {
        user: { id: "user-1" },
        body: { fromMonth: 7, fromYear: 2026, toMonth: 8, toYear: 2026 },
      },
      res,
      vi.fn(),
    );

    const { data } = prisma.budget.createMany.mock.calls[0][0];
    expect(data).toHaveLength(1);
    expect(data[0].category).toBe("transporte");
    expect(res.state.body.count).toBe(1);
  });

  it("reports zero copies without calling createMany when everything duplicates", async () => {
    const handler = await getCopyHandler();

    prisma.budget.findMany
      .mockResolvedValueOnce(SOURCE_BUDGETS)
      .mockResolvedValueOnce([
        { category: "alimentacion" },
        { category: "transporte" },
      ]);

    const res = createRes();
    await handler(
      {
        user: { id: "user-1" },
        body: { fromMonth: 7, fromYear: 2026, toMonth: 8, toYear: 2026 },
      },
      res,
      vi.fn(),
    );

    expect(prisma.budget.createMany).not.toHaveBeenCalled();
    expect(res.state.body).toEqual({
      message: "0 budgets copied successfully",
      count: 0,
    });
  });

  it("returns 404 and never inserts when the source month is empty", async () => {
    const handler = await getCopyHandler();

    prisma.budget.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const next = vi.fn();
    await handler(
      {
        user: { id: "user-1" },
        body: { fromMonth: 1, fromYear: 2026, toMonth: 8, toYear: 2026 },
      },
      createRes(),
      next,
    );

    const error = next.mock.calls[0][0];
    expect(error.statusCode || error.status).toBe(404);
    expect(error.message).toBe("No budgets found for source month");
    expect(prisma.budget.createMany).not.toHaveBeenCalled();
  });
});

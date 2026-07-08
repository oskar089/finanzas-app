import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// Performance optimisation tests
// ============================================================

// Mock prisma before importing route handlers
vi.mock("../lib/prisma.js", () => ({
  default: {
    transaction: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
    budget: {
      findMany: vi.fn(),
    },
    account: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from "../lib/prisma.js";

// ============================================================
// Task 2.4: Monthly response shape test
// ============================================================

describe("GET /api/dashboard/monthly — single query shape", () => {
  let router;
  let req;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Dynamically import so mocks are already set
    const mod = await import("../routes/dashboard.js");
    router = mod.default;

    req = {
      user: { id: "user-1" },
      query: {},
    };
  });

  function createRes() {
    const state = { statusCode: 200, body: null };
    return {
      status: vi.fn((code) => {
        state.statusCode = code;
        return res;
      }),
      json: vi.fn((data) => {
        state.body = data;
      }),
      state,
    };
  }

  it("returns 6 monthly entries with income, expenses, net", async () => {
    // Single transactions in different months
    prisma.transaction.findMany.mockResolvedValue([
      {
        id: "t1",
        amount: "1000",
        type: "INCOME",
        date: new Date(2026, 5, 15), // June 2026
        category: "sueldo",
      },
      {
        id: "t2",
        amount: "300",
        type: "EXPENSE",
        date: new Date(2026, 5, 20), // June 2026
        category: "alimentacion",
      },
      {
        id: "t3",
        amount: "2000",
        type: "INCOME",
        date: new Date(2026, 6, 1), // July 2026
        category: "sueldo",
      },
      {
        id: "t4",
        amount: "150",
        type: "EXPENSE",
        date: new Date(2026, 6, 5), // July 2026
        category: "transporte",
      },
    ]);

    const res = createRes();
    const next = vi.fn();

    // Find the /monthly handler from the Express Router stack
    const monthlyLayer = router.stack.find((l) => l.route?.path === "/monthly");
    if (!monthlyLayer) {
      throw new Error("Could not find /monthly route");
    }
    await monthlyLayer.route.stack[0].handle(req, res, next);

    const { monthlyData } = res.state.body;

    expect(Array.isArray(monthlyData)).toBe(true);
    expect(monthlyData.length).toBe(6);

    // Each entry has the expected shape
    for (const entry of monthlyData) {
      expect(entry).toHaveProperty("month");
      expect(entry).toHaveProperty("year");
      expect(entry).toHaveProperty("income");
      expect(entry).toHaveProperty("expenses");
      expect(entry).toHaveProperty("net");
      expect(entry).toHaveProperty("transactionCount");
      expect(typeof entry.month).toBe("number");
      expect(typeof entry.income).toBe("number");
      expect(typeof entry.expenses).toBe("number");
    }

    // June (month 6) should have income=1000, expenses=300
    const june = monthlyData.find((d) => d.month === 6);
    expect(june).toBeDefined();
    expect(june.income).toBe(1000);
    expect(june.expenses).toBe(300);
    expect(june.net).toBe(700);

    // July (month 7) should have income=2000, expenses=150
    const july = monthlyData.find((d) => d.month === 7);
    expect(july).toBeDefined();
    expect(july.income).toBe(2000);
    expect(july.expenses).toBe(150);
    expect(july.net).toBe(1850);

    // Single query: findMany called once
    expect(prisma.transaction.findMany).toHaveBeenCalledTimes(1);
  });

  it("pads empty months with zero values", async () => {
    prisma.transaction.findMany.mockResolvedValue([]);

    const res = createRes();
    const next = vi.fn();

    const monthlyLayer = router.stack.find((l) => l.route?.path === "/monthly");
    if (!monthlyLayer) {
      throw new Error("Could not find /monthly route");
    }
    await monthlyLayer.route.stack[0].handle(req, res, next);

    const { monthlyData } = res.state.body;

    expect(monthlyData.length).toBe(6);
    for (const entry of monthlyData) {
      expect(entry.income).toBe(0);
      expect(entry.expenses).toBe(0);
      expect(entry.net).toBe(0);
      expect(entry.transactionCount).toBe(0);
    }

    // Still a single query
    expect(prisma.transaction.findMany).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// Task 2.5: Budget zero-spending categories test
// ============================================================

describe("GET /api/budgets — zero-spending categories", () => {
  let router;
  let req;

  beforeEach(async () => {
    vi.clearAllMocks();

    const mod = await import("../routes/budgets.js");
    router = mod.default;

    req = {
      user: { id: "user-1" },
      query: { month: "7", year: "2026" },
    };
  });

  function createRes() {
    const state = { statusCode: 200, body: null };
    return {
      status: vi.fn((code) => {
        state.statusCode = code;
        return res;
      }),
      json: vi.fn((data) => {
        state.body = data;
      }),
      state,
    };
  }

  it("includes categories with zero spending when no expenses exist", async () => {
    // 3 budgets: food, transport, entertainment
    prisma.budget.findMany.mockResolvedValue([
      {
        id: "b1",
        userId: "user-1",
        category: "alimentacion",
        amount: "500",
        month: 7,
        year: 2026,
      },
      {
        id: "b2",
        userId: "user-1",
        category: "transporte",
        amount: "200",
        month: 7,
        year: 2026,
      },
      {
        id: "b3",
        userId: "user-1",
        category: "entretenimiento",
        amount: "150",
        month: 7,
        year: 2026,
      },
    ]);

    // Only "alimentacion" and "transporte" have expenses; "entretenimiento" has none
    prisma.transaction.groupBy.mockResolvedValue([
      { category: "alimentacion", _sum: { amount: "300" } },
      { category: "transporte", _sum: { amount: "50" } },
    ]);

    const res = createRes();
    const next = vi.fn();

    // Find the GET / handler
    const rootLayer = router.stack.find((l) => l.route?.path === "/");
    if (!rootLayer) {
      throw new Error("Could not find GET / route in budgets router");
    }
    await rootLayer.route.stack[0].handle(req, res, next);

    const { budgets } = res.state.body;

    expect(Array.isArray(budgets)).toBe(true);
    expect(budgets.length).toBe(3);

    // "entretenimiento" should appear with spent: 0
    const entretenimiento = budgets.find((b) => b.category === "entretenimiento");
    expect(entretenimiento).toBeDefined();
    expect(Number(entretenimiento.spent)).toBe(0);
    expect(Number(entretenimiento.remaining)).toBe(150);
    expect(entretenimiento.percentage).toBe(0);

    // "alimentacion" should have its correct spending
    const alimentacion = budgets.find((b) => b.category === "alimentacion");
    expect(alimentacion).toBeDefined();
    expect(Number(alimentacion.spent)).toBe(300);
    expect(Number(alimentacion.remaining)).toBe(200);

    // Single groupBy query, NOT per-budget aggregate
    expect(prisma.transaction.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.transaction.aggregate).not.toHaveBeenCalled();
  });

  it("works with empty budgets array", async () => {
    prisma.budget.findMany.mockResolvedValue([]);

    const res = createRes();
    const next = vi.fn();

    const rootLayer = router.stack.find((l) => l.route?.path === "/");
    if (!rootLayer) {
      throw new Error("Could not find GET / route in budgets router");
    }
    await rootLayer.route.stack[0].handle(req, res, next);

    const { budgets } = res.state.body;
    expect(Array.isArray(budgets)).toBe(true);
    expect(budgets.length).toBe(0);
  });
});

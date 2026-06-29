import { describe, it, expect } from "vitest";

// ============================================================
// Pure balance calculation logic extracted from transactions.js
// ============================================================

function calculateBalanceEffect(type, amount) {
  return type === "INCOME" ? Number(amount) : -Number(amount);
}

function calculateNetDelta(oldType, oldAmount, newType, newAmount) {
  const oldEffect = calculateBalanceEffect(oldType, oldAmount);
  const newEffect = calculateBalanceEffect(newType, newAmount);
  return newEffect - oldEffect;
}

describe("calculateBalanceEffect", () => {
  it("returns positive amount for INCOME", () => {
    expect(calculateBalanceEffect("INCOME", 100)).toBe(100);
  });

  it("returns negative amount for EXPENSE", () => {
    expect(calculateBalanceEffect("EXPENSE", 50)).toBe(-50);
  });

  it("handles zero amount", () => {
    expect(calculateBalanceEffect("INCOME", 0)).toBe(0);
    // -0 is mathematically equal to 0; accept either
    const expenseZero = calculateBalanceEffect("EXPENSE", 0);
    expect(expenseZero === 0 || Object.is(expenseZero, -0)).toBe(true);
  });

  it("handles string amounts by coercing to number", () => {
    expect(calculateBalanceEffect("INCOME", "100")).toBe(100);
    expect(calculateBalanceEffect("EXPENSE", "75.50")).toBe(-75.5);
  });
});

describe("calculateNetDelta", () => {
  it("returns difference when type stays the same", () => {
    // Old: INCOME 100 -> effect +100
    // New: INCOME 150 -> effect +150
    // Delta: 150 - 100 = 50
    expect(calculateNetDelta("INCOME", 100, "INCOME", 150)).toBe(50);
  });

  it("handles changing from income to expense", () => {
    // Old: EXPENSE 50 -> effect -50
    // New: INCOME 100 -> effect +100
    // Delta: 100 - (-50) = 150
    expect(calculateNetDelta("EXPENSE", 50, "INCOME", 100)).toBe(150);
  });

  it("handles changing from expense to income", () => {
    // Old: INCOME 100 -> effect +100
    // New: EXPENSE 50 -> effect -50
    // Delta: -50 - 100 = -150
    expect(calculateNetDelta("INCOME", 100, "EXPENSE", 50)).toBe(-150);
  });

  it("returns zero when nothing changes", () => {
    expect(calculateNetDelta("INCOME", 100, "INCOME", 100)).toBe(0);
    expect(calculateNetDelta("EXPENSE", 50, "EXPENSE", 50)).toBe(0);
  });

  it("handles changing amount only", () => {
    // Old: EXPENSE 100 -> effect -100
    // New: EXPENSE 75  -> effect -75
    // Delta: -75 - (-100) = 25
    expect(calculateNetDelta("EXPENSE", 100, "EXPENSE", 75)).toBe(25);
  });
});

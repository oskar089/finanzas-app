import { describe, it, expect } from "vitest";
import {
  createTransactionSchema,
  updateTransactionSchema,
} from "../validations/schemas.js";

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const VALID_DATE = "2026-06-15T10:00:00.000Z";

describe("createTransactionSchema", () => {
  const validTransaction = {
    accountId: VALID_UUID,
    amount: 100,
    type: "INCOME",
    category: "sueldo",
    description: "Monthly salary",
    date: VALID_DATE,
  };

  it("validates a correct INCOME transaction", () => {
    const result = createTransactionSchema.parse(validTransaction);
    expect(result.amount).toBe(100);
    expect(result.type).toBe("INCOME");
  });

  it("validates a correct EXPENSE transaction", () => {
    const result = createTransactionSchema.parse({
      ...validTransaction,
      type: "EXPENSE",
      category: "alimentacion",
    });
    expect(result.type).toBe("EXPENSE");
  });

  it("rejects negative amount", () => {
    expect(() =>
      createTransactionSchema.parse({ ...validTransaction, amount: -50 }),
    ).toThrow();
  });

  it("rejects zero amount", () => {
    expect(() =>
      createTransactionSchema.parse({ ...validTransaction, amount: 0 }),
    ).toThrow();
  });

  it("rejects invalid type", () => {
    expect(() =>
      createTransactionSchema.parse({ ...validTransaction, type: "INVALID" }),
    ).toThrow();
  });

  it("rejects missing accountId", () => {
    const { accountId, ...rest } = validTransaction;
    expect(() => createTransactionSchema.parse(rest)).toThrow();
  });

  it("rejects invalid UUID for accountId", () => {
    expect(() =>
      createTransactionSchema.parse({
        ...validTransaction,
        accountId: "not-a-uuid",
      }),
    ).toThrow();
  });

  it("accepts optional notes field", () => {
    const result = createTransactionSchema.parse({
      ...validTransaction,
      notes: "Some notes here",
    });
    expect(result.notes).toBe("Some notes here");
  });
});

// ============================================================
// TRANSFER destination leg contract
// ============================================================

describe("createTransactionSchema — toAccountId rules", () => {
  const incomeBase = {
    accountId: VALID_UUID,
    amount: 100,
    type: "INCOME",
    category: "sueldo",
    description: "Monthly salary",
    date: VALID_DATE,
  };

  const transferBase = {
    accountId: VALID_UUID,
    amount: 100,
    type: "TRANSFER",
    category: "transferencia",
    description: "Move money",
    date: VALID_DATE,
  };

  it("requires toAccountId for TRANSFER", () => {
    expect(() => createTransactionSchema.parse(transferBase)).toThrow();
  });

  it("accepts a TRANSFER with a distinct destination", () => {
    const result = createTransactionSchema.parse({
      ...transferBase,
      toAccountId: "123e4567-e89b-12d3-a456-426614174001",
    });
    expect(result.toAccountId).toBe(
      "123e4567-e89b-12d3-a456-426614174001",
    );
  });

  it("rejects a TRANSFER whose destination equals its source", () => {
    expect(() =>
      createTransactionSchema.parse({
        ...transferBase,
        toAccountId: VALID_UUID,
      }),
    ).toThrow();
  });

  it("forbids a non-null toAccountId on INCOME/EXPENSE", () => {
    expect(() =>
      createTransactionSchema.parse({
        ...incomeBase,
        toAccountId: "123e4567-e89b-12d3-a456-426614174001",
      }),
    ).toThrow();
    expect(() =>
      createTransactionSchema.parse({
        ...incomeBase,
        type: "EXPENSE",
        toAccountId: "123e4567-e89b-12d3-a456-426614174001",
      }),
    ).toThrow();
  });

  it("accepts an explicit null toAccountId on non-transfer types", () => {
    const result = createTransactionSchema.parse({
      ...incomeBase,
      toAccountId: null,
    });
    expect(result.toAccountId).toBeNull();
  });
});

// ============================================================
// Canonical category shape — category is a NAME STRING; there is no
// categoryId column anywhere in the data model, so schemas must not
// advertise one (clients following the old shape got Prisma 400s).
// ============================================================

describe("createTransactionSchema — canonical category shape", () => {
  it("strips a legacy categoryId field instead of forwarding it to Prisma", () => {
    const result = createTransactionSchema.parse({
      accountId: VALID_UUID,
      amount: 100,
      type: "INCOME",
      category: "sueldo",
      categoryId: VALID_UUID,
      description: "Monthly salary",
      date: VALID_DATE,
    });
    expect(result.category).toBe("sueldo");
    expect("categoryId" in result).toBe(false);
  });
});

describe("updateTransactionSchema", () => {
  const validUpdate = {
    amount: 200,
    description: "Updated description",
  };

  it("validates a partial update", () => {
    const result = updateTransactionSchema.parse(validUpdate);
    expect(result.amount).toBe(200);
  });

  it("allows empty object (no fields required)", () => {
    const result = updateTransactionSchema.parse({});
    expect(Object.keys(result).length).toBe(0);
  });

  it("rejects negative amount in update", () => {
    expect(() =>
      updateTransactionSchema.parse({ amount: -10 }),
    ).toThrow();
  });
});

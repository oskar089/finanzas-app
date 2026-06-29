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

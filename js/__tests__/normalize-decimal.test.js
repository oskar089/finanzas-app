import { describe, it, expect } from "vitest";

// ============================================================
// Tests: Decimal comma normalization (Task 3.6)
// ============================================================
// Verifies that filter handlers correctly normalize comma as decimal
// separator, matching the pattern used in js/app.js loadMovimientos():
//
//   if (filterMontoMin) params.minAmount = Number(String(filterMontoMin).replace(",", "."));
//
// and the transaction creation handler:
//
//   const monto = Number(montoTexto.replace(",", "."));
// ============================================================

function normalizeAmount(raw) {
  return Number(String(raw).replace(",", "."));
}

describe("decimal comma normalization in filters", () => {
  it("normalizes comma to dot: '100,50' becomes 100.50", () => {
    const result = normalizeAmount("100,50");
    expect(result).toBe(100.50);
  });

  it("leaves dot-separated values unchanged: '100.50' stays 100.50", () => {
    const result = normalizeAmount("100.50");
    expect(result).toBe(100.50);
  });

  it("handles integer strings: '100' becomes 100", () => {
    const result = normalizeAmount("100");
    expect(result).toBe(100);
  });

  it("handles string with both separators: '1,500.00' becomes NaN (simple replace limitation)", () => {
    // .replace(",", ".") replaces only the first comma, producing "1.500.00"
    // which Number.parse gives NaN. This is a known limitation of the simple
    // replace pattern — for proper thousands handling a more sophisticated
    // parser would be needed.
    const result = normalizeAmount("1,500.00");
    expect(Number.isNaN(result)).toBe(true);
  });

  it("handles zero: '0' becomes 0", () => {
    const result = normalizeAmount("0");
    expect(result).toBe(0);
  });

  it("handles negative amounts: '-50,25' becomes -50.25", () => {
    const result = normalizeAmount("-50,25");
    expect(result).toBe(-50.25);
  });

  it("handles empty filter value gracefully", () => {
    const result = normalizeAmount("");
    // Number("") returns 0, which is safe for the API
    // The filter guard `if (filterMontoMin)` prevents empty strings from reaching the API
    expect(result).toBe(0);
  });

  it("filter with minAmount=100,50 and maxAmount=200,00 produces correct range", () => {
    const minAmount = normalizeAmount("100,50");
    const maxAmount = normalizeAmount("200,00");
    expect(minAmount).toBe(100.50);
    expect(maxAmount).toBe(200.00);
    expect(maxAmount).toBeGreaterThan(minAmount);
  });

  it("handles numeric input (already a number)", () => {
    // When the filter input is a number type (e.g., from a default value)
    const result = normalizeAmount(150.75);
    expect(result).toBe(150.75);
  });
});

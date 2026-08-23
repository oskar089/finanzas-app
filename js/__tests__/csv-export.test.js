import { describe, it, expect } from "vitest";

// ============================================================
// Regression: CSV export quoting + CSV import row cap
// ============================================================
// These import the REAL implementations from js/shared.js (the same ones
// used by exportCSV() and the fileInput import handler in js/app.js).

import {
  csvEscapeField,
  buildCsvRow,
  parseDelimited,
  exceedsBulkLimit,
  BULK_IMPORT_MAX_ROWS,
} from "../shared.js";

describe("csvEscapeField", () => {
  it("wraps a normal field in double quotes", () => {
    expect(csvEscapeField("Café con leche")).toBe('"Café con leche"');
  });

  it("keeps ';' inside the quoted field instead of splitting columns", () => {
    expect(csvEscapeField("café; medialuna")).toBe('"café; medialuna"');
  });

  it("doubles embedded double quotes", () => {
    expect(csvEscapeField('say "hi"')).toBe('"say ""hi"""');
  });

  it("preserves newlines inside the quoted field", () => {
    expect(csvEscapeField("linea1\nlinea2")).toBe('"linea1\nlinea2"');
  });

  it("quotes an empty result for null/undefined instead of emitting nothing", () => {
    expect(csvEscapeField(null)).toBe('""');
    expect(csvEscapeField(undefined)).toBe('""');
  });

  it("stringifies numbers", () => {
    expect(csvEscapeField(12.5)).toBe('"12.5"');
  });
});

describe("buildCsvRow", () => {
  it("joins every field quoted with ';'", () => {
    expect(buildCsvRow(["2026-01-15", "EXPENSE", "Comida", "Café", "-10"])).toBe(
      '"2026-01-15";"EXPENSE";"Comida";"Café";"-10"',
    );
  });

  it("a concept containing ';' is emitted quoted so RFC-4180 parsers keep it as one column", () => {
    const row = buildCsvRow(["2026-01-15", "EXPENSE", "Comida", "a;b", "-10"]);
    // The ';' survives inside the quotes — a spec-compliant reader treats
    // it as data, not a delimiter. (A naive split(';') would NOT.)
    expect(row).toBe('"2026-01-15";"EXPENSE";"Comida";"a;b";"-10"');
    expect(row).toContain('"a;b"');
  });

  it("header row builds with the same quoting discipline as data rows", () => {
    expect(buildCsvRow(["Fecha", "Tipo", "Categoría", "Concepto", "Monto"])).toBe(
      '"Fecha";"Tipo";"Categoría";"Concepto";"Monto"',
    );
  });
});

describe("parseDelimited (RFC 4180 compliant parser)", () => {
  it("parses a simple row without quotes", () => {
    const result = parseDelimited('a;b;c');
    expect(result).toEqual([['a', 'b', 'c']]);
  });

  it("parses multiple rows with LF", () => {
    const result = parseDelimited('a;b\nc;d');
    expect(result).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it("parses multiple rows with CRLF", () => {
    const result = parseDelimited('a;b\r\nc;d');
    expect(result).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it("handles quoted fields containing delimiter", () => {
    const result = parseDelimited('"a;b";c');
    expect(result).toEqual([['a;b', 'c']]);
  });

  it("handles quoted fields containing newlines", () => {
    const result = parseDelimited('"line1\nline2";c');
    expect(result).toEqual([['line1\nline2', 'c']]);
  });

  it("handles doubled quotes inside quoted field", () => {
    const result = parseDelimited('"say ""hi""";c');
    expect(result).toEqual([['say "hi"', 'c']]);
  });

  it("handles empty fields", () => {
    const result = parseDelimited('a;;c');
    expect(result).toEqual([['a', '', 'c']]);
  });

  it("handles quoted empty field", () => {
    const result = parseDelimited('"";b');
    expect(result).toEqual([['', 'b']]);
  });

  it("handles no trailing newline", () => {
    const result = parseDelimited('a;b');
    expect(result).toEqual([['a', 'b']]);
  });

  it("handles trailing newline without creating empty row", () => {
    const result = parseDelimited('a;b\n');
    expect(result).toEqual([['a', 'b']]);
  });

  it("handles custom delimiter", () => {
    const result = parseDelimited('a,b', ',');
    expect(result).toEqual([['a', 'b']]);
  });

  it("handles BOM at start (caller strips it from first cell)", () => {
    const result = parseDelimited('\uFEFFa;b');
    // parseDelimited is a low-level parser; BOM stripping is done by the caller (parsearCSV)
    expect(result).toEqual([['\uFEFFa', 'b']]);
  });

  it("handles complex real-world CSV with mixed quoting", () => {
    const csv = '"Fecha";"Tipo";"Categoría";"Concepto";"Monto"\n"2026-01-15";"gasto";"comida";"café; medialuna";"-10"';
    const result = parseDelimited(csv);
    expect(result).toEqual([
      ['Fecha', 'Tipo', 'Categoría', 'Concepto', 'Monto'],
      ['2026-01-15', 'gasto', 'comida', 'café; medialuna', '-10'],
    ]);
  });
});

describe("Round-trip: buildCsvRow → parseDelimited", () => {
  it("preserves simple fields", () => {
    const original = ["2026-01-15", "gasto", "comida", "café", "-10"];
    const csvRow = buildCsvRow(original);
    const parsed = parseDelimited(csvRow);
    expect(parsed).toEqual([original]);
  });

  it("preserves field with embedded delimiter", () => {
    const original = ["2026-01-15", "gasto", "comida", "café; medialuna", "-10"];
    const csvRow = buildCsvRow(original);
    const parsed = parseDelimited(csvRow);
    expect(parsed).toEqual([original]);
  });

  it("preserves field with embedded quotes", () => {
    const original = ["2026-01-15", "gasto", "comida", 'say "hi"', "-10"];
    const csvRow = buildCsvRow(original);
    const parsed = parseDelimited(csvRow);
    expect(parsed).toEqual([original]);
  });

  it("preserves field with embedded newlines", () => {
    const original = ["2026-01-15", "gasto", "comida", "line1\nline2", "-10"];
    const csvRow = buildCsvRow(original);
    const parsed = parseDelimited(csvRow);
    expect(parsed).toEqual([original]);
  });

  it("preserves field with both delimiter and quotes", () => {
    const original = ['2026-01-15', 'gasto', 'comida', 'café; "espresso"', "-10"];
    const csvRow = buildCsvRow(original);
    const parsed = parseDelimited(csvRow);
    expect(parsed).toEqual([original]);
  });

  it("preserves empty fields", () => {
    const original = ["2026-01-15", "", "comida", "", "-10"];
    const csvRow = buildCsvRow(original);
    const parsed = parseDelimited(csvRow);
    expect(parsed).toEqual([original]);
  });

  it("full multi-row round-trip with header", () => {
    const header = ["Fecha", "Tipo", "Categoría", "Concepto", "Monto"];
    const rows = [
      ["2026-01-15", "gasto", "comida", "café; medialuna", "-10"],
      ["2026-01-16", "ingreso", "sueldo", 'pago "mes"', "5000"],
      ["2026-01-17", "gasto", "transporte", "line1\nline2", "-50"],
    ];
    const csv = [buildCsvRow(header), ...rows.map(buildCsvRow)].join("\n");
    const parsed = parseDelimited(csv);
    expect(parsed).toEqual([header, ...rows]);
  });
});

describe("exceedsBulkLimit (mirrors backend bulkCreateSchema .max)", () => {
  it("accepts exactly the backend cap of rows", () => {
    expect(exceedsBulkLimit(BULK_IMPORT_MAX_ROWS)).toBe(false);
  });

  it("rejects one row above the backend cap", () => {
    expect(exceedsBulkLimit(BULK_IMPORT_MAX_ROWS + 1)).toBe(true);
  });

  it("accepts small and empty imports", () => {
    expect(exceedsBulkLimit(0)).toBe(false);
    expect(exceedsBulkLimit(1)).toBe(false);
    expect(exceedsBulkLimit(999)).toBe(false);
  });

  it("cap constant matches the backend limit of 1000", () => {
    expect(BULK_IMPORT_MAX_ROWS).toBe(1000);
  });
});

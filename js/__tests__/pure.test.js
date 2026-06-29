import { describe, it, expect } from "vitest";

// ============================================================
// Pure functions extracted from js/app.js
// ============================================================

function escapeHTML(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CATEGORIAS_GASTO = {
  alimentacion: "Alimentación",
  transporte: "Transporte",
  entretenimiento: "Entretenimiento",
  salud: "Salud",
  housing: "Vivienda",
  utilities: "Servicios",
  "otros-gasto": "Otros",
};

const CATEGORIAS_INGRESO = {
  sueldo: "Sueldo",
  freelance: "Freelance",
  inversiones: "Inversiones",
  "otros-ingreso": "Otros",
};

function getCategoriasPorTipo(tipo) {
  return tipo === "ingreso" ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO;
}

// ============================================================
// Tests: escapeHTML
// ============================================================

describe("escapeHTML", () => {
  it("escapes & < > \" ' characters", () => {
    const result = escapeHTML("<script>alert(\"xss\")</script>");
    expect(result).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
    );
  });

  it("escapes ampersands first to avoid double-escaping", () => {
    expect(escapeHTML("a & b")).toBe("a &amp; b");
  });

  it("returns empty string for null", () => {
    expect(escapeHTML(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(escapeHTML(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(escapeHTML("")).toBe("");
  });

  it("passes through safe strings unchanged", () => {
    expect(escapeHTML("Hola mundo")).toBe("Hola mundo");
    expect(escapeHTML("123")).toBe("123");
  });

  it("escapes single quotes", () => {
    expect(escapeHTML("it's a test")).toBe("it&#39;s a test");
  });
});

// ============================================================
// Tests: getCategoriasPorTipo
// ============================================================

describe("getCategoriasPorTipo", () => {
  it("returns income categories when tipo is 'ingreso'", () => {
    const cats = getCategoriasPorTipo("ingreso");
    expect(cats).toHaveProperty("sueldo");
    expect(cats).toHaveProperty("freelance");
    expect(cats).toHaveProperty("inversiones");
    expect(cats).toHaveProperty("otros-ingreso");
    expect(cats.sueldo).toBe("Sueldo");
  });

  it("does NOT include expense categories when tipo is 'ingreso'", () => {
    const cats = getCategoriasPorTipo("ingreso");
    expect(cats).not.toHaveProperty("alimentacion");
    expect(cats).not.toHaveProperty("transporte");
  });

  it("returns expense categories when tipo is 'gasto'", () => {
    const cats = getCategoriasPorTipo("gasto");
    expect(cats).toHaveProperty("alimentacion");
    expect(cats).toHaveProperty("transporte");
    expect(cats).toHaveProperty("entretenimiento");
    expect(cats).toHaveProperty("salud");
    expect(cats).toHaveProperty("housing");
    expect(cats).toHaveProperty("utilities");
    expect(cats).toHaveProperty("otros-gasto");
    expect(cats.alimentacion).toBe("Alimentación");
  });

  it("does NOT include income categories when tipo is 'gasto'", () => {
    const cats = getCategoriasPorTipo("gasto");
    expect(cats).not.toHaveProperty("sueldo");
    expect(cats).not.toHaveProperty("freelance");
  });

  it("returns expense categories for unknown tipo (defaults to gasto)", () => {
    const cats = getCategoriasPorTipo("unknown");
    expect(cats).toHaveProperty("alimentacion");
    expect(cats).not.toHaveProperty("sueldo");
  });
});

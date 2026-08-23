import { describe, it, expect, vi, afterEach } from "vitest";

// ============================================================
// Central error handler — message disclosure policy
// ============================================================
// Unexpected (non-ApiError) errors must answer a generic message in
// production while keeping full detail in development. Zod and Prisma
// validation branches must map to 400 instead of leaking through the
// 500 default.
// ============================================================

import { errorHandler, ApiError } from "../middleware/errorHandler.js";

function createRes() {
  const state = { statusCode: null, body: null };
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

const ENV_BACKUP = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = ENV_BACKUP;
  vi.restoreAllMocks();
});

describe("errorHandler — unexpected error gating", () => {
  it("returns a generic message in production without stack or internals", () => {
    process.env.NODE_ENV = "production";
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = createRes();
    errorHandler(new Error("secret: /etc/db/password"), {}, res, vi.fn());

    expect(res.state.statusCode).toBe(500);
    expect(res.state.body).toEqual({ error: "Internal server error" });
  });

  it("keeps the detailed message and stack in development", () => {
    process.env.NODE_ENV = "development";
    vi.spyOn(console, "error").mockImplementation(() => {});

    const err = new Error("Cannot read properties of undefined");
    const res = createRes();
    errorHandler(err, {}, res, vi.fn());

    expect(res.state.statusCode).toBe(500);
    expect(res.state.body.error).toBe("Cannot read properties of undefined");
    expect(res.state.body.stack).toBeDefined();
  });

  it("always passes ApiError messages through, even in production", () => {
    process.env.NODE_ENV = "production";
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = createRes();
    errorHandler(new ApiError(403, "You do not have admin access"), {}, res, vi.fn());

    expect(res.state.statusCode).toBe(403);
    expect(res.state.body.error).toBe("You do not have admin access");
    expect(res.state.body).not.toHaveProperty("stack");
  });
});

describe("errorHandler — validation branches", () => {
  it("maps ZodError to 400 with flattened issues", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const zodError = Object.assign(new Error("Validation failed"), {
      name: "ZodError",
      flatten: () => ({ formErrors: [], fieldErrors: { amount: ["positive"] } }),
    });

    const res = createRes();
    errorHandler(zodError, {}, res, vi.fn());

    expect(res.state.statusCode).toBe(400);
    expect(res.state.body.error).toBe("Validation error");
    expect(res.state.body.issues).toEqual({
      formErrors: [],
      fieldErrors: { amount: ["positive"] },
    });
  });

  it("hides PrismaClientValidationError details in production", () => {
    process.env.NODE_ENV = "production";
    vi.spyOn(console, "error").mockImplementation(() => {});

    const prismaError = Object.assign(new Error("Unknown arg `categoryId`"), {
      name: "PrismaClientValidationError",
    });

    const res = createRes();
    errorHandler(prismaError, {}, res, vi.fn());

    expect(res.state.statusCode).toBe(400);
    expect(res.state.body).toEqual({ error: "Validation error" });
  });

  it("keeps PrismaClientValidationError details in development", () => {
    process.env.NODE_ENV = "development";
    vi.spyOn(console, "error").mockImplementation(() => {});

    const prismaError = Object.assign(new Error("Unknown arg `categoryId`"), {
      name: "PrismaClientValidationError",
    });

    const res = createRes();
    errorHandler(prismaError, {}, res, vi.fn());

    expect(res.state.statusCode).toBe(400);
    expect(res.state.body.details).toContain("categoryId");
  });
});

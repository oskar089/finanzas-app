/**
 * Global error handler middleware
 */
export const errorHandler = (err, req, res, next) => {
  console.error("Error:", err);

  // Zod validation errors → client input problem, not a server fault.
  // Without this branch ZodError falls through to the 500 default and leaks
  // its message; issues are safe to return (they echo the client's payload).
  if (err.name === "ZodError") {
    return res.status(400).json({
      error: "Validation error",
      issues: err.flatten?.() ?? undefined,
    });
  }

  // Prisma validation error — its message embeds schema/query internals, so
  // details stay dev-only (same gating policy as unexpected errors below).
  if (err.name === "PrismaClientValidationError") {
    return res.status(400).json({
      error: "Validation error",
      ...(process.env.NODE_ENV === "development" && { details: err.message }),
    });
  }

  // Prisma unique constraint error
  if (err.code === "P2002") {
    return res.status(409).json({
      error: "Resource already exists",
      field: err.meta?.target,
    });
  }

  // Prisma not found error
  if (err.code === "P2025") {
    return res.status(404).json({
      error: "Resource not found",
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ error: "Invalid token" });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ error: "Token expired" });
  }

  // Default error.
  // Unexpected (non-ApiError) errors never expose their message in
  // production — it can carry internals (paths, queries, driver errors).
  // Details are always logged above for server-side debugging.
  const isExpected = err instanceof ApiError;
  const statusCode = err.statusCode || 500;
  const detailedMessage =
    err.message || "Internal server error";
  const message =
    process.env.NODE_ENV === "production" && !isExpected && statusCode >= 500
      ? "Internal server error"
      : detailedMessage;

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "ApiError";
  }
}

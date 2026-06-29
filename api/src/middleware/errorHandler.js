/**
 * Global error handler middleware
 */
export const errorHandler = (err, req, res, next) => {
  console.error("Error:", err);

  // Prisma validation error
  if (err.name === "PrismaClientValidationError") {
    return res.status(400).json({
      error: "Validation error",
      details: err.message,
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

  // Default error
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";

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

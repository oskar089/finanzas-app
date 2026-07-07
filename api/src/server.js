import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import passport from "passport";
import "./config/passport.js"; // Initialize Passport strategies

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_PATH = path.join(__dirname, "..", "..");

// Load environment variables
dotenv.config();

// Validate required secrets at startup
if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET environment variable is required");
  process.exit(1);
}

// Import routes
import authRoutes from "./routes/auth.js";
import accountRoutes from "./routes/accounts.js";
import transactionRoutes from "./routes/transactions.js";
import budgetRoutes from "./routes/budgets.js";
import dashboardRoutes from "./routes/dashboard.js";
import familyRoutes from "./routes/family.js";
import categoryRoutes from "./routes/categories.js";

// Import middleware
import { errorHandler } from "./middleware/errorHandler.js";
import { authenticate } from "./middleware/auth.js";

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================

// Helmet - Security headers (configurado para permitir CDN)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://accounts.google.com",
          "https://appleid.cdn-apple.com",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://accounts.google.com",
          "https://appleid.cdn-apple.com",
        ],
        imgSrc: ["'self'", "data:"],
        connectSrc: [
          "'self'",
          "https://accounts.google.com",
          "https://appleid.apple.com",
        ],
        fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
        frameSrc: [
          "'self'",
          "https://accounts.google.com",
          "https://appleid.apple.com",
        ],
      },
    },
  })
);

// CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // Stricter limit for auth endpoints
  message: "Too many authentication attempts, please try again later.",
});

app.use("/api/", limiter);
app.use("/api/auth/", authLimiter);

// ============================================================
// BODY PARSING
// ============================================================

app.use(express.json({ limit: "500kb" }));
app.use(express.urlencoded({ extended: true }));

// ============================================================
// PASSPORT INITIALIZATION (Stateless OAuth)
// ============================================================

app.use(passport.initialize());

// ============================================================
// STATIC FILES (Frontend)
// ============================================================

app.use(express.static(FRONTEND_PATH));

// ============================================================
// ROUTES
// ============================================================

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/accounts", authenticate, accountRoutes);
app.use("/api/transactions", authenticate, transactionRoutes);
app.use("/api/budgets", authenticate, budgetRoutes);
app.use("/api/dashboard", authenticate, dashboardRoutes);
app.use("/api/family", authenticate, familyRoutes);
app.use("/api/categories", authenticate, categoryRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler
app.use(errorHandler);

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {
  console.log(`🚀 FinanceApp API running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
});

export default app;

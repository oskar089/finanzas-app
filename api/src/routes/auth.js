import { Router } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import {
  authenticate,
  generateToken,
  generateRefreshToken,
  verifyRefresh,
  rotateRefresh,
  COOKIE_OPTIONS,
  REFRESH_COOKIE_OPTIONS,
} from "../middleware/auth.js";
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
} from "../validations/schemas.js";
import { ApiError } from "../middleware/errorHandler.js";
import passport from "../config/passport.js";

const router = Router();

/**
 * Default categories seeded on registration matching spec requirements.
 * INCOME: Salary, Freelance
 * EXPENSE: Rent, Food, Transport, Utilities, Entertainment, Other
 */
export const DEFAULT_CATEGORIES = [
  { name: "Sueldo", type: "INCOME", sortOrder: 0 },
  { name: "Freelance", type: "INCOME", sortOrder: 1 },
  { name: "Vivienda", type: "EXPENSE", sortOrder: 0 },
  { name: "Alimentación", type: "EXPENSE", sortOrder: 1 },
  { name: "Transporte", type: "EXPENSE", sortOrder: 2 },
  { name: "Servicios", type: "EXPENSE", sortOrder: 3 },
  { name: "Entretenimiento", type: "EXPENSE", sortOrder: 4 },
  { name: "Otros", type: "EXPENSE", sortOrder: 5 },
];

/**
 * POST /api/auth/register
 * Register a new user and seed default categories within a $transaction.
 * Sets JWT and refresh token as HttpOnly cookies.
 */
router.post("/register", async (req, res, next) => {
  try {
    // Validate input
    const validatedData = registerSchema.parse(req.body);

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    // Create user + seed default categories atomically within $transaction
    // Duplicate email is caught inside the transaction via unique constraint
    const result = await prisma.$transaction(async (tx) => {
      // Create user — Prisma throws P2002 if email already exists
      const user = await tx.user.create({
        data: {
          email: validatedData.email,
          password: hashedPassword,
          name: validatedData.name,
        },
        select: {
          id: true,
          email: true,
          name: true,
          defaultCurrency: true,
          createdAt: true,
        },
      });

      // Seed default categories
      await tx.category.createMany({
        data: DEFAULT_CATEGORIES.map((cat) => ({
          userId: user.id,
          name: cat.name,
          type: cat.type,
          sortOrder: cat.sortOrder,
        })),
      });

      return user;
    });

    // Generate tokens
    const token = generateToken(result.id);
    const { rawToken } = await generateRefreshToken(result.id);

    // Set HttpOnly cookies
    res.cookie("jwt", token, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie("refresh", rawToken, {
      ...REFRESH_COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      message: "User registered successfully",
      user: result,
      token, // backward compat — Bearer fallback
    });
  } catch (error) {
    // Handle duplicate email from Prisma unique constraint
    if (error.code === "P2002" && error.meta?.target?.includes("email")) {
      return res.status(409).json({ error: "Email already in use" });
    }
    next(error);
  }
});

// ============================================================
// OAuth Account Linking & Helpers
// ============================================================

/**
 * Find or create a user from an OAuth provider profile.
 *
 * Flow:
 * 1. Look up by providerId (googleId / appleId) → if found, login
 * 2. If not found → look up by email
 * 3. If found by email → link: set provider ID on existing user
 * 4. If not found → create user with password=null, seed default categories
 * 5. Return user
 */
async function findOrCreateOAuthUser({ provider, providerId, email, name }) {
  const providerField = provider === "google" ? "googleId" : "appleId";

  // 1. Look up by provider ID
  const existingById = await prisma.user.findUnique({
    where: { [providerField]: providerId },
  });

  if (existingById) {
    return existingById;
  }

  // 3. If email exists, link account
  if (email) {
    const existingByEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingByEmail) {
      return prisma.user.update({
        where: { id: existingByEmail.id },
        data: { [providerField]: providerId },
      });
    }
  }

  // 4. Create new user + seed default categories atomically
  // NOTE: If no email is provided by the OAuth provider, a synthetic email is used.
  // This means the user won't be able to receive email notifications or reset a password.
  // A future enhancement should prompt the user to set an email after first OAuth login.
  const uniqueEmail = email || `${providerId}@${provider}.local`;
  if (!email) {
    console.warn(
      `⚠️  OAuth user created with synthetic email: ${uniqueEmail}. ` +
      "Consider prompting for email verification.",
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: uniqueEmail,
        name: name || "User",
        password: null,
        [providerField]: providerId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        defaultCurrency: true,
        createdAt: true,
      },
    });

    // Seed default categories
    await tx.category.createMany({
      data: DEFAULT_CATEGORIES.map((cat) => ({
        userId: user.id,
        name: cat.name,
        type: cat.type,
        sortOrder: cat.sortOrder,
      })),
    });

    return user;
  });

  return result;
}

/**
 * Handle OAuth callback: authenticate via Passport, link/find/create user,
 * generate JWT, redirect to callback page.
 */
function handleOAuthCallback(provider) {
  return (req, res, next) => {
    passport.authenticate(
      provider,
      { session: false },
      async (err, profile) => {
        if (err || !profile) {
          const errorMsg = err ? err.message : "authentication_failed";
          return res.redirect(
            `${process.env.FRONTEND_URL || "http://localhost:5173"}/auth/callback.html?error=${encodeURIComponent(errorMsg)}`
          );
        }

        try {
          const user = await findOrCreateOAuthUser({
            provider: profile.provider,
            providerId: profile.providerId,
            email: profile.email,
            name: profile.name,
          });

          const token = generateToken(user.id);
          const { rawToken } = await generateRefreshToken(user.id);

          // Set HttpOnly cookies
          res.cookie("jwt", token, {
            ...COOKIE_OPTIONS,
            maxAge: 15 * 60 * 1000,
          });
          res.cookie("refresh", rawToken, {
            ...REFRESH_COOKIE_OPTIONS,
            maxAge: 7 * 24 * 60 * 60 * 1000,
          });

          res.redirect(
            `${process.env.FRONTEND_URL || "http://localhost:5173"}/auth/callback.html?token=${token}`
          );
        } catch (error) {
          res.redirect(
            `${process.env.FRONTEND_URL || "http://localhost:5173"}/auth/callback.html?error=${encodeURIComponent("account_creation_failed")}`
          );
        }
      }
    )(req, res, next);
  };
}

// ============================================================
// OAuth Strategy Guard Middleware
// ============================================================

function requireOAuthStrategy(strategyName) {
  return (req, res, next) => {
    if (passport._strategy(strategyName)) {
      return next();
    }
    res.status(501).json({
      error: `OAuth provider "${strategyName}" is not configured. Set the required environment variables to enable it.`,
    });
  };
}

// ============================================================
// Google OAuth Routes
// ============================================================

/**
 * GET /api/auth/google
 * Initiate Google OAuth login
 */
router.get(
  "/google",
  requireOAuthStrategy("google"),
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

/**
 * GET /api/auth/google/callback
 * Google OAuth callback — link/find/create user, generate JWT, redirect
 */
router.get(
  "/google/callback",
  requireOAuthStrategy("google"),
  handleOAuthCallback("google")
);

// ============================================================
// Apple OAuth Routes
// ============================================================

/**
 * GET /api/auth/apple
 * Initiate Apple Sign In
 */
router.get(
  "/apple",
  requireOAuthStrategy("apple"),
  passport.authenticate("apple", {
    session: false,
  })
);

/**
 * GET /api/auth/apple/callback
 * Apple OAuth callback — link/find/create user, generate JWT, redirect
 */
router.get(
  "/apple/callback",
  requireOAuthStrategy("apple"),
  handleOAuthCallback("apple")
);

/**
 * POST /api/auth/login
 * Login user — sets JWT and refresh token as HttpOnly cookies.
 */
router.post("/login", async (req, res, next) => {
  try {
    // Validate input
    const validatedData = loginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (!user) {
      throw new ApiError(401, "Invalid email or password");
    }

    // Check if user registered via OAuth (no password set)
    if (user.password === null) {
      throw new ApiError(
        401,
        "Account registered via social login. Please use Google or Apple to sign in."
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      validatedData.password,
      user.password
    );

    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid email or password");
    }

    // Generate tokens
    const token = generateToken(user.id);
    const { rawToken } = await generateRefreshToken(user.id);

    // Set HttpOnly cookies
    res.cookie("jwt", token, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie("refresh", rawToken, {
      ...REFRESH_COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        defaultCurrency: user.defaultCurrency,
      },
      token, // backward compat — Bearer fallback
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/refresh
 * Refresh token rotation endpoint.
 * Validates the refresh token from cookie, rotates it, and issues new JWT + refresh pair.
 */
router.post("/refresh", async (req, res, next) => {
  try {
    const rawToken = req.cookies?.refresh;

    if (!rawToken) {
      return res.status(401).json({ error: "No refresh token provided" });
    }

    // Verify the refresh token
    const tokenRecord = await verifyRefresh(rawToken);

    if (!tokenRecord) {
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }

    // Rotate the token
    const result = await rotateRefresh(tokenRecord, rawToken);

    if (result.theftDetected) {
      // Token was reused — theft detected, all tokens invalidated
      res.clearCookie("jwt", COOKIE_OPTIONS);
      res.clearCookie("refresh", REFRESH_COOKIE_OPTIONS);
      return res.status(401).json({
        error: "Session terminated due to suspected token theft. Please log in again.",
      });
    }

    // Issue new JWT
    const newToken = generateToken(tokenRecord.userId);

    // Set new cookies
    res.cookie("jwt", newToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000,
    });
    res.cookie("refresh", result.rawToken, {
      ...REFRESH_COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: "Token refreshed successfully",
      token: newToken, // backward compat
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        defaultCurrency: true,
        createdAt: true,
      },
    });

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put("/profile", authenticate, async (req, res, next) => {
  try {
    const validatedData = updateProfileSchema.parse(req.body);

    // If email is changing, check uniqueness
    if (validatedData.email && validatedData.email !== req.user.email) {
      const existing = await prisma.user.findUnique({
        where: { email: validatedData.email },
      });
      if (existing) {
        throw new ApiError(409, "Email already in use");
      }
    }

    // Hash password if provided (allows OAuth users to set a password later)
    const updateData = { ...validatedData };
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 12);
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        defaultCurrency: true,
        updatedAt: true,
      },
    });

    res.json({
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

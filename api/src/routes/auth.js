import { Router } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import { authenticate, generateToken } from "../middleware/auth.js";
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
 * Register a new user and seed default categories
 */
router.post("/register", async (req, res, next) => {
  try {
    // Validate input
    const validatedData = registerSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      throw new ApiError(409, "Email already registered");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    // Create user + seed default categories atomically
    const result = await prisma.$transaction(async (tx) => {
      // Create user
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

    // Generate token
    const token = generateToken(result.id);

    res.status(201).json({
      message: "User registered successfully",
      user: result,
      token,
    });
  } catch (error) {
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
 * Login user
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

    // Generate token
    const token = generateToken(user.id);

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        defaultCurrency: user.defaultCurrency,
      },
      token,
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

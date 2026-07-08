import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";

/**
 * Authentication middleware
 * Reads JWT from HttpOnly cookie first, falls back to Bearer header.
 * Attaches user to request on success.
 */
export const authenticate = async (req, res, next) => {
  try {
    // 1. Try HttpOnly cookie first
    let token = req.cookies?.jwt;

    // 2. Fallback to Bearer header (backward compat during transition)
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        defaultCurrency: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    next(error);
  }
};

/**
 * Generate JWT token
 */
export const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
  });
};

/**
 * Generate a refresh token, store hashed version in DB.
 * Returns the raw token string to set as cookie.
 */
export const generateRefreshToken = async (userId) => {
  // Generate a cryptographically random token
  const rawToken = crypto.randomBytes(48).toString("hex");
  const hashedToken = await bcrypt.hash(rawToken, 10);
  const familyId = crypto.randomUUID();

  // Store hashed token in DB
  await prisma.refreshToken.create({
    data: {
      userId,
      token: hashedToken,
      familyId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  return { rawToken, familyId };
};

/**
 * Verify a refresh token — returns userId if valid, null otherwise.
 * On success, returns the matched DB record for rotation.
 */
export const verifyRefresh = async (rawToken) => {
  // Find all non-expired tokens for potential matching
  const tokens = await prisma.refreshToken.findMany({
    where: {
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      userId: true,
      token: true,
      familyId: true,
    },
  });

  // Find matching token by bcrypt comparison
  for (const stored of tokens) {
    const isValid = await bcrypt.compare(rawToken, stored.token);
    if (isValid) {
      return stored;
    }
  }

  return null;
};

/**
 * Rotate a refresh token: invalidate old, issue new pair.
 * If the old token was already rotated (theft detection), invalidate all tokens in family.
 */
export const rotateRefresh = async (oldTokenRecord, rawOldToken) => {
  const { userId, id, familyId } = oldTokenRecord;

  // Check if this token was already rotated (stolen token detection)
  const alreadyRotated = await prisma.refreshToken.findFirst({
    where: {
      familyId,
      // A rotated token's family has a newer token with same familyId
      // If the old token is still valid but there's a newer one, it's been reused
    },
    orderBy: { createdAt: "desc" },
  });

  // If the matched record is NOT the latest in its family, it's a reuse attempt
  const latestInFamily = await prisma.refreshToken.findFirst({
    where: { familyId },
    orderBy: { createdAt: "desc" },
  });

  if (latestInFamily && latestInFamily.id !== id) {
    // Theft detection: this token was already rotated
    // Invalidate ALL tokens for this user
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
    return { theftDetected: true };
  }

  // Invalidate the old token
  await prisma.refreshToken.delete({
    where: { id },
  });

  // Issue new pair within same family
  const rawToken = crypto.randomBytes(48).toString("hex");
  const hashedToken = await bcrypt.hash(rawToken, 10);

  await prisma.refreshToken.create({
    data: {
      userId,
      token: hashedToken,
      familyId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return { rawToken, familyId, theftDetected: false };
};

/**
 * Cookie configuration helper
 */
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/auth/refresh",
};

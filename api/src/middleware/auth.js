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

    // Algorithm pinned to match signing (prevents algorithm-confusion attacks)
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });

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
    algorithm: "HS256",
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
  });
};

/**
 * Length of the raw-token prefix stored as tokenHint. 8 hex chars (32 bits)
 * narrow candidates to ~1 row without weakening bcrypt: an attacker who
 * reads the DB still cannot invert a hint into a usable token.
 */
export const REFRESH_HINT_LENGTH = 8;

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
      // Prefix of the raw token, NOT derivable from the hash — it exists so
      // verifyRefresh can find this row by index instead of scanning all rows.
      tokenHint: rawToken.slice(0, REFRESH_HINT_LENGTH),
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
  // Index-narrowed lookup: only rows sharing the presented token's prefix can
  // possibly match, so bcrypt compares ~1 hash instead of every live token.
  const candidates = await prisma.refreshToken.findMany({
    where: {
      tokenHint: rawToken.slice(0, REFRESH_HINT_LENGTH),
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      userId: true,
      token: true,
      familyId: true,
    },
  });

  for (const stored of candidates) {
    const isValid = await bcrypt.compare(rawToken, stored.token);
    if (isValid) {
      return stored;
    }
  }

  return null;
};

/**
 * Rotate a refresh token: atomically consume the old one, issue new pair.
 * Consumption is a single atomic DELETE guarded by both id and stored hash,
 * so concurrent requests presenting the same token cannot double-issue:
 * only the first deleteMany wins (count === 1); losers get count === 0 and
 * are treated as token reuse. Reuse revokes the entire token family.
 */
export const rotateRefresh = async (oldTokenRecord, rawOldToken) => {
  const { userId, id, familyId, token } = oldTokenRecord;

  // Defense-in-depth reuse check: if the matched record is NOT the latest
  // in its family, it was already rotated once — reuse attempt.
  const latestInFamily = await prisma.refreshToken.findFirst({
    where: { familyId },
    orderBy: { createdAt: "desc" },
  });

  if (!latestInFamily || latestInFamily.id !== id) {
    // Theft detection: revoke every token in this family.
    await prisma.refreshToken.deleteMany({
      where: { familyId },
    });
    return { theftDetected: true };
  }

  // Atomic one-time consumption. If count is 0, a concurrent request already
  // consumed this exact record (same id + same hash) — treat as reuse.
  const claimed = await prisma.refreshToken.deleteMany({
    where: { id, token },
  });

  if (claimed.count === 0) {
    // Concurrent rotation detected — revoke the family so at most one
    // new pair can ever survive.
    await prisma.refreshToken.deleteMany({
      where: { familyId },
    });
    return { theftDetected: true };
  }

  // Issue new pair within same family
  const rawToken = crypto.randomBytes(48).toString("hex");
  const hashedToken = await bcrypt.hash(rawToken, 10);

  await prisma.refreshToken.create({
    data: {
      userId,
      token: hashedToken,
      tokenHint: rawToken.slice(0, REFRESH_HINT_LENGTH),
      familyId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  return { rawToken, familyId, theftDetected: false };
};

/**
 * Best-effort revocation of the refresh-token family that a raw token
 * belongs to. Returns true when a matching token was found and its
 * whole family was revoked; false when nothing matched.
 */
export const revokeRefreshFamily = async (rawToken) => {
  const tokenRecord = await verifyRefresh(rawToken);
  if (!tokenRecord) {
    return false;
  }
  await prisma.refreshToken.deleteMany({
    where: { familyId: tokenRecord.familyId },
  });
  return true;
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

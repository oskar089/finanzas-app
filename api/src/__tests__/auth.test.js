import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

// ============================================================
// Auth middleware unit tests
// ============================================================

// Mock prisma before importing auth middleware
vi.mock("../lib/prisma.js", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

// Import after mock is set up
import {
  authenticate,
  generateToken,
  generateRefreshToken,
  verifyRefresh,
  rotateRefresh,
  COOKIE_OPTIONS,
  REFRESH_COOKIE_OPTIONS,
} from "../middleware/auth.js";

import prisma from "../lib/prisma.js";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = "test-secret";
});

// ============================================================
// Task 1.11: Cookie auth flow tests
// ============================================================

describe("authenticate middleware — cookie reading", () => {
  function createReqRes(cookieJwt, authHeader) {
    const req = {
      cookies: cookieJwt ? { jwt: cookieJwt } : {},
      headers: authHeader ? { authorization: authHeader } : {},
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    return { req, res };
  }

  it("reads JWT from HttpOnly cookie when present", async () => {
    const token = jwt.sign({ userId: "user-1" }, process.env.JWT_SECRET);
    const { req, res } = createReqRes(token, null);

    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
      defaultCurrency: "USD",
    });

    const next = vi.fn();
    await authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe("user-1");
  });

  it("falls back to Bearer header when no cookie is present", async () => {
    const token = jwt.sign({ userId: "user-2" }, process.env.JWT_SECRET);
    const { req, res } = createReqRes(null, `Bearer ${token}`);

    prisma.user.findUnique.mockResolvedValue({
      id: "user-2",
      email: "test2@example.com",
      name: "Test User 2",
      defaultCurrency: "USD",
    });

    const next = vi.fn();
    await authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe("user-2");
  });

  it("returns 401 when no token is provided", async () => {
    const { req, res } = createReqRes(null, null);
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "No token provided" })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when token is invalid", async () => {
    const { req, res } = createReqRes("invalid-token", null);
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Invalid token" })
    );
  });

  it("returns 401 when user is not found in DB", async () => {
    const token = jwt.sign({ userId: "nonexistent" }, process.env.JWT_SECRET);
    const { req, res } = createReqRes(token, null);

    prisma.user.findUnique.mockResolvedValue(null);

    const next = vi.fn();
    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "User not found" })
    );
  });

  it("prefers cookie over Bearer header when both are present", async () => {
    const cookieToken = jwt.sign({ userId: "cookie-user" }, process.env.JWT_SECRET);
    const bearerToken = jwt.sign({ userId: "bearer-user" }, process.env.JWT_SECRET);
    const { req, res } = createReqRes(cookieToken, `Bearer ${bearerToken}`);

    prisma.user.findUnique.mockResolvedValue({
      id: "cookie-user",
      email: "cookie@example.com",
      name: "Cookie User",
      defaultCurrency: "USD",
    });

    const next = vi.fn();
    await authenticate(req, res, next);

    expect(req.user.id).toBe("cookie-user");
  });
});

describe("generateToken with 15m expiry", () => {
  it("generates a valid JWT with 15 minute expiry", () => {
    const token = generateToken("user-1");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.userId).toBe("user-1");
    // exp - iat should be ~15 minutes (900 seconds)
    const expSeconds = decoded.exp - decoded.iat;
    expect(expSeconds).toBe(900);
  });
});

// ============================================================
// Task 1.12: Refresh token rotation tests
// ============================================================

describe("generateRefreshToken", () => {
  it("creates a refresh token record and returns raw token", async () => {
    prisma.refreshToken.create.mockResolvedValue({
      id: "rt-1",
      userId: "user-1",
      familyId: "family-1",
      token: "$2b$10$hashed",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const result = await generateRefreshToken("user-1");

    expect(result).toHaveProperty("rawToken");
    expect(result).toHaveProperty("familyId");
    expect(result.rawToken).toBeTruthy();
    expect(typeof result.rawToken).toBe("string");
    expect(result.rawToken.length).toBe(96); // 48 bytes -> hex = 96 chars
    expect(prisma.refreshToken.create).toHaveBeenCalledOnce();
  });
});

describe("verifyRefresh", () => {
  it("returns null when no tokens match", async () => {
    prisma.refreshToken.findMany.mockResolvedValue([]);
    const result = await verifyRefresh("any-token");
    expect(result).toBeNull();
  });
});

describe("rotateRefresh", () => {
  it("invalidates old token and issues new one in same family", async () => {
    const tokenRecord = {
      id: "rt-old",
      userId: "user-1",
      familyId: "family-1",
      token: "hashed-old",
    };

    // Latest in family is the same record
    prisma.refreshToken.findFirst.mockResolvedValue(tokenRecord);
    // Atomic consumption claim wins (count === 1)
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
    prisma.refreshToken.create.mockResolvedValue({
      id: "rt-new",
      userId: "user-1",
      familyId: "family-1",
      token: "$2b$10$newhash",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const result = await rotateRefresh(tokenRecord, "raw-old-token");

    expect(result.theftDetected).toBe(false);
    expect(result).toHaveProperty("rawToken");
    expect(result).toHaveProperty("familyId");
    // Consumption must be an atomic guarded claim on id + stored hash
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { id: "rt-old", token: "hashed-old" },
    });
    expect(prisma.refreshToken.create).toHaveBeenCalledOnce();
  });

  it("detects token reuse (theft) and invalidates the whole family", async () => {
    const oldRecord = {
      id: "rt-old",
      userId: "user-1",
      familyId: "family-1",
      token: "hashed-old",
    };

    // Simulate that the latest token in family is different (already rotated)
    prisma.refreshToken.findFirst.mockResolvedValue({
      id: "rt-newer",
      userId: "user-1",
      familyId: "family-1",
    });

    const result = await rotateRefresh(oldRecord, "raw-old-token");

    expect(result.theftDetected).toBe(true);
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { familyId: "family-1" },
    });
  });

  it("treats lost atomic claim (count === 0) as reuse and revokes the family", async () => {
    // Simulates two concurrent requests presenting the same refresh token:
    // this request passed verifyRefresh but another one consumed the record first.
    const tokenRecord = {
      id: "rt-old",
      userId: "user-1",
      familyId: "family-1",
      token: "hashed-old",
    };

    prisma.refreshToken.findFirst.mockResolvedValue(tokenRecord);
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

    const result = await rotateRefresh(tokenRecord, "raw-old-token");

    expect(result.theftDetected).toBe(true);
    // No new pair may be issued for a lost claim
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { familyId: "family-1" },
    });
  });
});

// ============================================================
// Cookie configuration tests
// ============================================================

describe("cookie configuration", () => {
  it("sets HttpOnly and SameSite=Lax on JWT cookie", () => {
    expect(COOKIE_OPTIONS.httpOnly).toBe(true);
    expect(COOKIE_OPTIONS.sameSite).toBe("lax");
    expect(COOKIE_OPTIONS.path).toBe("/");
  });

  it("sets HttpOnly and scoped path for refresh cookie", () => {
    expect(REFRESH_COOKIE_OPTIONS.httpOnly).toBe(true);
    expect(REFRESH_COOKIE_OPTIONS.sameSite).toBe("lax");
    expect(REFRESH_COOKIE_OPTIONS.path).toBe("/api/auth/refresh");
  });

  it("sets secure flag only in production", () => {
    // In test environment NODE_ENV is undefined, so secure should be false
    expect(COOKIE_OPTIONS.secure).toBe(false);
  });
});

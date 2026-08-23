import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

// ============================================================
// Refresh-token hint narrowing (O(1) candidate lookup)
// ============================================================
// verifyRefresh used to bcrypt-compare the presented token against EVERY
// stored hash. The tokenHint prefix lets one indexed query narrow
// candidates to ~1 row before a single bcrypt compare. Theft detection
// (family revocation on reuse) is unchanged and re-verified here.
// ============================================================

vi.mock("../lib/prisma.js", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import {
  generateRefreshToken,
  verifyRefresh,
  rotateRefresh,
  REFRESH_HINT_LENGTH,
} from "../middleware/auth.js";
import prisma from "../lib/prisma.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("REFRESH_HINT_LENGTH", () => {
  it("is 8 characters", () => {
    expect(REFRESH_HINT_LENGTH).toBe(8);
  });
});

describe("generateRefreshToken — stores lookup hint", () => {
  it("persists tokenHint as the raw token prefix", async () => {
    prisma.refreshToken.create.mockResolvedValue({ id: "rt-1" });

    const { rawToken } = await generateRefreshToken("user-1");

    const created = prisma.refreshToken.create.mock.calls[0][0].data;
    expect(created.tokenHint).toBe(rawToken.slice(0, REFRESH_HINT_LENGTH));
  });
});

describe("verifyRefresh — narrowed candidate lookup", () => {
  it("queries only rows sharing the presented token's prefix", async () => {
    prisma.refreshToken.findMany.mockResolvedValue([]);

    await verifyRefresh("abcdef1234567890");

    const args = prisma.refreshToken.findMany.mock.calls[0][0];
    expect(args.where.tokenHint).toBe("abcdef12");
    // Expiry filtering must survive the narrowing change
    expect(args.where.expiresAt).toEqual({ gt: expect.any(Date) });
  });

  it("returns the record when bcrypt matches among hinted candidates", async () => {
    const rawToken = "a".repeat(96);
    const storedHash = await bcrypt.hash(rawToken, 10);

    prisma.refreshToken.findMany.mockResolvedValue([
      { id: "rt-1", userId: "user-1", token: storedHash, familyId: "f-1" },
    ]);

    const result = await verifyRefresh(rawToken);

    expect(result).not.toBeNull();
    expect(result.id).toBe("rt-1");
    expect(result.familyId).toBe("f-1");
  });

  it("returns null when the hashed candidates do not match", async () => {
    const presented = "b".repeat(96);
    const otherHash = await bcrypt.hash("c".repeat(96), 10);

    prisma.refreshToken.findMany.mockResolvedValue([
      { id: "rt-2", userId: "user-1", token: otherHash, familyId: "f-1" },
    ]);

    const result = await verifyRefresh(presented);

    expect(result).toBeNull();
  });

  it("returns null when no candidate shares the hint (index miss)", async () => {
    prisma.refreshToken.findMany.mockResolvedValue([]);

    const result = await verifyRefresh("d".repeat(96));

    expect(result).toBeNull();
    // Exactly one indexed query — never an unbounded scan of all tokens
    expect(prisma.refreshToken.findMany).toHaveBeenCalledTimes(1);
  });
});

describe("rotateRefresh — theft detection unchanged", () => {
  it("persists the new token with its own hint after successful rotation", async () => {
    const tokenRecord = {
      id: "rt-old",
      userId: "user-1",
      familyId: "family-1",
      token: "hashed-old",
    };

    prisma.refreshToken.findFirst.mockResolvedValue(tokenRecord);
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
    prisma.refreshToken.create.mockResolvedValue({ id: "rt-new" });

    const result = await rotateRefresh(tokenRecord, "raw-old-token");

    expect(result.theftDetected).toBe(false);
    const created = prisma.refreshToken.create.mock.calls[0][0].data;
    expect(created.tokenHint).toBe(result.rawToken.slice(0, REFRESH_HINT_LENGTH));
  });

  it("still revokes the whole family on reuse", async () => {
    const oldRecord = {
      id: "rt-old",
      userId: "user-1",
      familyId: "family-1",
      token: "hashed-old",
    };

    // Latest token in family is a different record → reuse attempt
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
});

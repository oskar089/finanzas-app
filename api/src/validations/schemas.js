import { z } from "zod";

// ============================================================
// AUTH SCHEMAS
// ============================================================

export const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  name: z.string().min(2, "Name must be at least 2 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  defaultCurrency: z.string().length(3).optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .optional()
    .nullable(),
});

// ============================================================
// CATEGORY SCHEMAS
// ============================================================

export const createCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  type: z.enum(["INCOME", "EXPENSE"]),
  parentId: z.string().uuid("Invalid parent ID").optional().nullable(),
  color: z.string().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
  parentId: z.string().uuid().optional().nullable(),
  color: z.string().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
});

// ============================================================
// ACCOUNT SCHEMAS
// ============================================================

export const createAccountSchema = z.object({
  name: z.string().min(1, "Account name is required"),
  type: z.enum(["CHECKING", "SAVINGS", "CREDIT_CARD", "CASH"]),
  balance: z.number().default(0),
  currency: z.string().length(3).default("USD"),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["CHECKING", "SAVINGS", "CREDIT_CARD", "CASH"]).optional(),
  balance: z.number().optional(),
  currency: z.string().length(3).optional(),
  isActive: z.boolean().optional(),
});

// ============================================================
// TRANSACTION SCHEMAS
// ============================================================

export const createTransactionSchema = z.object({
  accountId: z.string().uuid("Invalid account ID"),
  amount: z.number().positive("Amount must be positive"),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  category: z.string().min(1, "Category is required"),
  categoryId: z.string().uuid("Invalid category ID").optional().nullable(),
  description: z.string().min(1, "Description is required"),
  notes: z.string().optional(),
  date: z.string().datetime("Invalid date format").or(z.date()),
});

export const updateTransactionSchema = z.object({
  accountId: z.string().uuid().optional(),
  amount: z.number().positive().optional(),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).optional(),
  category: z.string().min(1).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  description: z.string().min(1).optional(),
  notes: z.string().optional(),
  date: z.string().datetime().or(z.date()).optional(),
});

export const transactionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).optional(),
  category: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  concept: z.string().optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
  sortBy: z
    .enum(["date", "amount", "category", "description"])
    .default("date"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ============================================================
// BUDGET SCHEMAS
// ============================================================

export const createBudgetSchema = z.object({
  category: z.string().min(1, "Category is required"),
  categoryId: z.string().uuid().optional().nullable(),
  amount: z.number().positive("Amount must be positive"),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2030),
});

export const updateBudgetSchema = z.object({
  category: z.string().min(1).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  amount: z.number().positive().optional(),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2020).max(2030).optional(),
});

// ============================================================
// FAMILY SCHEMAS
// ============================================================

export const createFamilySchema = z.object({
  name: z.string().min(1, "Family name is required"),
});

export const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email format"),
  role: z.enum(["MEMBER", "VIEWER"]).default("MEMBER"),
});

// ============================================================
// DASHBOARD SCHEMAS
// ============================================================

export const dashboardQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

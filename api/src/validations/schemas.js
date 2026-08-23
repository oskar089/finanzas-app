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
//
// Canonical category shape: `category` is a denormalized NAME STRING that
// matches Transaction.category / Budget.category in the database. There is
// no categoryId column — the client resolves Category.id to its name before
// submit. Do not reintroduce categoryId fields here: routes pass validated
// data straight to Prisma, so an unknown field becomes a 400 on every write.
// ============================================================

export const createTransactionSchema = z
  .object({
    accountId: z.string().uuid("Invalid account ID"),
    toAccountId: z
      .string()
      .uuid("Invalid destination account ID")
      .optional()
      .nullable(),
    amount: z.number().positive("Amount must be positive"),
    type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
    category: z.string().min(1, "Category is required"),
    description: z.string().min(1, "Description is required"),
    notes: z.string().optional(),
    date: z.string().datetime("Invalid date format").or(z.string().date()),
  })
  .superRefine((data, ctx) => {
    if (data.type === "TRANSFER") {
      if (!data.toAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["toAccountId"],
          message: "toAccountId is required for TRANSFER",
        });
      } else if (data.toAccountId === data.accountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["toAccountId"],
          message: "toAccountId must differ from accountId",
        });
      }
    } else if (data.toAccountId) {
      // Only transfers carry a destination leg; a non-null one elsewhere is
      // a client contract violation, not data we can silently drop.
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toAccountId"],
        message: "toAccountId is only allowed for TRANSFER transactions",
      });
    }
  });

export const updateTransactionSchema = z
  .object({
    accountId: z.string().uuid().optional(),
    toAccountId: z.string().uuid().optional().nullable(),
    amount: z.number().positive().optional(),
    type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).optional(),
    category: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    notes: z.string().optional(),
    date: z.string().datetime().or(z.string().date()).or(z.date()).optional(),
  })
  .superRefine((data, ctx) => {
    // Partial updates: only statically checkable rules here. Rules that need
    // the stored row as context (effective type/destination) are enforced in
    // the PUT handler.
    if (
      data.type === "TRANSFER" &&
      data.toAccountId != null &&
      data.accountId != null &&
      data.toAccountId === data.accountId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toAccountId"],
        message: "toAccountId must differ from accountId",
      });
    }
  });

export const transactionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).optional(),
  category: z.string().optional(),
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
  amount: z.number().positive("Amount must be positive"),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2030),
});

export const updateBudgetSchema = z.object({
  category: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2020).max(2030).optional(),
});

export const budgetQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2020).max(2030).optional(),
});

export const budgetCopySchema = z.object({
  fromMonth: z.coerce.number().int().min(1).max(12),
  fromYear: z.coerce.number().int().min(2020).max(2030),
  toMonth: z.coerce.number().int().min(1).max(12),
  toYear: z.coerce.number().int().min(2020).max(2030),
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

export const updateMemberRoleSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
});

// ============================================================
// DASHBOARD SCHEMAS
// ============================================================

export const dashboardQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

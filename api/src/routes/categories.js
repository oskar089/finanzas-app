import { Router } from "express";
import prisma from "../lib/prisma.js";
import {
  createCategorySchema,
  updateCategorySchema,
} from "../validations/schemas.js";
import { ApiError } from "../middleware/errorHandler.js";

const router = Router();

/**
 * GET /api/categories
 * Get all categories for current user, optionally filtered by type
 */
router.get("/", async (req, res, next) => {
  try {
    const where = { userId: req.user.id };

    if (req.query.type === "INCOME" || req.query.type === "EXPENSE") {
      where.type = req.query.type;
    }

    const categories = await prisma.category.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    res.json({ categories });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/categories/:id
 * Get a single category by ID
 */
router.get("/:id", async (req, res, next) => {
  try {
    const category = await prisma.category.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!category) {
      throw new ApiError(404, "Category not found");
    }

    res.json({ category });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/categories
 * Create a new category
 */
router.post("/", async (req, res, next) => {
  try {
    const validatedData = createCategorySchema.parse(req.body);

    const category = await prisma.category.create({
      data: {
        ...validatedData,
        userId: req.user.id,
      },
    });

    res.status(201).json({
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/categories/:id
 * Update an existing category
 */
router.put("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.category.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!existing) {
      throw new ApiError(404, "Category not found");
    }

    const validatedData = updateCategorySchema.parse(req.body);

    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: validatedData,
    });

    res.json({
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/categories/:id
 * Delete a category
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.category.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!existing) {
      throw new ApiError(404, "Category not found");
    }

    // Check if category is used by any transactions
    const txCount = await prisma.transaction.count({
      where: { category: existing.name, userId: req.user.id },
    });

    if (txCount > 0) {
      throw new ApiError(
        409,
        `Cannot delete category used by ${txCount} transaction(s). Remove or reassign transactions first.`,
      );
    }

    await prisma.category.delete({
      where: { id: req.params.id },
    });

    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    next(error);
  }
});

export default router;

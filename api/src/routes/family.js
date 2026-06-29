import { Router } from "express";
import prisma from "../lib/prisma.js";
import {
  createFamilySchema,
  inviteMemberSchema,
} from "../validations/schemas.js";
import { ApiError } from "../middleware/errorHandler.js";

const router = Router();

/**
 * GET /api/family
 * Get current user's family groups
 */
router.get("/", async (req, res, next) => {
  try {
    // Get families where user is admin
    const adminFamilies = await prisma.familyGroup.findMany({
      where: { adminId: req.user.id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    // Get families where user is a member
    const memberFamilies = await prisma.familyGroup.findMany({
      where: {
        members: {
          some: { userId: req.user.id },
        },
      },
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    // Merge and deduplicate
    const allFamilies = [
      ...adminFamilies.map((f) => ({ ...f, role: "ADMIN" })),
      ...memberFamilies
        .filter((f) => f.adminId !== req.user.id)
        .map((f) => ({
          ...f,
          role: f.members.find((m) => m.userId === req.user.id)?.role,
        })),
    ];

    res.json({ families: allFamilies });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/family
 * Create a new family group
 */
router.post("/", async (req, res, next) => {
  try {
    const validatedData = createFamilySchema.parse(req.body);

    const family = await prisma.familyGroup.create({
      data: {
        ...validatedData,
        adminId: req.user.id,
        members: {
          create: {
            userId: req.user.id,
            role: "ADMIN",
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json({
      message: "Family group created successfully",
      family,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/family/:id/invite
 * Invite a member to family group
 */
router.post("/:id/invite", async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if family exists and user is admin
    const family = await prisma.familyGroup.findFirst({
      where: { id, adminId: req.user.id },
    });

    if (!family) {
      throw new ApiError(404, "Family not found or you are not the admin");
    }

    const validatedData = inviteMemberSchema.parse(req.body);

    // Find user by email
    const userToInvite = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (!userToInvite) {
      throw new ApiError(404, "User not found with this email");
    }

    // Check if user is already a member
    const existingMember = await prisma.familyMember.findUnique({
      where: {
        familyId_userId: {
          familyId: id,
          userId: userToInvite.id,
        },
      },
    });

    if (existingMember) {
      throw new ApiError(409, "User is already a member of this family");
    }

    // Add member
    const member = await prisma.familyMember.create({
      data: {
        familyId: id,
        userId: userToInvite.id,
        role: validatedData.role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    res.status(201).json({
      message: "Member invited successfully",
      member,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/family/:id/members/:memberId
 * Remove a member from family group
 */
router.delete("/:id/members/:memberId", async (req, res, next) => {
  try {
    const { id, memberId } = req.params;

    // Check if family exists and user is admin
    const family = await prisma.familyGroup.findFirst({
      where: { id, adminId: req.user.id },
    });

    if (!family) {
      throw new ApiError(404, "Family not found or you are not the admin");
    }

    // Can't remove yourself
    if (memberId === req.user.id) {
      throw new ApiError(400, "Admin cannot remove themselves");
    }

    // Check if member exists
    const member = await prisma.familyMember.findFirst({
      where: { familyId: id, userId: memberId },
    });

    if (!member) {
      throw new ApiError(404, "Member not found in this family");
    }

    // Remove member
    await prisma.familyMember.delete({
      where: { id: member.id },
    });

    res.json({ message: "Member removed successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/family/:id/members/:memberId/role
 * Update member role
 */
router.put("/:id/members/:memberId/role", async (req, res, next) => {
  try {
    const { id, memberId } = req.params;
    const { role } = req.body;

    if (!["ADMIN", "MEMBER", "VIEWER"].includes(role)) {
      throw new ApiError(400, "Invalid role");
    }

    // Check if family exists and user is admin
    const family = await prisma.familyGroup.findFirst({
      where: { id, adminId: req.user.id },
    });

    if (!family) {
      throw new ApiError(404, "Family not found or you are not the admin");
    }

    // Check if member exists
    const member = await prisma.familyMember.findFirst({
      where: { familyId: id, userId: memberId },
    });

    if (!member) {
      throw new ApiError(404, "Member not found in this family");
    }

    // Update role
    const updatedMember = await prisma.familyMember.update({
      where: { id: member.id },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    res.json({
      message: "Member role updated successfully",
      member: updatedMember,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/family/:id
 * Delete family group (admin only)
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if family exists and user is admin
    const family = await prisma.familyGroup.findFirst({
      where: { id, adminId: req.user.id },
    });

    if (!family) {
      throw new ApiError(404, "Family not found or you are not the admin");
    }

    // Delete family (cascade will delete members)
    await prisma.familyGroup.delete({
      where: { id },
    });

    res.json({ message: "Family group deleted successfully" });
  } catch (error) {
    next(error);
  }
});

export default router;

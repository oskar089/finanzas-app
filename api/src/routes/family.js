import { Router } from "express";
import prisma from "../lib/prisma.js";
import {
  createFamilySchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
} from "../validations/schemas.js";
import { ApiError } from "../middleware/errorHandler.js";

const router = Router();

/**
 * Verify the user holds an ADMIN membership in the family group.
 * FamilyMember.role is the single runtime authority; FamilyGroup.adminId
 * is owner-of-record only (set at creation, not consulted for permissions).
 * Returns the family if authorized, throws 404 or 403 otherwise.
 */
async function requireAdmin(familyId, userId) {
  const family = await prisma.familyGroup.findUnique({
    where: { id: familyId },
  });

  if (!family) {
    throw new ApiError(404, "Family group not found");
  }

  const membership = await prisma.familyMember.findUnique({
    where: {
      familyId_userId: { familyId, userId },
    },
  });

  if (!membership || membership.role !== "ADMIN") {
    throw new ApiError(403, "You do not have admin access to this family group");
  }

  return family;
}

/**
 * Count how many admins a family group has.
 */
async function countAdmins(familyId) {
  return prisma.familyMember.count({
    where: { familyId, role: "ADMIN" },
  });
}

/**
 * GET /api/family
 * Get current user's family groups
 */
router.get("/", async (req, res, next) => {
  try {
    // Single query: every family where the user holds a membership.
    // The role comes from the membership itself (single source of truth),
    // never from FamilyGroup.adminId.
    const families = await prisma.familyGroup.findMany({
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
      orderBy: { createdAt: "asc" },
    });

    const allFamilies = families.map((f) => ({
      ...f,
      role: f.members.find((m) => m.userId === req.user.id)?.role,
    }));

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
    await requireAdmin(id, req.user.id);

    const validatedData = inviteMemberSchema.parse(req.body);

    // Find user by email
    const userToInvite = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (!userToInvite) {
      // ACCEPTED enumeration risk, documented deliberately: membership is
      // immediate here (no pending-invitation model), so answering
      // generically would silently drop invites for unregistered emails.
      // The oracle also stays open either way — an admin can observe the
      // member list to see whether the invite landed — so masking this 404
      // buys no real privacy at real UX cost. Proper fix requires an
      // invitations table with deferred acceptance; only then can this
      // response be made status-agnostic.
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
    await requireAdmin(id, req.user.id);

    // Check if member exists
    const member = await prisma.familyMember.findFirst({
      where: { familyId: id, userId: memberId },
    });

    if (!member) {
      throw new ApiError(404, "Member not found in this family");
    }

    // Prevent removing the last admin (authority: FamilyMember.role)
    if (member.role === "ADMIN") {
      const adminCount = await countAdmins(id);
      if (adminCount <= 1) {
        throw new ApiError(
          400,
          "Cannot remove the last admin. Promote another member to admin first.",
        );
      }
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
    const { role } = updateMemberRoleSchema.parse(req.body);

    // Check if family exists and user is admin
    await requireAdmin(id, req.user.id);

    // Check if member exists
    const member = await prisma.familyMember.findFirst({
      where: { familyId: id, userId: memberId },
    });

    if (!member) {
      throw new ApiError(404, "Member not found in this family");
    }

    // Prevent demoting the last admin (authority: FamilyMember.role)
    if (member.role === "ADMIN" && role !== "ADMIN") {
      const adminCount = await countAdmins(id);
      if (adminCount <= 1) {
        throw new ApiError(
          400,
          "Cannot demote the last admin. Promote another member to admin first.",
        );
      }
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
    await requireAdmin(id, req.user.id);

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

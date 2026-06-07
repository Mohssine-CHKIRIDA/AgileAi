import { type NextRequest, NextResponse } from "next/server";
import { prisma, ratelimit } from "@/server/db";
import { MemberRole } from "@prisma/client";
import { clerkClient } from "@clerk/nextjs";
import { filterUserForClient } from "@/utils/helpers";
import { getAuth } from "@clerk/nextjs/server";
import { z } from "zod";

// The shape returned to the client: Clerk user data merged with role info
export type ProjectMember = ReturnType<typeof filterUserForClient> & {
  role: MemberRole;
  joinedAt: Date;
};

export type GetProjectMembersResponse = {
  members: ProjectMember[];
};

type MembersParams = {
  params: {
    project_id: string;
  };
};

const postMemberBodyValidator = z.object({
  userId: z.string(),
  role: z.nativeEnum(MemberRole).optional(),
});

export type PostMemberBody = z.infer<typeof postMemberBodyValidator>;

/**
 * GET /api/project/[project_id]/members
 *
 * Returns all active members of a project with their Clerk profile data.
 * Caller must be a member of the project.
 */
export async function GET(req: NextRequest, { params }: MembersParams) {
  const { userId } = getAuth(req);
  if (!userId) return new Response("Unauthenticated request", { status: 403 });

  const { project_id } = params;

  // Verify the caller belongs to this project
  const callerMembership = await prisma.teamMember.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId: project_id,
      },
    },
  });

  if (!callerMembership) {
    return new Response("Forbidden: not a member of this project", {
      status: 403,
    });
  }

  const teamMembers = await prisma.teamMember.findMany({
    where: { projectId: project_id },
    orderBy: { joinedAt: "asc" },
  });

  if (teamMembers.length === 0) {
    return NextResponse.json<GetProjectMembersResponse>({ members: [] });
  }

  // USE THIS IF RUNNING LOCALLY -----------------------
  // const dbUsers = await prisma.user.findMany({
  //   where: { id: { in: teamMembers.map((m) => m.userId) } },
  // });
  // const members: ProjectMember[] = teamMembers.map((tm) => {
  //   const user = dbUsers.find((u) => u.id === tm.userId)!;
  //   return { ...filterUserForClient(user), role: tm.role, joinedAt: tm.joinedAt };
  // });
  // --------------------------------------------------

  // COMMENT THIS IF RUNNING LOCALLY ------------------
  const clerkUsers = (
    await clerkClient.users.getUserList({
      userId: teamMembers.map((m) => m.userId),
      limit: 100,
    })
  ).map(filterUserForClient);

  const members: ProjectMember[] = teamMembers.flatMap((tm) => {
    const clerkUser = clerkUsers.find((u) => u.id === tm.userId);
    if (!clerkUser) return [];
    return [{ ...clerkUser, role: tm.role, joinedAt: tm.joinedAt }];
  });
  // --------------------------------------------------

  return NextResponse.json<GetProjectMembersResponse>({ members });
}

/**
 * POST /api/project/[project_id]/members
 *
 * Adds a new member to the project.
 * Only OWNER or ADMIN can invite others.
 */
export async function POST(req: NextRequest, { params }: MembersParams) {
  const { userId } = getAuth(req);
  if (!userId) return new Response("Unauthenticated request", { status: 403 });
  const { success } = await ratelimit.limit(userId);
  if (!success) return new Response("Too many requests", { status: 429 });

  const { project_id } = params;

  // Check caller permissions
  const callerMembership = await prisma.teamMember.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId: project_id,
      },
    },
  });

  if (!callerMembership) {
    return new Response("Forbidden: not a member of this project", {
      status: 403,
    });
  }

  if (
    callerMembership.role !== MemberRole.OWNER &&
    callerMembership.role !== MemberRole.ADMIN
  ) {
    return new Response("Forbidden: only OWNER or ADMIN can add members", {
      status: 403,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const body = await req.json();
  const validated = postMemberBodyValidator.safeParse(body);

  if (!validated.success) {
    const message =
      "Invalid body. " + (validated.error.errors[0]?.message ?? "");
    return new Response(message, { status: 400 });
  }

  const { data: valid } = validated;

  // Prevent duplicate membership
  const existingMembership = await prisma.teamMember.findUnique({
    where: {
      userId_projectId: {
        userId: valid.userId,
        projectId: project_id,
      },
    },
  });

  if (existingMembership) {
    return new Response("User is already a member of this project", {
      status: 409,
    });
  }

  const member = await prisma.teamMember.create({
    data: {
      userId: valid.userId,
      projectId: project_id,
      role: valid.role ?? MemberRole.DEVELOPER,
    },
  });

  return NextResponse.json({ member }, { status: 201 });
}

/**
 * DELETE /api/project/[project_id]/members
 *
 * Removes a member from the project.
 * Only OWNER or ADMIN can remove others; any member can remove themselves.
 */
export async function DELETE(req: NextRequest, { params }: MembersParams) {
  const { userId } = getAuth(req);
  if (!userId) return new Response("Unauthenticated request", { status: 403 });
  const { success } = await ratelimit.limit(userId);
  if (!success) return new Response("Too many requests", { status: 429 });

  const { project_id } = params;

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get("userId");

  if (!targetUserId) {
    return new Response("Missing 'userId' query parameter", { status: 400 });
  }

  const callerMembership = await prisma.teamMember.findUnique({
    where: {
      userId_projectId: { userId, projectId: project_id },
    },
  });

  if (!callerMembership) {
    return new Response("Forbidden: not a member of this project", {
      status: 403,
    });
  }

  const isSelf = userId === targetUserId;
  const isPrivileged =
    callerMembership.role === MemberRole.OWNER ||
    callerMembership.role === MemberRole.ADMIN;

  if (!isSelf && !isPrivileged) {
    return new Response("Forbidden: insufficient permissions", { status: 403 });
  }

  // Cannot remove the last OWNER
  if (targetUserId === userId && callerMembership.role === MemberRole.OWNER) {
    const ownerCount = await prisma.teamMember.count({
      where: { projectId: project_id, role: MemberRole.OWNER },
    });
    if (ownerCount <= 1) {
      return new Response(
        "Cannot remove the last owner. Transfer ownership first.",
        { status: 409 }
      );
    }
  }

  await prisma.teamMember.delete({
    where: {
      userId_projectId: { userId: targetUserId, projectId: project_id },
    },
  });

  return new Response(null, { status: 204 });
}
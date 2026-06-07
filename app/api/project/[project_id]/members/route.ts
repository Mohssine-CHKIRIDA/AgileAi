/**
 * LOCAL DEV version — auth via X-Dev-User-Id header.
 * User data comes from prisma.user (business schema), not Clerk.
 */
import { type NextRequest, NextResponse } from "next/server";
import { prisma, ratelimit } from "@/server/db";
import { MemberRole, type User } from "@prisma/client";
import { getDevAuth } from "@/server/dev-auth";
import { z } from "zod";

export type ProjectMember = User & { role: MemberRole; joinedAt: Date };
export type GetProjectMembersResponse = { members: ProjectMember[] };

type MembersParams = { params: { project_id: string } };

const postMemberBodyValidator = z.object({
  userId: z.string(),
  role: z.nativeEnum(MemberRole).optional(),
});

export type PostMemberBody = z.infer<typeof postMemberBodyValidator>;

/** Helper — verify caller is a member of the project */
async function assertMember(userId: string, projectId: string) {
  return prisma.teamMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
}

/**
 * GET /api/project/:project_id/members
 * Header: X-Dev-User-Id: local-user-1
 */
export async function GET(req: NextRequest, { params }: MembersParams) {
  const { userId } = getDevAuth(req);
  if (!userId) {
    return new Response("Missing X-Dev-User-Id header", { status: 403 });
  }

  const { project_id } = params;

  const callerMembership = await assertMember(userId, project_id);
  if (!callerMembership) {
    return new Response("Forbidden: not a member of this project", { status: 403 });
  }

  const teamMembers = await prisma.teamMember.findMany({
    where: { projectId: project_id },
    orderBy: { joinedAt: "asc" },
  });

  if (teamMembers.length === 0) {
    return NextResponse.json<GetProjectMembersResponse>({ members: [] });
  }

  const users = await prisma.user.findMany({
    where: { id: { in: teamMembers.map((m) => m.userId) } },
  });

  const members: ProjectMember[] = teamMembers.flatMap((tm) => {
    const user = users.find((u) => u.id === tm.userId);
    if (!user) return [];
    return [{ ...user, role: tm.role, joinedAt: tm.joinedAt }];
  });

  return NextResponse.json<GetProjectMembersResponse>({ members });
}

/**
 * POST /api/project/:project_id/members
 * Header: X-Dev-User-Id: local-user-1
 * Body: { userId, role? }
 */
export async function POST(req: NextRequest, { params }: MembersParams) {
  const { userId } = getDevAuth(req);
  if (!userId) return new Response("Missing X-Dev-User-Id header", { status: 403 });
  const { success } = await ratelimit.limit(userId);
  if (!success) return new Response("Too many requests", { status: 429 });

  const { project_id } = params;

  const callerMembership = await assertMember(userId, project_id);
  if (!callerMembership) {
    return new Response("Forbidden: not a member of this project", { status: 403 });
  }
  if (
    callerMembership.role !== MemberRole.OWNER &&
    callerMembership.role !== MemberRole.ADMIN
  ) {
    return new Response("Forbidden: only OWNER or ADMIN can add members", { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const body = await req.json();
  const validated = postMemberBodyValidator.safeParse(body);
  if (!validated.success) {
    return new Response(
      "Invalid body. " + (validated.error.errors[0]?.message ?? ""),
      { status: 400 }
    );
  }

  const { data: valid } = validated;

  const existingMembership = await assertMember(valid.userId, project_id);
  if (existingMembership) {
    return new Response("User is already a member of this project", { status: 409 });
  }

  // Auto-create the target user in DB if they don't exist yet (handy for dev)
  await prisma.user.upsert({
    where: { id: valid.userId },
    update: {},
    create: {
      id: valid.userId,
      name: valid.userId,
      email: `${valid.userId}@localhost.dev`,
    },
  });

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
 * DELETE /api/project/:project_id/members?userId=X
 * Header: X-Dev-User-Id: local-user-1
 */
export async function DELETE(req: NextRequest, { params }: MembersParams) {
  const { userId } = getDevAuth(req);
  if (!userId) return new Response("Missing X-Dev-User-Id header", { status: 403 });
  const { success } = await ratelimit.limit(userId);
  if (!success) return new Response("Too many requests", { status: 429 });

  const { project_id } = params;
  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get("userId");
  if (!targetUserId) return new Response("Missing 'userId' query parameter", { status: 400 });

  const callerMembership = await assertMember(userId, project_id);
  if (!callerMembership) {
    return new Response("Forbidden: not a member of this project", { status: 403 });
  }

  const isSelf = userId === targetUserId;
  const isPrivileged =
    callerMembership.role === MemberRole.OWNER ||
    callerMembership.role === MemberRole.ADMIN;

  if (!isSelf && !isPrivileged) {
    return new Response("Forbidden: insufficient permissions", { status: 403 });
  }

  if (isSelf && callerMembership.role === MemberRole.OWNER) {
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
    where: { userId_projectId: { userId: targetUserId, projectId: project_id } },
  });

  return new Response(null, { status: 204 });
}

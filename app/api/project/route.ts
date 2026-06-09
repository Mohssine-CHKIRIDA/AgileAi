/**
 * GET: Returns the user's project or signals onboarding is needed.
 * POST: Creates a new project and adds the caller as OWNER.
 */
import { type NextRequest, NextResponse } from "next/server";
import { prisma, ratelimit } from "@/server/db";
import { MemberRole, type Project } from "@prisma/client";
import { ensureUserSynced, getRequestAuth } from "@/server/dev-auth";
import { getActiveMembership } from "@/server/project-membership";
import { z } from "zod";

const INIT_PROJECT_ID = "init-project-id-dq8yh-d0as89hjd";

export type GetProjectResponse = {
  project: Project | null;
  needsOnboarding?: boolean;
};
export type PostProjectResponse = { project: Project };

const postProjectBodyValidator = z.object({
  key: z
    .string()
    .min(2)
    .max(10)
    .regex(/^[A-Z0-9]+$/, "Key must be uppercase letters and numbers only"),
  name: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

export type PostProjectBody = z.infer<typeof postProjectBodyValidator>;

export async function GET(req: NextRequest) {
  const { userId } = await getRequestAuth(req);

  if (!userId) {
    const initProject = await prisma.project.findUnique({
      where: { id: INIT_PROJECT_ID },
    });
    return NextResponse.json<GetProjectResponse>({
      project: initProject,
      needsOnboarding: false,
    });
  }

  await ensureUserSynced(userId);

  const membership = await getActiveMembership(userId);

  if (membership?.project && !membership.project.deletedAt) {
    return NextResponse.json<GetProjectResponse>({
      project: membership.project,
      needsOnboarding: false,
    });
  }

  return NextResponse.json<GetProjectResponse>({
    project: null,
    needsOnboarding: true,
  });
}

export async function POST(req: NextRequest) {
  const { userId } = await getRequestAuth(req);
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { success } = await ratelimit.limit(userId);
  if (!success) return new Response("Too many requests", { status: 429 });

  await ensureUserSynced(userId);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const body = await req.json();
  const validated = postProjectBodyValidator.safeParse(body);
  if (!validated.success) {
    return new Response(
      "Invalid body. " + (validated.error.errors[0]?.message ?? ""),
      { status: 400 }
    );
  }

  const { data: valid } = validated;

  const existing = await prisma.project.findUnique({ where: { key: valid.key } });
  if (existing) {
    return new Response(`Project key '${valid.key}' is already taken`, {
      status: 409,
    });
  }

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        key: valid.key,
        name: valid.name,
        description: valid.description,
        imageUrl: valid.imageUrl,
        defaultAssignee: userId,
      },
    });
    await tx.teamMember.create({
      data: {
        userId,
        projectId: created.id,
        role: MemberRole.OWNER,
        joinedAt: new Date(),
      },
    });
    return created;
  });

  return NextResponse.json<PostProjectResponse>({ project }, { status: 201 });
}

/**
 * LOCAL DEV version — auth via X-Dev-User-Id header, no Clerk, no ratelimit.
 */
import { prisma, ratelimit } from "@/server/db";
import { getDevAuth } from "@/server/dev-auth";
import { SprintPlanStatus, type SprintPlan } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export type PostSprintResponse = { sprint: SprintPlan };
export type GetSprintsResponse = { sprints: SprintPlan[] };

const postSprintBodyValidator = z.object({
  projectId: z.string(),
  name: z.string().optional(),
  goal: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type PostSprintBody = z.infer<typeof postSprintBodyValidator>;

/**
 * GET /api/sprints?projectId=<id>
 * Header: X-Dev-User-Id: local-user-1
 */
export async function GET(req: NextRequest) {
  const { userId } = getDevAuth(req);
  if (!userId) return new Response("Missing X-Dev-User-Id header", { status: 403 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) return new Response("Missing projectId query parameter", { status: 400 });

  const membership = await prisma.teamMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  if (!membership) {
    return new Response("Forbidden: not a member of this project", { status: 403 });
  }

  const sprints = await prisma.sprintPlan.findMany({
    where: {
      projectId,
      deletedAt: null,
      status: { in: [SprintPlanStatus.ACTIVE, SprintPlanStatus.DRAFT] },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json<GetSprintsResponse>({ sprints });
}

/**
 * POST /api/sprints
 * Header: X-Dev-User-Id: local-user-1
 * Body: { projectId, name?, goal?, startDate?, endDate? }
 */
export async function POST(req: NextRequest) {
  const { userId } = getDevAuth(req);
  if (!userId) return new Response("Missing X-Dev-User-Id header", { status: 403 });
  const { success } = await ratelimit.limit(userId);
  if (!success) return new Response("Too many requests", { status: 429 });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const body = await req.json();
  const validated = postSprintBodyValidator.safeParse(body);
  if (!validated.success) {
    return new Response(
      "Invalid body. " + (validated.error.errors[0]?.message ?? ""),
      { status: 400 }
    );
  }

  const { data: valid } = validated;

  const membership = await prisma.teamMember.findUnique({
    where: { userId_projectId: { userId, projectId: valid.projectId } },
  });
  if (!membership) {
    return new Response("Forbidden: not a member of this project", { status: 403 });
  }

  const sprintCount = await prisma.sprintPlan.count({
    where: { projectId: valid.projectId },
  });

  const sprint = await prisma.sprintPlan.create({
    data: {
      projectId: valid.projectId,
      creatorId: userId,
      name: valid.name ?? `Sprint ${sprintCount + 1}`,
      goal: valid.goal ?? "",
      startDate: valid.startDate ? new Date(valid.startDate) : undefined,
      endDate: valid.endDate ? new Date(valid.endDate) : undefined,
      status: SprintPlanStatus.DRAFT,
    },
  });

  return NextResponse.json<PostSprintResponse>({ sprint }, { status: 201 });
}
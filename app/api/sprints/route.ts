/**
 * app/api/sprints/route.ts
 * LOCAL DEV version — auth via X-Dev-User-Id header.
 * 
 * GET: No longer requires ?projectId= — derives the project from user membership.
 * POST: Creates a sprint; projectId is inferred from user's project if not provided.
 */
import { prisma, ratelimit } from "@/server/db";
import { getRequestAuth } from "@/server/dev-auth";
import { getActiveMembership } from "@/server/project-membership";
import { SprintPlanStatus, type SprintPlan } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { toSprintShape } from "@/utils/task-adapter";

export type PostSprintResponse = { sprint: SprintPlan };
export type GetSprintsResponse = { sprints: ReturnType<typeof toSprintShape>[] };

const postSprintBodyValidator = z.object({
  projectId: z.string().optional(),
  name: z.string().optional(),
  goal: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type PostSprintBody = z.infer<typeof postSprintBodyValidator>;

/**
 * GET /api/sprints
 * Header: X-Dev-User-Id: <userId>
 * Optional: ?projectId=<id>
 * Returns ACTIVE + DRAFT sprints for the user's project.
 */
const INIT_PROJECT_ID = "init-project-id-dq8yh-d0as89hjd";

export async function GET(req: NextRequest) {
  const { userId } = await getRequestAuth(req);

  const { searchParams } = new URL(req.url);
  let projectId = searchParams.get("projectId");

  if (!projectId) {
    if (userId) {
      const membership = await getActiveMembership(userId);
      projectId = membership?.projectId ?? null;
    } else {
      projectId = INIT_PROJECT_ID;
    }
  }

  if (!projectId) {
    return NextResponse.json<GetSprintsResponse>({ sprints: [] });
  }

  if (!userId) {
    const sprints = await prisma.sprintPlan.findMany({
      where: {
        projectId,
        deletedAt: null,
        status: { in: [SprintPlanStatus.ACTIVE, SprintPlanStatus.DRAFT] },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json<GetSprintsResponse>({
      sprints: sprints.map(toSprintShape),
    });
  }

  // Verify membership
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

  return NextResponse.json<GetSprintsResponse>({ sprints: sprints.map(toSprintShape) });
}

/**
 * POST /api/sprints
 * Header: X-Dev-User-Id: <userId>
 * Body: { projectId?, name?, goal?, startDate?, endDate? }
 */
export async function POST(req: NextRequest) {
  const { userId } = await getRequestAuth(req);
  if (!userId) return new Response("Unauthorized", { status: 401 });
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

  // Derive projectId from membership if not provided
  let projectId = valid.projectId;
  if (!projectId) {
    const membership = await getActiveMembership(userId);
    projectId = membership?.projectId;
  }

  if (!projectId) {
    return new Response("No project found for user", { status: 400 });
  }

  const membershipCheck = await prisma.teamMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  if (!membershipCheck) {
    return new Response("Forbidden: not a member of this project", { status: 403 });
  }

  const sprintCount = await prisma.sprintPlan.count({
    where: { projectId },
  });

  const sprint = await prisma.sprintPlan.create({
    data: {
      projectId,
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
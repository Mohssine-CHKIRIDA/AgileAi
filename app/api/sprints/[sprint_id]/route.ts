import { type NextRequest, NextResponse } from "next/server";
import { prisma, ratelimit } from "@/server/db";
import { SprintPlanStatus, type SprintPlan } from "@prisma/client";
import { z } from "zod";
import { getAuth } from "@clerk/nextjs/server";

const patchSprintBodyValidator = z.object({
  name: z.string().optional(),
  goal: z.string().optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  status: z.nativeEnum(SprintPlanStatus).optional(),
  totalCapacityPoints: z.number().int().optional(),
  plannedPoints: z.number().int().optional(),
  bufferPoints: z.number().int().optional(),
});

export type PatchSprintBody = z.infer<typeof patchSprintBodyValidator>;
export type PatchSprintResponse = { sprint: SprintPlan };

type ParamsType = {
  params: {
    sprint_id: string;
  };
};

/** Resolve sprint and verify the caller is a project member. */
async function resolveSprintAndCheckAccess(
  sprintId: string,
  userId: string
): Promise<
  | { sprint: SprintPlan; error: null }
  | { sprint: null; error: Response }
> {
  const sprint = await prisma.sprintPlan.findUnique({
    where: { id: sprintId },
  });

  if (!sprint || sprint.deletedAt !== null) {
    return {
      sprint: null,
      error: new Response("Sprint not found", { status: 404 }),
    };
  }

  const membership = await prisma.teamMember.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId: sprint.projectId,
      },
    },
  });

  if (!membership) {
    return {
      sprint: null,
      error: new Response("Forbidden: not a member of this project", {
        status: 403,
      }),
    };
  }

  return { sprint, error: null };
}

export async function PATCH(req: NextRequest, { params }: ParamsType) {
  const { userId } = getAuth(req);
  if (!userId) return new Response("Unauthenticated request", { status: 403 });
  const { success } = await ratelimit.limit(userId);
  if (!success) return new Response("Too many requests", { status: 429 });

  const { sprint_id } = params;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const body = await req.json();
  const validated = patchSprintBodyValidator.safeParse(body);

  if (!validated.success) {
    const message =
      "Invalid body. " + (validated.error.errors[0]?.message ?? "");
    return new Response(message, { status: 400 });
  }

  const { data: valid } = validated;

  const { sprint: current, error } = await resolveSprintAndCheckAccess(
    sprint_id,
    userId
  );
  if (error) return error;

  // Enforce sprint status transition rules:
  // DRAFT → ACTIVE → CLOSED (only one ACTIVE sprint per project allowed)
  if (valid.status === SprintPlanStatus.ACTIVE) {
    const activeSprint = await prisma.sprintPlan.findFirst({
      where: {
        projectId: current!.projectId,
        status: SprintPlanStatus.ACTIVE,
        id: { not: sprint_id },
      },
    });
    if (activeSprint) {
      return new Response(
        "Another sprint is already active. Close it before starting a new one.",
        { status: 409 }
      );
    }
  }

  const sprint = await prisma.sprintPlan.update({
    where: { id: sprint_id },
    data: {
      name: valid.name ?? current!.name,
      goal: valid.goal ?? current!.goal,
      startDate:
        valid.startDate !== undefined
          ? valid.startDate
            ? new Date(valid.startDate)
            : null
          : current!.startDate,
      endDate:
        valid.endDate !== undefined
          ? valid.endDate
            ? new Date(valid.endDate)
            : null
          : current!.endDate,
      status: valid.status ?? current!.status,
      totalCapacityPoints:
        valid.totalCapacityPoints ?? current!.totalCapacityPoints,
      plannedPoints: valid.plannedPoints ?? current!.plannedPoints,
      bufferPoints: valid.bufferPoints ?? current!.bufferPoints,
    },
  });

  return NextResponse.json<PatchSprintResponse>({ sprint });
}

export async function DELETE(req: NextRequest, { params }: ParamsType) {
  const { userId } = getAuth(req);
  if (!userId) return new Response("Unauthenticated request", { status: 403 });
  const { success } = await ratelimit.limit(userId);
  if (!success) return new Response("Too many requests", { status: 429 });

  const { sprint_id } = params;

  const { sprint: current, error } = await resolveSprintAndCheckAccess(
    sprint_id,
    userId
  );
  if (error) return error;

  // Cannot delete an active sprint — close it first
  if (current!.status === SprintPlanStatus.ACTIVE) {
    return new Response(
      "Cannot delete an active sprint. Close it first.",
      { status: 409 }
    );
  }

  // Detach all tasks from this sprint (move them back to backlog)
  await prisma.task.updateMany({
    where: { sprintPlanId: sprint_id },
    data: {
      sprintPlanId: null,
      status: "BACKLOG",
    },
  });

  // Soft-delete the sprint
  const sprint = await prisma.sprintPlan.update({
    where: { id: sprint_id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json<PatchSprintResponse>({ sprint });
}
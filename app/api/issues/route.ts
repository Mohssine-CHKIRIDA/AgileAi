/**
 * app/api/issues/route.ts (updated for AgileAI schema)
 *
 * GET: Returns all tasks for the user's project (not just creatorId-scoped).
 * POST/PATCH: unchanged logic, just uses prisma.task.
 */

import { type NextRequest, NextResponse } from "next/server";
import { prisma, ratelimit } from "@/server/db";
import { getRequestAuth } from "@/server/dev-auth";
import { getActiveMembership } from "@/server/project-membership";
import { TaskType, TaskStatus, SprintPlanStatus } from "@prisma/client";
import { z } from "zod";
import {
  type IssueShape,
  generateTasksForClient,
  toTaskCreateData,
  toTaskUpdateData,
} from "@/utils/task-adapter";
import { filterUserForClient, calculateInsertPosition } from "@/utils/helpers";

export type GetIssuesResponse = { issues: IssueShape[] };

const postIssuesBodyValidator = z.object({
  name: z.string(),
  type: z.enum(["BUG", "STORY", "TASK", "EPIC", "SUBTASK"]),
  sprintId: z.string().nullable(),
  reporterId: z.string().nullable(),
  parentId: z.string().nullable(),
  sprintColor: z.string().nullable().optional(),
});

export type PostIssueBody = z.infer<typeof postIssuesBodyValidator>;

const patchIssuesBodyValidator = z.object({
  ids: z.array(z.string()),
  type: z.nativeEnum(TaskType).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  assigneeId: z.string().nullable().optional(),
  reporterId: z.string().optional(),
  parentId: z.string().nullable().optional(),
  sprintId: z.string().nullable().optional(),
  isDeleted: z.boolean().optional(),
});

export type PatchIssuesBody = z.infer<typeof patchIssuesBodyValidator>;

// ── GET /api/issues ───────────────────────────────────────────────────────────

const INIT_PROJECT_ID = "init-project-id-dq8yh-d0as89hjd";

export async function GET(req: NextRequest) {
  const { userId } = await getRequestAuth(req);

  let projectId: string | null = null;
  if (userId) {
    const membership = await getActiveMembership(userId);
    projectId = membership?.projectId ?? null;
    if (!projectId) {
      return NextResponse.json<GetIssuesResponse>({ issues: [] });
    }
  } else {
    projectId = INIT_PROJECT_ID;
  }

  const activeTasks = await prisma.task.findMany({
    where: {
      projectId,
      deletedAt: null,
    },
  });

  if (!activeTasks || activeTasks.length === 0) {
    return NextResponse.json<GetIssuesResponse>({ issues: [] });
  }

  const activeSprints = await prisma.sprintPlan.findMany({
    where: {
      projectId,
      status: SprintPlanStatus.ACTIVE,
      deletedAt: null,
    },
  });

  const taskUserIds = activeTasks
    .flatMap((t) => [t.assigneeId, t.reporterId])
    .filter((id): id is string => Boolean(id));

  const teamMembers = await prisma.teamMember.findMany({
    where: { projectId },
    select: { userId: true },
  });

  const userIds = [
    ...new Set([...taskUserIds, ...teamMembers.map((m) => m.userId)]),
  ];

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
  });

  const issues = generateTasksForClient(
    activeTasks,
    users.map(filterUserForClient),
    activeSprints.map((s) => s.id)
  );

  return NextResponse.json<GetIssuesResponse>({ issues });
}

// ── POST /api/issues ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { userId } = await getRequestAuth(req);
  if (!userId) return new Response("Missing X-Dev-User-Id header", { status: 403 });
  const { success } = await ratelimit.limit(userId);
  if (!success) return new Response("Too many requests", { status: 429 });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const body = await req.json();
  const validated = postIssuesBodyValidator.safeParse(body);
  if (!validated.success) {
    return new Response(
      "Invalid body. " + (validated.error.errors[0]?.message ?? ""),
      { status: 400 }
    );
  }

  const { data: valid } = validated;

  // Resolve projectId
  let projectId: string;
  if (valid.sprintId) {
    const sprint = await prisma.sprintPlan.findUnique({ where: { id: valid.sprintId } });
    if (!sprint) return new Response("Sprint not found", { status: 404 });
    projectId = sprint.projectId;
  } else {
    const membership = await getActiveMembership(userId);
    if (!membership?.projectId) {
      return new Response("No active project", { status: 400 });
    }
    projectId = membership.projectId;
  }

  const existingTasks = await prisma.task.findMany({
    where: { projectId },
  });

  const sprintTasks = existingTasks.filter(
    (t) => t.sprintPlanId === valid.sprintId && t.deletedAt === null
  );

  let boardPosition = -1;
  if (valid.sprintId) {
    const sprint = await prisma.sprintPlan.findUnique({ where: { id: valid.sprintId } });
    if (sprint?.status === SprintPlanStatus.ACTIVE) {
      const todoTasks = sprintTasks.filter((t) => t.status === TaskStatus.TODO);
      boardPosition = calculateInsertPosition(todoTasks);
    }
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  const k = existingTasks.length + 1;
  const key = `${project?.key ?? "TASK"}-${k}`;

  const task = await prisma.task.create({
    data: toTaskCreateData({
      name: valid.name,
      type: valid.type,
      sprintId: valid.sprintId,
      parentId: valid.parentId,
      sprintColor: valid.sprintColor,
      reporterId: valid.reporterId ?? userId,
      creatorId: userId,
      projectId,
      key,
      sprintPosition: calculateInsertPosition(sprintTasks),
      boardPosition,
    }),
  });

  const issue = {
    ...task,
    name: task.title,
    sprintId: task.sprintPlanId,
    parentId: task.parentTaskId,
    isDeleted: task.deletedAt !== null,
  };

  return NextResponse.json({ issue }, { status: 201 });
}

// ── PATCH /api/issues (batch update) ─────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const { userId } = await getRequestAuth(req);
  if (!userId) return new Response("Missing X-Dev-User-Id header", { status: 403 });
  const { success } = await ratelimit.limit(userId);
  if (!success) return new Response("Too many requests", { status: 429 });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const body = await req.json();
  const validated = patchIssuesBodyValidator.safeParse(body);
  if (!validated.success) {
    return new Response(
      "Invalid body. " + (validated.error.errors[0]?.message ?? ""),
      { status: 400 }
    );
  }

  const { data: valid } = validated;

  const updatedTasks = await Promise.all(
    valid.ids.map((id) =>
      prisma.task.update({
        where: { id },
        data: toTaskUpdateData({
          type: valid.type,
          status: valid.status,
          assigneeId: valid.assigneeId,
          reporterId: valid.reporterId,
          isDeleted: valid.isDeleted,
          sprintId: valid.sprintId,
          parentId: valid.parentId,
        }),
      })
    )
  );

  const issues = updatedTasks.map((t) => ({
    ...t,
    name: t.title,
    sprintId: t.sprintPlanId,
    parentId: t.parentTaskId,
    isDeleted: t.deletedAt !== null,
  }));

  return NextResponse.json({ issues });
}
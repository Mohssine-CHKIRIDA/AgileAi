/**
 * app/api/issues/route.ts  (updated for AgileAI schema)
 *
 * Uses prisma.task instead of prisma.issue.
 * Adapter converts Task ↔ IssueShape so the client sees the exact same JSON.
 * Auth: X-Dev-User-Id header (dev mode). Swap back to getAuth() for production.
 */

import { type NextRequest, NextResponse } from "next/server";
import { prisma, ratelimit } from "@/server/db";
import { getDevAuth } from "@/server/dev-auth";
import { TaskType, TaskStatus, SprintPlanStatus } from "@prisma/client";
import { z } from "zod";
import {
  type IssueShape,
  generateTasksForClient,
  toTaskCreateData,
  toTaskUpdateData,
} from "@/utils/task-adapter";
import { filterUserForClient, calculateInsertPosition } from "@/utils/helpers";

// ── Response types (same as before — no changes needed in utils/api/issues.ts) ─

export type GetIssuesResponse = { issues: IssueShape[] };

// ── Validators ────────────────────────────────────────────────────────────────

const postIssuesBodyValidator = z.object({
  name: z.string(),                                            // maps → title
  type: z.enum(["BUG", "STORY", "TASK", "EPIC", "SUBTASK"]),
  sprintId: z.string().nullable(),                             // maps → sprintPlanId
  reporterId: z.string().nullable(),
  parentId: z.string().nullable(),                             // maps → parentTaskId
  sprintColor: z.string().nullable().optional(),
});

export type PostIssueBody = z.infer<typeof postIssuesBodyValidator>;

const patchIssuesBodyValidator = z.object({
  ids: z.array(z.string()),
  type: z.nativeEnum(TaskType).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  assigneeId: z.string().nullable().optional(),
  reporterId: z.string().optional(),
  parentId: z.string().nullable().optional(),                  // maps → parentTaskId
  sprintId: z.string().nullable().optional(),                  // maps → sprintPlanId
  isDeleted: z.boolean().optional(),                           // maps → deletedAt
});

export type PatchIssuesBody = z.infer<typeof patchIssuesBodyValidator>;

// ── GET /api/issues ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { userId } = getDevAuth(req);

  const activeTasks = await prisma.task.findMany({
    where: {
      creatorId: userId ?? "init",
      deletedAt: null,                          // was: isDeleted: false
    },
  });

  if (!activeTasks || activeTasks.length === 0) {
    return NextResponse.json<GetIssuesResponse>({ issues: [] });
  }

  const activeSprints = await prisma.sprintPlan.findMany({
    where: { status: SprintPlanStatus.ACTIVE },
  });

  const userIds = [
    ...new Set(
      activeTasks
        .flatMap((t) => [t.assigneeId, t.reporterId])
        .filter((id): id is string => Boolean(id))
    ),
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
  const { userId } = getDevAuth(req);
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

  // Resolve projectId from the sprint (or fall back to first project the user owns)
  let projectId: string;
  if (valid.sprintId) {
    const sprint = await prisma.sprintPlan.findUnique({
      where: { id: valid.sprintId },
    });
    if (!sprint) return new Response("Sprint not found", { status: 404 });
    projectId = sprint.projectId;
  } else {
    const membership = await prisma.teamMember.findFirst({
      where: { userId },
      orderBy: { joinedAt: "asc" },
    });
    if (!membership) return new Response("User has no project", { status: 400 });
    projectId = membership.projectId;
  }

  // Count existing tasks to generate key + position
  const existingTasks = await prisma.task.findMany({
    where: { creatorId: userId },
  });

  const sprintTasks = existingTasks.filter(
    (t) => t.sprintPlanId === valid.sprintId && t.deletedAt === null
  );

  // Determine board position: only add to board if sprint is ACTIVE
  let boardPosition = -1;
  if (valid.sprintId) {
    const sprint = await prisma.sprintPlan.findUnique({
      where: { id: valid.sprintId },
    });
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

  // Return in the old Issue shape so the client is unaffected
  const issue = {
    ...task,
    name: task.title,
    sprintId: task.sprintPlanId,
    parentId: task.parentTaskId,
    isDeleted: task.deletedAt !== null,
  };

  return NextResponse.json({ issue }, { status: 201 });
}

// ── PATCH /api/issues  (batch update) ────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const { userId } = getDevAuth(req);
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

  // Map back to the old Issue shape
  const issues = updatedTasks.map((t) => ({
    ...t,
    name: t.title,
    sprintId: t.sprintPlanId,
    parentId: t.parentTaskId,
    isDeleted: t.deletedAt !== null,
  }));

  return NextResponse.json({ issues });
}

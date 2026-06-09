/**
 * LOCAL DEV version — auth via X-Dev-User-Id header.
 */
import { type NextRequest, NextResponse } from "next/server";
import { prisma, ratelimit } from "@/server/db";
import { getRequestAuth } from "@/server/dev-auth";
import { TaskStatus, type Task, TaskType, type User } from "@prisma/client";
import { z } from "zod";
import { type GetIssuesResponse } from "../route";
import { type IssueShape, toIssueShape, toTaskUpdateData } from "@/utils/task-adapter";

export type GetIssueDetailsResponse = {
  issue: GetIssuesResponse["issues"][number] | null;
};
export type PostIssueResponse = { issue: Task };

type ParamsType = { params: { issueId: string } };

/**
 * GET /api/issues/:issueId
 * Header: X-Dev-User-Id: local-user-1
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { issueId: string } }
) {
  const { issueId } = params;
  const task = await prisma.task.findUnique({ where: { id: issueId } });
  if (!task) {
    return NextResponse.json({ issue: null });
  }

  // Resolve assignee & reporter users
  const userIds = [task.assigneeId, task.reporterId].filter((id): id is string => Boolean(id));
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));
  const assignee = userMap.get(task.assigneeId ?? "") ?? null;
  const reporter = userMap.get(task.reporterId) ?? null;

  // Resolve parent issue if exists
  let parentIssue = null;
  if (task.parentTaskId) {
    const parentTask = await prisma.task.findUnique({ where: { id: task.parentTaskId } });
    if (parentTask) {
      const parentAssignee = parentTask.assigneeId
        ? await prisma.user.findUnique({ where: { id: parentTask.assigneeId } })
        : null;
      parentIssue = toIssueShape(parentTask, { assignee: parentAssignee });
    }
  }

  // Resolve child issues if any
  const childTasks = await prisma.task.findMany({
    where: { parentTaskId: task.id, deletedAt: null },
  });
  const childIssues = childTasks.map((ct) => toIssueShape(ct));

  const issue = toIssueShape(task, {
    assignee,
    reporter,
    parent: parentIssue,
    children: childIssues,
  });

  return NextResponse.json({ issue });
}

const patchIssueBodyValidator = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  type: z.nativeEnum(TaskType).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  sprintPosition: z.number().optional(),
  boardPosition: z.number().optional(),
  assigneeId: z.string().nullable().optional(),
  reporterId: z.string().optional(),
  parentId: z.string().nullable().optional(),
  sprintId: z.string().nullable().optional(),
  isDeleted: z.boolean().optional(),
  sprintColor: z.string().optional(),
});

export type PatchIssueBody = z.infer<typeof patchIssueBodyValidator>;
export type PatchIssueResponse = {
  issue: IssueShape;
};

/**
 * PATCH /api/issues/:issueId
 * Header: X-Dev-User-Id: local-user-1
 */
export async function PATCH(req: NextRequest, { params }: ParamsType) {
  const { userId } = await getRequestAuth(req);
  if (!userId) return new Response("Missing X-Dev-User-Id header", { status: 403 });
  const { success } = await ratelimit.limit(userId);
  if (!success) return new Response("Too many requests", { status: 429 });

  const { issueId } = params;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const body = await req.json();
  const validated = patchIssueBodyValidator.safeParse(body);
  if (!validated.success) {
    return new Response(
      "Invalid body. " + (validated.error.errors[0]?.message ?? ""),
      { status: 400 }
    );
  }

  const { data: valid } = validated;

  const currentTask = await prisma.task.findUnique({ where: { id: issueId } });
  if (!currentTask) return new Response("Task not found", { status: 404 });

  const updatedTask = await prisma.task.update({
    where: { id: issueId },
    data: toTaskUpdateData({
      name: valid.name,
      description: valid.description,
      status: valid.status,
      type: valid.type,
      sprintPosition: valid.sprintPosition,
      assigneeId: valid.assigneeId,
      reporterId: valid.reporterId,
      isDeleted: valid.isDeleted,
      sprintId: valid.sprintId,
      parentId: valid.parentId,
      sprintColor: valid.sprintColor,
      boardPosition: valid.boardPosition,
    }),
  });

  // Resolve assignee from local DB
  let assignee = null;
  if (updatedTask.assigneeId) {
    assignee = await prisma.user.findUnique({
      where: { id: updatedTask.assigneeId },
    }) ?? null;
  }
  const reporter = await prisma.user.findUnique({
    where: { id: updatedTask.reporterId },
  }) ?? null;

  const issue = toIssueShape(updatedTask, { assignee, reporter });

  return NextResponse.json({ issue });
}

/**
 * DELETE /api/issues/:issueId  (soft-delete)
 * Header: X-Dev-User-Id: local-user-1
 */
export async function DELETE(req: NextRequest, { params }: ParamsType) {
  const { userId } = await getRequestAuth(req);
  if (!userId) return new Response("Missing X-Dev-User-Id header", { status: 403 });
  const { success } = await ratelimit.limit(userId);
  if (!success) return new Response("Too many requests", { status: 429 });

  const { issueId } = params;

  const updatedTask = await prisma.task.update({
    where: { id: issueId },
    data: {
      deletedAt: new Date(),
      boardPosition: -1,
      sprintPosition: -1,
    },
  });

  const issue = toIssueShape(updatedTask);

  return NextResponse.json({ issue });
}


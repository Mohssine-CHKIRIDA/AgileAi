/**
 * app/api/issues/[issueId]/route.ts  (updated for AgileAI schema)
 */

import { type NextRequest, NextResponse } from "next/server";
import { prisma, ratelimit } from "@/server/db";
import { getDevAuth } from "@/server/dev-auth";
import { TaskStatus, TaskType } from "@prisma/client";
import { z } from "zod";
import { type IssueShape, toTaskUpdateData, toIssueShape } from "@/utils/task-adapter";
import { filterUserForClient } from "@/utils/helpers";
import { type GetIssuesResponse } from "../route";

export type GetIssueDetailsResponse = {
  issue: GetIssuesResponse["issues"][number] | null;
};

export type PostIssueResponse = { issue: IssueShape };

type ParamsType = { params: { issueId: string } };

// ── GET /api/issues/:issueId ──────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { issueId: string } }
) {
  const { issueId } = params;

  const task = await prisma.task.findUnique({ where: { id: issueId } });
  if (!task) return NextResponse.json({ issue: null });

  let parentShape = null;
  if (task.parentTaskId) {
    const parent = await prisma.task.findUnique({ where: { id: task.parentTaskId } });
    if (parent) {
      parentShape = toIssueShape(parent);
    }
  }

  const issue = toIssueShape(task, { parent: parentShape });
  return NextResponse.json<GetIssueDetailsResponse>({ issue });
}

// ── PATCH /api/issues/:issueId ────────────────────────────────────────────────

const patchIssueBodyValidator = z.object({
  name: z.string().optional(),                                 // maps → title
  description: z.string().optional(),
  type: z.nativeEnum(TaskType).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  sprintPosition: z.number().optional(),
  boardPosition: z.number().optional(),
  assigneeId: z.string().nullable().optional(),
  reporterId: z.string().optional(),
  parentId: z.string().nullable().optional(),                  // maps → parentTaskId
  sprintId: z.string().nullable().optional(),                  // maps → sprintPlanId
  isDeleted: z.boolean().optional(),                           // maps → deletedAt
  sprintColor: z.string().optional(),
});

export type PatchIssueBody = z.infer<typeof patchIssueBodyValidator>;
export type PatchIssueResponse = { issue: IssueShape };

export async function PATCH(req: NextRequest, { params }: ParamsType) {
  const { userId } = getDevAuth(req);
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

  const existing = await prisma.task.findUnique({ where: { id: issueId } });
  if (!existing) return new Response("Task not found", { status: 404 });

  const updated = await prisma.task.update({
    where: { id: issueId },
    data: toTaskUpdateData(valid),
  });

  // Resolve assignee from User table
  let assignee = null;
  if (updated.assigneeId) {
    const user = await prisma.user.findUnique({ where: { id: updated.assigneeId } });
    if (user) assignee = filterUserForClient(user);
  }

  const issue = toIssueShape(updated, { assignee });
  return NextResponse.json<PatchIssueResponse>({ issue });
}

// ── DELETE /api/issues/:issueId  (soft-delete) ───────────────────────────────

export async function DELETE(req: NextRequest, { params }: ParamsType) {
  const { userId } = getDevAuth(req);
  if (!userId) return new Response("Missing X-Dev-User-Id header", { status: 403 });
  const { success } = await ratelimit.limit(userId);
  if (!success) return new Response("Too many requests", { status: 429 });

  const { issueId } = params;

  const updated = await prisma.task.update({
    where: { id: issueId },
    data: {
      deletedAt: new Date(),              // was: isDeleted: true
      boardPosition: -1,
      sprintPosition: -1,
      sprintPlanId: null,                 // was: sprintId: "DELETED-SPRINT-ID"
    },
  });

  const issue = toIssueShape(updated);
  return NextResponse.json<PostIssueResponse>({ issue });
}
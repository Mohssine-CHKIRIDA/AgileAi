/**
 * LOCAL DEV version — auth via X-Dev-User-Id header.
 */
import { type NextRequest, NextResponse } from "next/server";
import { prisma, ratelimit } from "@/server/db";
import { getDevAuth } from "@/server/dev-auth";
import { IssueStatus, type Issue, IssueType, type DefaultUser } from "@prisma/client";
import { z } from "zod";
import { type GetIssuesResponse } from "../route";

export type GetIssueDetailsResponse = {
  issue: GetIssuesResponse["issues"][number] | null;
};
export type PostIssueResponse = { issue: Issue };

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
  const issue = await (prisma as any).issue.findUnique({ where: { id: issueId } });
  if (!issue?.parentId) {
    return NextResponse.json({ issue: { ...issue, parent: null } });
  }
  const parent = await (prisma as any).issue.findUnique({ where: { id: issue.parentId } });
  return NextResponse.json({ issue: { ...issue, parent } });
}

const patchIssueBodyValidator = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  type: z.nativeEnum(IssueType).optional(),
  status: z.nativeEnum(IssueStatus).optional(),
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
  issue: Issue & { assignee: DefaultUser | null };
};

/**
 * PATCH /api/issues/:issueId
 * Header: X-Dev-User-Id: local-user-1
 */
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

  const currentIssue = await (prisma as any).issue.findUnique({ where: { id: issueId } });
  if (!currentIssue) return new Response("Issue not found", { status: 404 });

  const issue = await (prisma as any).issue.update({
    where: { id: issueId },
    data: {
      name: valid.name ?? undefined,
      description: valid.description ?? undefined,
      status: valid.status ?? undefined,
      type: valid.type ?? undefined,
      sprintPosition: valid.sprintPosition ?? undefined,
      assigneeId: valid.assigneeId === undefined ? undefined : valid.assigneeId,
      reporterId: valid.reporterId ?? undefined,
      isDeleted: valid.isDeleted ?? undefined,
      sprintId: valid.sprintId === undefined ? undefined : valid.sprintId,
      parentId: valid.parentId === undefined ? undefined : valid.parentId,
      sprintColor: valid.sprintColor ?? undefined,
      boardPosition: valid.boardPosition ?? undefined,
    },
  });

  // Resolve assignee from local DB
  let assignee: DefaultUser | null = null;
  if (issue.assigneeId) {
    assignee = await (prisma as any).defaultUser.findUnique({
      where: { id: issue.assigneeId },
    }) ?? null;
  }

  return NextResponse.json({ issue: { ...issue, assignee } });
}

/**
 * DELETE /api/issues/:issueId  (soft-delete)
 * Header: X-Dev-User-Id: local-user-1
 */
export async function DELETE(req: NextRequest, { params }: ParamsType) {
  const { userId } = getDevAuth(req);
  if (!userId) return new Response("Missing X-Dev-User-Id header", { status: 403 });
  const { success } = await ratelimit.limit(userId);
  if (!success) return new Response("Too many requests", { status: 429 });

  const { issueId } = params;

  const issue = await (prisma as any).issue.update({
    where: { id: issueId },
    data: { isDeleted: true, boardPosition: -1, sprintPosition: -1 },
  });

  return NextResponse.json({ issue });
}

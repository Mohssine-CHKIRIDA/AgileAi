/**
 * app/api/issues/[issueId]/comments/[commentId]/route.ts  (updated for AgileAI schema)
 */

import { type NextRequest, NextResponse } from "next/server";
import { prisma, ratelimit } from "@/server/db";
import { getRequestAuth } from "@/server/dev-auth";
import { z } from "zod";
import { filterUserForClient } from "@/utils/helpers";
import { type GetIssueCommentResponse } from "../route";

const patchCommentBodyValidator = z.object({
  content: z.string().min(1),
});

// ── PATCH /api/issues/:issueId/comments/:commentId ────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: { commentId: string } }
) {
  const { userId } = await getRequestAuth(req);
  if (!userId) return new Response("Missing X-Dev-User-Id header", { status: 403 });
  const { success } = await ratelimit.limit(userId);
  if (!success) return new Response("Too many requests", { status: 429 });

  const { commentId } = params;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const body = await req.json();
  const validated = patchCommentBodyValidator.safeParse(body);
  if (!validated.success) {
    return new Response(
      "Invalid body. " + (validated.error.errors[0]?.message ?? ""),
      { status: 400 }
    );
  }

  const { data: valid } = validated;

  const comment = await prisma.comment.update({
    where: { id: commentId },
    data: { content: valid.content, isEdited: true },
  });

  const user = await prisma.user.findUnique({ where: { id: comment.authorId } });

  return NextResponse.json<GetIssueCommentResponse>({
    comment: { ...comment, author: user ? filterUserForClient(user) : null },
  });
}

// ── DELETE /api/issues/:issueId/comments/:commentId ───────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: { commentId: string } }
) {
  const { userId } = await getRequestAuth(req);
  if (!userId) return new Response("Missing X-Dev-User-Id header", { status: 403 });
  const { success } = await ratelimit.limit(userId);
  if (!success) return new Response("Too many requests", { status: 429 });

  const { commentId } = params;

  await prisma.comment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });

  return new Response(null, { status: 204 });
}

/**
 * app/api/issues/[issueId]/comments/route.ts  (updated for AgileAI schema)
 *
 * The route path stays /api/issues/:issueId/comments so no client changes needed.
 * Internally, issueId IS the taskId — same UUID, just renamed in the DB.
 */

import { type NextRequest, NextResponse } from "next/server";
import { prisma, ratelimit } from "@/server/db";
import { getDevAuth } from "@/server/dev-auth";
import { type User, type Comment } from "@prisma/client";
import { z } from "zod";
import { filterUserForClient } from "@/utils/helpers";

export type GetIssueCommentsResponse = {
  comments: GetIssueCommentResponse["comment"][];
};

export type GetIssueCommentResponse = {
  comment: Comment & { author: ReturnType<typeof filterUserForClient> | null };
};

// ── GET /api/issues/:issueId/comments ─────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { issueId: string } }
) {
  const { issueId } = params;

  const comments = await prisma.comment.findMany({
    where: {
      taskId: issueId,           // was: issueId — same UUID, renamed field
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (comments.length === 0) {
    return NextResponse.json<GetIssueCommentsResponse>({ comments: [] });
  }

  const authorIds = [...new Set(comments.map((c) => c.authorId))];
  const users = await prisma.user.findMany({   // was: prisma.defaultUser
    where: { id: { in: authorIds } },
  });

  const commentsForClient = comments.map((comment) => {
    const user = users.find((u: User) => u.id === comment.authorId) ?? null;
    return { ...comment, author: user ? filterUserForClient(user) : null };
  });

  return NextResponse.json<GetIssueCommentsResponse>({ comments: commentsForClient });
}

// ── POST /api/issues/:issueId/comments ───────────────────────────────────────

const postCommentBodyValidator = z.object({
  content: z.string().min(1),
  authorId: z.string(),
});

export type PostCommentBody = z.infer<typeof postCommentBodyValidator>;

export async function POST(
  req: NextRequest,
  { params }: { params: { issueId: string } }
) {
  const { userId } = getDevAuth(req);
  if (!userId) return new Response("Missing X-Dev-User-Id header", { status: 403 });
  const { success } = await ratelimit.limit(userId);
  if (!success) return new Response("Too many requests", { status: 429 });

  const { issueId } = params;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const body = await req.json();
  const validated = postCommentBodyValidator.safeParse(body);
  if (!validated.success) {
    return new Response(
      "Invalid body. " + (validated.error.errors[0]?.message ?? ""),
      { status: 400 }
    );
  }

  const { data: valid } = validated;

  const comment = await prisma.comment.create({
    data: {
      taskId: issueId,           // was: issueId
      content: valid.content,
      authorId: valid.authorId,
    },
  });

  const user = await prisma.user.findUnique({ where: { id: comment.authorId } });

  return NextResponse.json<GetIssueCommentResponse>(
    { comment: { ...comment, author: user ? filterUserForClient(user) : null } },
    { status: 201 }
  );
}

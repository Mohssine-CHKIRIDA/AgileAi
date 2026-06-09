/**
 * POST /api/project/join
 * Join an existing project by its key (e.g. JIRA-CLONE).
 */
import { type NextRequest, NextResponse } from "next/server";
import { prisma, ratelimit } from "@/server/db";
import { MemberRole, type Project } from "@prisma/client";
import { ensureUserSynced, getRequestAuth } from "@/server/dev-auth";
import { z } from "zod";

export type PostJoinProjectResponse = { project: Project };

const joinProjectBodyValidator = z.object({
  key: z
    .string()
    .min(2)
    .max(10)
    .regex(/^[A-Z0-9-]+$/, "Key must be uppercase letters, numbers, or hyphens"),
});

export type PostJoinProjectBody = z.infer<typeof joinProjectBodyValidator>;

export async function POST(req: NextRequest) {
  const { userId } = await getRequestAuth(req);
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { success } = await ratelimit.limit(userId);
  if (!success) return new Response("Too many requests", { status: 429 });

  await ensureUserSynced(userId);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const body = await req.json();
  const validated = joinProjectBodyValidator.safeParse(body);
  if (!validated.success) {
    return new Response(
      "Invalid body. " + (validated.error.errors[0]?.message ?? ""),
      { status: 400 }
    );
  }

  const { key } = validated.data;

  const project = await prisma.project.findFirst({
    where: { key: key.toUpperCase(), deletedAt: null },
  });

  if (!project) {
    return new Response(`No project found with key '${key}'`, { status: 404 });
  }

  await prisma.teamMember.upsert({
    where: { userId_projectId: { userId, projectId: project.id } },
    update: { joinedAt: new Date() },
    create: {
      userId,
      projectId: project.id,
      role: MemberRole.DEVELOPER,
    },
  });

  return NextResponse.json<PostJoinProjectResponse>({ project });
}

/**
 * LOCAL DEV version — auth via X-Dev-User-Id header, no Clerk, no ratelimit.
 */
import { type NextRequest, NextResponse } from "next/server";
import { prisma, ratelimit } from "@/server/db";
import { MemberRole, type Project } from "@prisma/client";
import { getDevAuth } from "@/server/dev-auth";
import { z } from "zod";

export type GetProjectResponse = { project: Project | null };
export type PostProjectResponse = { project: Project };

const postProjectBodyValidator = z.object({
  key: z
    .string()
    .min(2)
    .max(10)
    .regex(/^[A-Z0-9]+$/, "Key must be uppercase letters and numbers only"),
  name: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

export type PostProjectBody = z.infer<typeof postProjectBodyValidator>;

/**
 * GET /api/project?key=MYPROJECT
 * Header: X-Dev-User-Id: local-user-1
 */
export async function GET(req: NextRequest) {
  const { userId } = getDevAuth(req);
  if (!userId) {
    return new Response(
      "Missing X-Dev-User-Id header. Add it in Postman: X-Dev-User-Id: local-user-1",
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (!key) return new Response("Missing 'key' query parameter", { status: 400 });

  const project = await prisma.project.findUnique({ where: { key } });

  if (!project || project.deletedAt !== null) {
    return NextResponse.json<GetProjectResponse>({ project: null });
  }

  const membership = await prisma.teamMember.findUnique({
    where: { userId_projectId: { userId, projectId: project.id } },
  });

  if (!membership) {
    return new Response("Forbidden: not a member of this project", { status: 403 });
  }

  return NextResponse.json<GetProjectResponse>({ project });
}

/**
 * POST /api/project
 * Header: X-Dev-User-Id: local-user-1
 * Body: { key, name, description? }
 */
export async function POST(req: NextRequest) {
  const { userId } = getDevAuth(req);
  if (!userId) {
    return new Response(
      "Missing X-Dev-User-Id header. Add it in Postman: X-Dev-User-Id: local-user-1",
      { status: 403 }
    );
  }
  const { success } = await ratelimit.limit(userId);
  if (!success) return new Response("Too many requests", { status: 429 });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const body = await req.json();
  const validated = postProjectBodyValidator.safeParse(body);
  if (!validated.success) {
    return new Response(
      "Invalid body. " + (validated.error.errors[0]?.message ?? ""),
      { status: 400 }
    );
  }

  const { data: valid } = validated;

  const existing = await prisma.project.findUnique({ where: { key: valid.key } });
  if (existing) {
    return new Response(`Project key '${valid.key}' is already taken`, { status: 409 });
  }

  // Ensure the dev user exists in the User table (upsert so it's idempotent)
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      name: userId,
      email: `${userId}@localhost.dev`,
    },
  });

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        key: valid.key,
        name: valid.name,
        description: valid.description,
        imageUrl: valid.imageUrl,
        defaultAssignee: userId,
      },
    });
    await tx.teamMember.create({
      data: { userId, projectId: created.id, role: MemberRole.OWNER },
    });
    return created;
  });

  return NextResponse.json<PostProjectResponse>({ project }, { status: 201 });
}

import { type NextRequest, NextResponse } from "next/server";
import { prisma, ratelimit } from "@/server/db";
import { MemberRole, type Project } from "@prisma/client";
import { getAuth } from "@clerk/nextjs/server";
import { z } from "zod";

export type GetProjectResponse = {
  project: Project | null;
};

export type PostProjectResponse = {
  project: Project;
};

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
 * GET /api/project?key=MY-PROJECT
 *
 * Returns the project for the given key, provided the authenticated
 * user is a member of it.
 */
export async function GET(req: NextRequest) {
  const { userId } = getAuth(req);
  if (!userId) return new Response("Unauthenticated request", { status: 403 });

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (!key) {
    return new Response("Missing 'key' query parameter", { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { key },
  });

  if (!project || project.deletedAt !== null) {
    return NextResponse.json<GetProjectResponse>({ project: null });
  }

  // Confirm the caller is actually a member before returning project data
  const membership = await prisma.teamMember.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId: project.id,
      },
    },
  });

  if (!membership) {
    return new Response("Forbidden: not a member of this project", {
      status: 403,
    });
  }

  return NextResponse.json<GetProjectResponse>({ project });
}

/**
 * POST /api/project
 *
 * Creates a new project and adds the creator as OWNER.
 */
export async function POST(req: NextRequest) {
  const { userId } = getAuth(req);
  if (!userId) return new Response("Unauthenticated request", { status: 403 });
  const { success } = await ratelimit.limit(userId);
  if (!success) return new Response("Too many requests", { status: 429 });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const body = await req.json();
  const validated = postProjectBodyValidator.safeParse(body);

  if (!validated.success) {
    const message =
      "Invalid body. " + (validated.error.errors[0]?.message ?? "");
    return new Response(message, { status: 400 });
  }

  const { data: valid } = validated;

  // Check key uniqueness upfront for a cleaner error message
  const existing = await prisma.project.findUnique({
    where: { key: valid.key },
  });
  if (existing) {
    return new Response(`Project key '${valid.key}' is already taken`, {
      status: 409,
    });
  }

  // Create the project and seed the creator as OWNER in one transaction
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
      data: {
        userId,
        projectId: created.id,
        role: MemberRole.OWNER,
      },
    });

    return created;
  });

  return NextResponse.json<PostProjectResponse>({ project }, { status: 201 });
}
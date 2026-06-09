import { type NextRequest, NextResponse } from "next/server";
import { ensureUserSynced, getRequestAuth } from "@/server/dev-auth";
import { switchActiveProject } from "@/server/project-membership";
import { type Project } from "@prisma/client";
import { z } from "zod";

export type PostSwitchProjectResponse = { project: Project };

const switchBodyValidator = z.object({
  projectId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const { userId } = await getRequestAuth(req);
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  await ensureUserSynced(userId);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const body = await req.json();
  const validated = switchBodyValidator.safeParse(body);
  if (!validated.success) {
    return new Response("Invalid body", { status: 400 });
  }

  try {
    const project = await switchActiveProject(
      userId,
      validated.data.projectId
    );
    return NextResponse.json<PostSwitchProjectResponse>({ project });
  } catch {
    return new Response("You are not a member of this project", { status: 403 });
  }
}

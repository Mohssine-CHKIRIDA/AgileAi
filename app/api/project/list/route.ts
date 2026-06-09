import { type NextRequest, NextResponse } from "next/server";
import { ensureUserSynced, getRequestAuth } from "@/server/dev-auth";
import {
  getActiveMembership,
  listUserProjects,
} from "@/server/project-membership";

export type GetProjectListResponse = {
  projects: Array<{
    id: string;
    key: string;
    name: string;
    role: string;
    joinedAt: Date;
    isActive: boolean;
  }>;
  activeProjectId: string | null;
};

export async function GET(req: NextRequest) {
  const { userId } = await getRequestAuth(req);
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  await ensureUserSynced(userId);

  const active = await getActiveMembership(userId);
  const activeProjectId = active?.projectId ?? null;
  const projects = await listUserProjects(userId);

  return NextResponse.json<GetProjectListResponse>({
    projects: projects.map((p) => ({
      id: p.id,
      key: p.key,
      name: p.name,
      role: p.role,
      joinedAt: p.joinedAt,
      isActive: p.id === activeProjectId,
    })),
    activeProjectId,
  });
}

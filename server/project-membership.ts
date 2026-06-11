import { prisma } from "./db";
import { type Project } from "@prisma/client";

/** Active project = most recently switched membership (joinedAt desc). */
export async function getActiveMembership(userId: string) {
  return prisma.teamMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "desc" },
    include: { project: true },
  });
}

export async function getActiveProject(
  userId: string
): Promise<Project | null> {
  const membership = await getActiveMembership(userId);
  if (membership?.project && !membership.project.deletedAt) {
    return membership.project;
  }
  return null;
}

export async function listUserProjects(userId: string) {
  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    orderBy: { joinedAt: "desc" },
    include: { project: true },
  });

  return memberships
    .filter((m) => m.project && !m.project.deletedAt)
    .map((m) => ({
      ...m.project,
      role: m.role,
      joinedAt: m.joinedAt,
      isActive: false,
    }));
}

export async function switchActiveProject(
  userId: string,
  projectId: string
): Promise<Project> {
  const membership = await prisma.teamMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    include: { project: true },
  });

  if (!membership?.project || membership.project.deletedAt) {
    throw new Error("NOT_A_MEMBER");
  }

  await prisma.teamMember.update({
    where: { userId_projectId: { userId, projectId } },
    data: { joinedAt: new Date() },
  });

  return membership.project;
}

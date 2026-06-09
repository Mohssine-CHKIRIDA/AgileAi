/**
 * server/functions.ts (updated for AgileAI schema)
 *
 * Uses Task, SprintPlan, User (new models).
 * Issues are scoped to the user's project membership, not creatorId.
 */

import { prisma } from "./db";
import { getActiveMembership } from "./project-membership";
import { generateIssuesForClient, filterUserForClient } from "@/utils/helpers";
import { SprintPlanStatus } from "@prisma/client";
import { toSprintShape } from "@/utils/task-adapter";

const INIT_PROJECT_ID = "init-project-id-dq8yh-d0as89hjd";
const INIT_PROJECT_KEY = "JIRA-CLONE";

// ── Issues / Tasks ────────────────────────────────────────────────────────────

/**
 * getInitialIssuesFromServer
 * Returns all tasks for the user's project.
 */
export async function getInitialIssuesFromServer(userId: string | undefined | null) {
  let projectId: string = INIT_PROJECT_ID;

  if (userId) {
    const membership = await getActiveMembership(userId);
    if (!membership?.projectId) {
      return [];
    }
    projectId = membership.projectId;
  }

  const activeTasks = await prisma.task.findMany({
    where: {
      projectId,
      deletedAt: null,
    },
  });

  if (!activeTasks || activeTasks.length === 0) {
    return [];
  }

  const activeSprints = await prisma.sprintPlan.findMany({
    where: {
      projectId,
      status: SprintPlanStatus.ACTIVE,
      deletedAt: null,
    },
  });

  const taskUserIds = activeTasks
    .flatMap((t) => [t.assigneeId, t.reporterId])
    .filter((id): id is string => Boolean(id));

  const teamMembers = await prisma.teamMember.findMany({
    where: { projectId },
    select: { userId: true },
  });

  const userIds = [
    ...new Set([...taskUserIds, ...teamMembers.map((m) => m.userId)]),
  ];

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
  });

  return generateIssuesForClient(
    activeTasks,
    users.map(filterUserForClient),
    activeSprints.map((s) => s.id)
  );
}

// ── Project ───────────────────────────────────────────────────────────────────

export async function getInitialProjectFromServer(userId?: string | null) {
  if (userId) {
    const membership = await getActiveMembership(userId);
    if (membership?.project && !membership.project.deletedAt) {
      return membership.project;
    }
    return null;
  }

  return prisma.project.findUnique({ where: { key: INIT_PROJECT_KEY } });
}

// ── Sprints ───────────────────────────────────────────────────────────────────

export async function getInitialSprintsFromServer(userId: string | undefined) {
  let projectId: string = INIT_PROJECT_ID;

  if (userId) {
    const membership = await getActiveMembership(userId);
    if (!membership?.projectId) {
      return [];
    }
    projectId = membership.projectId;
  }

  const sprints = await prisma.sprintPlan.findMany({
    where: {
      projectId,
      deletedAt: null,
      status: {
        in: [SprintPlanStatus.ACTIVE, SprintPlanStatus.DRAFT],
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return sprints.map(toSprintShape);
}

// ── Init helpers ──────────────────────────────────────────────────────────────

export async function initProject() {
  await prisma.project.upsert({
    where: { id: INIT_PROJECT_ID },
    update: {},
    create: {
      id: INIT_PROJECT_ID,
      name: "Jira Clone Project",
      key: INIT_PROJECT_KEY,
    },
  });
}

export async function initDefaultUsers(
  defaultUsers: Array<{ id: string; email: string; name: string; avatar?: string }>
) {
  await Promise.all(
    defaultUsers.map((user) =>
      prisma.user.upsert({
        where: { id: user.id },
        update: { avatar: user.avatar },
        create: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
        },
      })
    )
  );
}

export async function initDefaultProjectMembers(
  defaultUsers: Array<{ id: string }>
) {
  await Promise.all(
    defaultUsers.map((user) =>
      prisma.teamMember.upsert({
        where: {
          userId_projectId: {
            userId: user.id,
            projectId: INIT_PROJECT_ID,
          },
        },
        update: {},
        create: {
          userId: user.id,
          projectId: INIT_PROJECT_ID,
        },
      })
    )
  );
}

export async function initDefaultTasks(
  tasks: Array<{
    id: string;
    key: string;
    title: string;
    type: "BUG" | "TASK" | "SUBTASK" | "STORY" | "EPIC";
    reporterId: string;
    creatorId: string;
    projectId: string;
    sprintPlanId?: string;
    parentTaskId?: string;
    sprintPosition?: number;
    boardPosition?: number;
    sprintColor?: string;
  }>
) {
  await Promise.all(
    tasks.map((task) =>
      prisma.task.upsert({
        where: { id: task.id },
        update: {},
        create: task,
      })
    )
  );
}

export async function initDefaultTaskComments(
  comments: Array<{
    id: string;
    taskId: string;
    authorId: string;
    content: string;
  }>
) {
  await Promise.all(
    comments.map((comment) =>
      prisma.comment.upsert({
        where: { id: comment.id },
        update: {},
        create: comment,
      })
    )
  );
}

export async function initDefaultSprints(
  sprints: Array<{
    id: string;
    name: string;
    goal?: string;
    creatorId: string;
    projectId: string;
    color?: string;
    status?: "DRAFT" | "ACTIVE" | "CLOSED" | "VALIDATED";
  }>
) {
  await Promise.all(
    sprints.map((sprint) =>
      prisma.sprintPlan.upsert({
        where: { id: sprint.id },
        update: {},
        create: {
          id: sprint.id,
          name: sprint.name,
          goal: sprint.goal ?? "",
          creatorId: sprint.creatorId,
          projectId: sprint.projectId,
          color: sprint.color ?? "#0052CC",
          status: sprint.status ?? "DRAFT",
        },
      })
    )
  );
}
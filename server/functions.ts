/**
 * server/functions.ts  (updated for AgileAI schema)
 *
 * Uses Task, SprintPlan, User (new models) instead of Issue, Sprint, DefaultUser.
 * The returned data shape is identical to before thanks to the task-adapter.
 */

import { prisma } from "./db";
import { generateIssuesForClient, filterUserForClient } from "@/utils/helpers";
import { SprintPlanStatus } from "@prisma/client";
import { toSprintShape } from "@/utils/task-adapter";

// ── Issues / Tasks ────────────────────────────────────────────────────────────

/**
 * getInitialIssuesFromServer
 * Previously queried prisma.issue — now queries prisma.task.
 * Returns IssueShape[] so all page components stay unchanged.
 */
export async function getInitialIssuesFromServer(userId: string | undefined | null) {
  const activeTasks = await prisma.task.findMany({
    where: {
      creatorId: userId ?? "init",
      deletedAt: null,              // was: isDeleted: false
    },
  });

  if (!activeTasks || activeTasks.length === 0) {
    return [];
  }

  // Active sprints — used to compute sprintIsActive on each task
  const activeSprints = await prisma.sprintPlan.findMany({
    where: { status: SprintPlanStatus.ACTIVE },
  });

  // Collect all user IDs referenced by the tasks
  const userIds = [
    ...new Set(
      activeTasks
        .flatMap((t) => [t.assigneeId, t.reporterId])
        .filter((id): id is string => Boolean(id))
    ),
  ];

  // Pull user data from prisma.user (business schema) — no Clerk needed
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

export async function getInitialProjectFromServer(key = "JIRA-CLONE") {
  const project = await prisma.project.findUnique({ where: { key } });
  return project;
}

// ── Sprints ───────────────────────────────────────────────────────────────────

/**
 * getInitialSprintsFromServer
 * Previously queried prisma.sprint — now queries prisma.sprintPlan.
 * Returns the same sprint shape the UI expects (via toSprintShape adapter).
 */
export async function getInitialSprintsFromServer(userId: string | undefined) {
  const sprints = await prisma.sprintPlan.findMany({
    where: {
      creatorId: userId ?? "init",
      deletedAt: null,
      status: {
        in: [SprintPlanStatus.ACTIVE, SprintPlanStatus.DRAFT],
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return sprints.map(toSprintShape);
}

// ── Init helpers (seed / upsert on first login) ───────────────────────────────

export async function initProject() {
  await prisma.project.upsert({
    where: { id: "init-project-id-dq8yh-d0as89hjd" },
    update: {},
    create: {
      id: "init-project-id-dq8yh-d0as89hjd",
      name: "Jira Clone Project",
      key: "JIRA-CLONE",
    },
  });
}

/**
 * initDefaultUsers
 * Previously upserted into prisma.defaultUser — now uses prisma.user (same fields).
 */
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

/**
 * initDefaultProjectMembers
 * Previously upserted into prisma.member — now uses prisma.teamMember.
 */
export async function initDefaultProjectMembers(
  defaultUsers: Array<{ id: string }>
) {
  await Promise.all(
    defaultUsers.map((user) =>
      prisma.teamMember.upsert({
        where: {
          userId_projectId: {
            userId: user.id,
            projectId: "init-project-id-dq8yh-d0as89hjd",
          },
        },
        update: {},
        create: {
          userId: user.id,
          projectId: "init-project-id-dq8yh-d0as89hjd",
        },
      })
    )
  );
}

/**
 * initDefaultTasks  (was initDefaultIssues)
 * Seed data generator should return Task-shaped objects (title instead of name, etc).
 * If your seed data still uses old Issue field names, run them through toTaskCreateData first.
 */
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

/**
 * initDefaultTaskComments  (was initDefaultIssueComments)
 */
export async function initDefaultTaskComments(
  comments: Array<{
    id: string;
    taskId: string;   // was issueId
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

/**
 * initDefaultSprints
 * Previously upserted into prisma.sprint — now uses prisma.sprintPlan.
 */
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

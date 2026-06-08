/* eslint-disable */

import { PrismaClient } from "@prisma/client";

import {
  defaultUsers,
  generateInitialUserComments,
  generateInitialUserIssues,
  generateInitialUserSprints,
} from "./seed-data";

const prisma = new PrismaClient();

const PROJECT_ID = "init-project-id-dq8yh-d0as89hjd";

async function initProject() {
  await prisma.project.upsert({
    where: { id: PROJECT_ID },
    update: {},
    create: {
      id: PROJECT_ID,
      name: "Jira Clone Project",
      key: "JIRA-CLONE",
    },
  });
}

/* ---------------- USERS ---------------- */

async function initUsers() {
  await Promise.all(
    defaultUsers.map((u) =>
      prisma.user.upsert({
        where: { id: u.id },
        update: { avatar: u.avatar, name: u.name },
        create: {
          id: u.id,
          email: u.email,
          name: u.name,
          avatar: u.avatar,
        },
      })
    )
  );
}

/* ---------------- TEAM MEMBERS ---------------- */

async function initTeamMembers() {
  await Promise.all(
    defaultUsers.map((u) =>
      prisma.teamMember.upsert({
        where: {
          userId_projectId: {
            userId: u.id,
            projectId: PROJECT_ID,
          },
        },
        update: {},
        create: {
          userId: u.id,
          projectId: PROJECT_ID,
        },
      })
    )
  );
}

/* ---------------- SPRINTS ---------------- */

async function initSprints() {
  const user = defaultUsers[0];
  if (!user) throw new Error("No default users available for seeding sprints.");
  const sprints = generateInitialUserSprints(user.id);

  await Promise.all(
    sprints.map((s) =>
      prisma.sprintPlan.upsert({
        where: { id: s.id },
        update: {},
        create: {
          id: s.id,
          projectId: PROJECT_ID,
          name: s.name,
          goal: s.description ?? "",
          startDate: s.startDate,
          endDate: s.endDate,
          status: s.status as any,
          creatorId: user.id,
        },
      })
    )
  );
}

/* ---------------- TASKS ---------------- */

async function initTasks() {
  const user = defaultUsers[0];
  if (!user) throw new Error("No default users available for seeding tasks.");
  const issues = generateInitialUserIssues(user.id);

  await Promise.all(
    issues.map((i) =>
      prisma.task.upsert({
        where: {
          id: i.id,
        },
        update: {},
        create: {
          id: i.id,
          key: i.key,
          projectId: PROJECT_ID,

          title: i.name,
          description: i.description,

          status: i.status as any,
          type: i.type as any,

          sprintPosition: i.sprintPosition,
          boardPosition: i.boardPosition,

          reporterId: i.reporterId,
          assigneeId: i.assigneeId,
          creatorId: user.id,

          parentTaskId: i.parentId ?? null,
          sprintPlanId: i.sprintId ?? null,

          sprintColor: i.sprintColor ?? null,
          deletedAt: i.isDeleted ? new Date() : null,
        },
      })
    )
  );
}

/* ---------------- COMMENTS ---------------- */

async function initComments() {
  const user = defaultUsers[0];
  if (!user) throw new Error("No default users available for seeding comments.");
  const comments = generateInitialUserComments(user.id);

  await Promise.all(
    comments.map((c) =>
      prisma.comment.upsert({
        where: { id: c.id },
        update: {},
        create: {
          id: c.id,
          taskId: c.taskId, // mapped from old seed-data
          authorId: c.authorId,
          content: c.content,
          isEdited: c.isEdited,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          deletedAt: c.deletedAt,
        },
      })
    )
  );
}

/* ---------------- MAIN ---------------- */

async function main() {
  await initProject();
  await initUsers();
  await initTeamMembers();
  await initSprints();
  await initTasks();
  await initComments();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
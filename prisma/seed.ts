/* eslint-disable */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PROJECT_ID = "init-project-id-dq8yh-d0as89hjd";

const defaultUsers = [
  {
    id: "user_2PwZmH2xP5aE0svR6hDH4AwDlcu",
    name: "Joe Rogan",
    email: "joe.rogan@jira.com",
    avatar: "https://images.clerk.dev/uploaded/img_2PwZslOi493tjduHiBADgDxhHlg.png",
  },
  {
    id: "user_2PwYvTgm6kvgJIbWwN0xsei8izu",
    name: "Steve Jobs",
    email: "steve.jobs@jira.com",
    avatar: "https://images.clerk.dev/uploaded/img_2PwjGSsR9nGqEhAyt5nydgXhBI1.webp",
  },
  {
    id: "user_2PvBRngdvenUlFvQNAWbXIvYVy5",
    name: "Sheldon Cooper",
    email: "sheldon.cooper@jira.com",
    avatar: "https://images.clerk.dev/uploaded/img_2Pwinee7Eg6qoSgqailCZSJt3uS.webp",
  },
];

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
  console.log("✓ Project seeded");
}

async function initDefaultUsers() {
  for (const user of defaultUsers) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: { avatar: user.avatar, name: user.name },
      create: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    });
  }
  console.log("✓ Users seeded");
}

async function initDefaultProjectMembers() {
  for (const user of defaultUsers) {
    await prisma.teamMember.upsert({
      where: {
        userId_projectId: { userId: user.id, projectId: PROJECT_ID },
      },
      update: {},
      create: {
        userId: user.id,
        projectId: PROJECT_ID,
        role: "DEVELOPER",
      },
    });
  }
  console.log("✓ Team members seeded");
}

async function initDefaultSprints() {
  const now = new Date();
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const creatorId = defaultUsers[0]!.id;

  await prisma.sprintPlan.upsert({
    where: { id: "edd0e2b1-b230-4f02-init" },
    update: {},
    create: {
      id: "edd0e2b1-b230-4f02-init",
      name: "Bazinga Blitz",
      goal: "Deliver the first working increment",
      projectId: PROJECT_ID,
      creatorId,
      startDate: now,
      endDate: oneWeekFromNow,
      status: "ACTIVE",
      color: "#0052CC",
    },
  });

  await prisma.sprintPlan.upsert({
    where: { id: "880ececc-f628-4de3-init" },
    update: {},
    create: {
      id: "880ececc-f628-4de3-init",
      name: "Cognitive Conundrum",
      goal: "Lets figure out this conundrum together.",
      projectId: PROJECT_ID,
      creatorId,
      status: "DRAFT",
      color: "#0052CC",
    },
  });
  console.log("✓ Sprints seeded");
}

async function initDefaultTasks() {
  const now = new Date();
  const reporterId = defaultUsers[0]!.id;
  const creatorId = defaultUsers[0]!.id;

  const tasks = [
    {
      id: "7f9b5dba-6017-4e56-init",
      key: "JIRA-CLONE-1",
      title: "Issue descriptions can contain code snippets",
      status: "IN_PROGRESS" as const,
      type: "BUG" as const,
      priority: "P2_HIGH" as const,
      sprintPosition: 1,
      boardPosition: 0,
      reporterId,
      creatorId,
      projectId: PROJECT_ID,
      sprintPlanId: "edd0e2b1-b230-4f02-init",
      assigneeId: defaultUsers[1]!.id,
    },
    {
      id: "55a7d19e-844c-40fd-init",
      key: "JIRA-CLONE-2",
      title: "Each issue can contain comments by the project's members",
      status: "DONE" as const,
      type: "TASK" as const,
      priority: "P3_MEDIUM" as const,
      sprintPosition: 2,
      boardPosition: -1,
      reporterId,
      creatorId,
      projectId: PROJECT_ID,
      sprintPlanId: "edd0e2b1-b230-4f02-init",
      assigneeId: defaultUsers[2]!.id,
    },
    {
      id: "cd44dff4-d69b-4724-init",
      key: "JIRA-CLONE-3",
      title: "This is an issue of type: STORY",
      status: "DONE" as const,
      type: "STORY" as const,
      priority: "P3_MEDIUM" as const,
      sprintPosition: 1,
      boardPosition: -1,
      reporterId,
      creatorId,
      projectId: PROJECT_ID,
      sprintPlanId: null,
      assigneeId: defaultUsers[0]!.id,
    },
    {
      id: "b6e4ace2-6911-40c6-init",
      key: "JIRA-CLONE-4",
      title: "Think Different Odyssey",
      status: "TODO" as const,
      type: "EPIC" as const,
      priority: "P3_MEDIUM" as const,
      sprintPosition: 2,
      boardPosition: -1,
      reporterId,
      creatorId,
      projectId: PROJECT_ID,
      sprintPlanId: null,
      sprintColor: "#0b66e4",
    },
    {
      id: "70c4152c-2063-47ad-init",
      key: "JIRA-CLONE-5",
      title: "Visionary Ventures",
      status: "TODO" as const,
      type: "EPIC" as const,
      priority: "P3_MEDIUM" as const,
      sprintPosition: 6,
      boardPosition: -1,
      reporterId,
      creatorId,
      projectId: PROJECT_ID,
      sprintPlanId: null,
      sprintColor: "#f97463",
    },
    {
      id: "6f139401-d32e-4386-init",
      key: "JIRA-CLONE-6",
      title: "Click here to see the child issues of this task",
      status: "TODO" as const,
      type: "TASK" as const,
      priority: "P2_HIGH" as const,
      sprintPosition: 4,
      boardPosition: 1,
      reporterId,
      creatorId,
      projectId: PROJECT_ID,
      sprintPlanId: "edd0e2b1-b230-4f02-init",
      assigneeId: defaultUsers[2]!.id,
    },
    {
      id: "af3dde63-3ddb-4e72-init",
      key: "JIRA-CLONE-7",
      title: "Issues can belong to an Epic",
      status: "IN_PROGRESS" as const,
      type: "TASK" as const,
      priority: "P3_MEDIUM" as const,
      sprintPosition: 3,
      boardPosition: -1,
      reporterId,
      creatorId,
      projectId: PROJECT_ID,
      sprintPlanId: "edd0e2b1-b230-4f02-init",
      assigneeId: defaultUsers[1]!.id,
      parentTaskId: "b6e4ace2-6911-40c6-init",
    },
    {
      id: "1c5818e1-b920-45b2-init",
      key: "JIRA-CLONE-8",
      title: "Issue types can be changed, click here and try it out!",
      status: "TODO" as const,
      type: "STORY" as const,
      priority: "P3_MEDIUM" as const,
      sprintPosition: 1,
      boardPosition: -1,
      reporterId,
      creatorId,
      projectId: PROJECT_ID,
      sprintPlanId: "880ececc-f628-4de3-init",
      parentTaskId: "b6e4ace2-6911-40c6-init",
    },
    {
      id: "fd552347-0e93-4c98-init",
      key: "JIRA-CLONE-9",
      title: "This is a child issue",
      status: "TODO" as const,
      type: "SUBTASK" as const,
      priority: "P3_MEDIUM" as const,
      sprintPosition: 3,
      boardPosition: -1,
      reporterId,
      creatorId,
      projectId: PROJECT_ID,
      sprintPlanId: null,
      parentTaskId: "6f139401-d32e-4386-init",
    },
    {
      id: "ecab71cf-a4d7-4416-init",
      key: "JIRA-CLONE-10",
      title: "Child issues have statuses as well",
      status: "DONE" as const,
      type: "SUBTASK" as const,
      priority: "P3_MEDIUM" as const,
      sprintPosition: 5,
      boardPosition: -1,
      reporterId,
      creatorId,
      projectId: PROJECT_ID,
      sprintPlanId: null,
      parentTaskId: "6f139401-d32e-4386-init",
    },
    {
      id: "2f04b476-5a2b-4073-init",
      key: "JIRA-CLONE-11",
      title: "This is also a child issue",
      status: "TODO" as const,
      type: "SUBTASK" as const,
      priority: "P3_MEDIUM" as const,
      sprintPosition: 4,
      boardPosition: -1,
      reporterId,
      creatorId,
      projectId: PROJECT_ID,
      sprintPlanId: null,
      parentTaskId: "6f139401-d32e-4386-init",
    },
    {
      id: "5521fc5a-af0b-4905-init",
      key: "JIRA-CLONE-12",
      title: "Try editing the title of this bug!",
      status: "IN_PROGRESS" as const,
      type: "BUG" as const,
      priority: "P2_HIGH" as const,
      sprintPosition: 7,
      boardPosition: -1,
      reporterId,
      creatorId,
      projectId: PROJECT_ID,
      sprintPlanId: null,
      parentTaskId: "70c4152c-2063-47ad-init",
    },
  ];

  // Insert non-child tasks first
  const parents = tasks.filter((t) => !t.parentTaskId);
  const children = tasks.filter((t) => t.parentTaskId);

  for (const task of parents) {
    await prisma.task.upsert({
      where: { id: task.id },
      update: {},
      create: task as any,
    });
  }
  for (const task of children) {
    await prisma.task.upsert({
      where: { id: task.id },
      update: {},
      create: task as any,
    });
  }
  console.log("✓ Tasks seeded");
}

async function initDefaultComments() {
  const comments = [
    {
      id: "3c076895-c356-43d8-init",
      content: '{"root":{"children":[{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"I must express my astonishment at the sheer lack of scientific rigor in your proposed solution. Sincerely, Dr. Sheldon Cooper.","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1}],"direction":"ltr","format":"","indent":0,"type":"root","version":1}}',
      authorId: "user_2PvBRngdvenUlFvQNAWbXIvYVy5",
      taskId: "cd44dff4-d69b-4724-init",
    },
    {
      id: "87423726-9cdb-4e03-init",
      content: '{"root":{"children":[{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Thank you for your concerns, but innovation knows no boundaries. We will persist in exploring new possibilities.","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1}],"direction":"ltr","format":"","indent":0,"type":"root","version":1}}',
      authorId: "user_2PwYvTgm6kvgJIbWwN0xsei8izu",
      taskId: "55a7d19e-844c-40fd-init",
    },
  ];

  for (const comment of comments) {
    await prisma.comment.upsert({
      where: { id: comment.id },
      update: {},
      create: comment,
    });
  }
  console.log("✓ Comments seeded");
}

async function main() {
  console.log("🌱 Seeding database...");
  await initProject();
  await initDefaultUsers();
  await initDefaultProjectMembers();
  await initDefaultSprints();
  await initDefaultTasks();
  await initDefaultComments();
  console.log("✅ Database seeded successfully!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
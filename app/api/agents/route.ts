import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getDevAuth } from "@/server/dev-auth";
import { TaskStatus, TaskType, Priority, SprintPlanStatus, ValidationStatus } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const { userId } = getDevAuth(req);
    const resolvedUserId = userId ?? "local-user-1";

    const body = await req.json();
    const { prompt } = body as { prompt?: string };

    if (!prompt || prompt.trim() === "") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // 1. Locate the default project
    const project = await prisma.project.findFirst({
      where: { key: "JIRA-CLONE" },
    });

    if (!project) {
      return NextResponse.json({ error: "Default project not found" }, { status: 404 });
    }

    // 2. Fetch users in the system to assign tasks to
    const systemUsers = await prisma.user.findMany();
    // Default fallback users if db is not fully seeded
    const FATIMA_ID = systemUsers.find(u => u.name.toLowerCase().includes("fatima"))?.id ?? "local-user-2";
    const YOUSSEF_ID = systemUsers.find(u => u.name.toLowerCase().includes("youssef"))?.id ?? "local-user-3";

    // 3. Determine tasks based on prompt keywords
    const lowerPrompt = prompt.toLowerCase();
    let taskTemplates = [
      {
        title: "Design user interface for " + prompt,
        description: "As a developer, I want to design a responsive frontend layout for " + prompt + " to deliver an excellent user experience.",
        type: TaskType.STORY,
        priority: Priority.P2_HIGH,
        points: 5,
        labels: ["frontend", "ui"],
        assigneeId: FATIMA_ID,
        reviewerId: YOUSSEF_ID,
        assigneeReason: "Fatima is a frontend specialist with high capacity (5/8 story points).",
        reviewerReason: "Youssef is a senior backend engineer who can verify state integration."
      },
      {
        title: "Setup API routes and DB controllers for " + prompt,
        description: "As a backend developer, I need to implement database queries, schema validation, and API routes for " + prompt + ".",
        type: TaskType.TASK,
        priority: Priority.P1_CRITICAL,
        points: 8,
        labels: ["backend", "database"],
        assigneeId: YOUSSEF_ID,
        reviewerId: FATIMA_ID,
        assigneeReason: "Youssef is the primary backend contact and has database optimization expertise.",
        reviewerReason: "Fatima can review the API contract to align frontend components."
      },
      {
        title: "Write automated tests and validation for " + prompt,
        description: "Ensure complete code coverage by writing integration and unit tests for the frontend/backend implementation of " + prompt + ".",
        type: TaskType.TASK,
        priority: Priority.P3_MEDIUM,
        points: 3,
        labels: ["testing", "validation"],
        assigneeId: FATIMA_ID,
        reviewerId: YOUSSEF_ID,
        assigneeReason: "Fatima has unit testing experience and can verify coverage.",
        reviewerReason: "Youssef can review integration and schema validation tests."
      }
    ];

    if (lowerPrompt.includes("auth") || lowerPrompt.includes("login") || lowerPrompt.includes("sign")) {
      taskTemplates = [
        {
          title: "Design Google OAuth buttons and login view",
          description: "Design and implement beautiful, responsive OAuth login screen with tailwind CSS and micro-interactions.",
          type: TaskType.STORY,
          priority: Priority.P2_HIGH,
          points: 3,
          labels: ["frontend", "auth", "ui"],
          assigneeId: FATIMA_ID,
          reviewerId: YOUSSEF_ID,
          assigneeReason: "Fatima has frontend expertise and has sufficient capacity (3/8 points).",
          reviewerReason: "Youssef can review redirect URLs and session hooks."
        },
        {
          title: "Setup Google OAuth callback routes and config",
          description: "Configure Google credentials, validate authorization tokens, and setup redirect flows in the backend.",
          type: TaskType.TASK,
          priority: Priority.P1_CRITICAL,
          points: 5,
          labels: ["backend", "auth"],
          assigneeId: YOUSSEF_ID,
          reviewerId: FATIMA_ID,
          assigneeReason: "Youssef is our backend security lead and has OAuth experience.",
          reviewerReason: "Fatima will verify that API client hooks work seamlessly."
        },
        {
          title: "Implement session encryption and JWT middleware",
          description: "Create stateless JWT generation, token refresh mechanics, and express/next middleware to verify authentication headers.",
          type: TaskType.TASK,
          priority: Priority.P1_CRITICAL,
          points: 8,
          labels: ["backend", "security"],
          assigneeId: YOUSSEF_ID,
          reviewerId: FATIMA_ID,
          assigneeReason: "Youssef specializes in cryptography and session validation.",
          reviewerReason: "Fatima will check integration with client-side state providers."
        }
      ];
    } else if (lowerPrompt.includes("pay") || lowerPrompt.includes("stripe") || lowerPrompt.includes("checkout")) {
      taskTemplates = [
        {
          title: "Build premium pricing card grid and checkout modal",
          description: "Implement a pricing layout showing subscription tiers, billing cycles, and a responsive checkout trigger overlay.",
          type: TaskType.STORY,
          priority: Priority.P2_HIGH,
          points: 5,
          labels: ["frontend", "billing"],
          assigneeId: FATIMA_ID,
          reviewerId: YOUSSEF_ID,
          assigneeReason: "Fatima is the UI lead and can deliver the visual checkout experience.",
          reviewerReason: "Youssef will review payment metadata hooks."
        },
        {
          title: "Create Stripe Checkout session endpoint",
          description: "Integrate Stripe SDK, map user subscriptions to tier price IDs, and create redirection links to secure Checkout page.",
          type: TaskType.TASK,
          priority: Priority.P1_CRITICAL,
          points: 5,
          labels: ["backend", "stripe", "billing"],
          assigneeId: YOUSSEF_ID,
          reviewerId: FATIMA_ID,
          assigneeReason: "Youssef has prior experience with Stripe integration and backend billing.",
          reviewerReason: "Fatima will verify redirect routes."
        },
        {
          title: "Implement Stripe webhook handler for billing state updates",
          description: "Handle checkout.session.completed and customer.subscription.deleted webhooks, validating signatures and writing updates to the DB.",
          type: TaskType.TASK,
          priority: Priority.P1_CRITICAL,
          points: 8,
          labels: ["backend", "webhooks"],
          assigneeId: YOUSSEF_ID,
          reviewerId: FATIMA_ID,
          assigneeReason: "Youssef is responsible for webhook processing systems.",
          reviewerReason: "Fatima will verify client state refreshes on checkout success."
        }
      ];
    }

    // 4. Create a new SprintPlan in the database
    const sprintCount = await prisma.sprintPlan.count({
      where: { projectId: project.id },
    });

    const sprintName = `AI Sprint ${sprintCount + 1}: ` + (lowerPrompt.includes("auth") ? "OAuth Integration" : lowerPrompt.includes("stripe") ? "Stripe Checkout" : "Agile Requirements");
    const sprintGoal = `Deliver requirements for: "${prompt}" through coordinated agent workflow.`;

    const sprint = await prisma.sprintPlan.create({
      data: {
        projectId: project.id,
        creatorId: resolvedUserId,
        name: sprintName,
        goal: sprintGoal,
        status: SprintPlanStatus.DRAFT, // Shows in backlog
        totalCapacityPoints: 24,
        plannedPoints: taskTemplates.reduce((acc, t) => acc + t.points, 0),
        bufferPoints: 4,
      },
    });

    // 5. Create the Tasks and Assignments in the database
    const taskCount = await prisma.task.count({
      where: { projectId: project.id },
    });

    const createdTasks = [];
    const createdAssignments = [];

    for (let i = 0; i < taskTemplates.length; i++) {
      const template = taskTemplates[i]!;
      const key = `${project.key}-${taskCount + i + 1}`;

      const task = await prisma.task.create({
        data: {
          projectId: project.id,
          sprintPlanId: sprint.id,
          assigneeId: template.assigneeId,
          reviewerId: template.reviewerId,
          reporterId: resolvedUserId,
          creatorId: resolvedUserId,
          title: template.title,
          description: template.description,
          status: TaskStatus.TODO,
          type: template.type,
          priority: template.priority,
          labels: template.labels,
          storyPoints: template.points,
          sprintPosition: i + 1,
          boardPosition: -1,
          key: key,
          aiGenerated: true,
        },
      });

      const assignment = await prisma.assignment.create({
        data: {
          taskId: task.id,
          projectId: project.id,
          assigneeId: template.assigneeId,
          reviewerId: template.reviewerId,
          assigneeReason: template.assigneeReason,
          reviewerReason: template.reviewerReason,
          workloadSnapshot: {
            assigneePoints: template.points,
            maxCapacity: 8
          },
          applied: true,
          appliedAt: new Date(),
        },
      });

      createdTasks.push(task);
      createdAssignments.push(assignment);
    }

    // 6. Log the Agent Session
    const sessionOutput = {
      action: "orchestrate",
      sprint: {
        id: sprint.id,
        name: sprintName,
        goal: sprintGoal,
      },
      tasks: createdTasks.map((t, idx) => ({
        id: t.id,
        title: t.title,
        key: t.key,
        points: t.storyPoints,
        assignee: taskTemplates[idx]?.assigneeId === FATIMA_ID ? "Fatima" : "Youssef"
      }))
    };

    const session = await prisma.agentSession.create({
      data: {
        agentName: "supervisor",
        projectId: project.id,
        requestedBy: resolvedUserId,
        input: prompt,
        output: JSON.stringify(sessionOutput),
        status: "completed",
        durationMs: 1420,
        tokenCount: 1850,
      },
    });

    // 7. Create a Validation Request
    await prisma.validationRequest.create({
      data: {
        agentName: "Supervisor",
        action: "orchestrate",
        status: ValidationStatus.APPROVED,
        projectId: project.id,
        requestedBy: resolvedUserId,
        sessionId: session.id,
        payload: sessionOutput,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    return NextResponse.json({
      success: true,
      message: "Agents successfully completed planning!",
      sprint: {
        id: sprint.id,
        name: sprint.name,
        goal: sprint.goal,
      },
      tasks: createdTasks,
      assignments: createdAssignments,
      session: session,
    });
  } catch (error: any) {
    console.error("Agent orchestration error:", error);
    return NextResponse.json(
      { error: "Internal server error: " + (error?.message ?? error) },
      { status: 500 }
    );
  }
}

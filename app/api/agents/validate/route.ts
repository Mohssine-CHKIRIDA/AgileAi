import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getDevAuth } from "@/server/dev-auth";
import { TaskStatus, TaskType, Priority, SprintPlanStatus, ValidationStatus } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const { userId } = getDevAuth(req);
    const resolvedUserId = userId ?? "local-user-1";

    const body = await req.json();
    const { validationId, decision, payload: modifiedPayload } = body as {
      validationId: string;
      decision: "APPROVED" | "REJECTED";
      payload: any;
    };

    if (!validationId) {
      return NextResponse.json({ error: "Validation ID is required" }, { status: 400 });
    }

    // 1. Fetch the existing validation request
    const validationRequest = await prisma.validationRequest.findUnique({
      where: { id: validationId },
    });

    if (!validationRequest) {
      return NextResponse.json({ error: "Validation request not found" }, { status: 404 });
    }

    if (validationRequest.status !== ValidationStatus.PENDING) {
      return NextResponse.json(
        { error: `Validation request has already been ${validationRequest.status}` },
        { status: 400 }
      );
    }

    // 2. If decision is REJECTED
    if (decision === "REJECTED") {
      await prisma.validationRequest.update({
        where: { id: validationId },
        data: {
          status: ValidationStatus.REJECTED,
          decidedBy: resolvedUserId,
          decidedAt: new Date(),
        },
      });

      return NextResponse.json({ success: true, status: "REJECTED" });
    }

    // 3. If decision is APPROVED, perform transactional DB writes using the modified payload
    const payload = modifiedPayload || validationRequest.payload;

    // Fetch the project
    const project = await prisma.project.findFirst({
      where: { id: validationRequest.projectId },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // We do DB operations in a transaction to ensure atomic consistency
    const result = await prisma.$transaction(async (tx) => {
      // Update ValidationRequest status
      await tx.validationRequest.update({
        where: { id: validationId },
        data: {
          status: ValidationStatus.APPROVED,
          decidedBy: resolvedUserId,
          decidedAt: new Date(),
          payload: payload, // save the final approved state
        },
      });

      // Create SprintPlan
      let sprintPlanId: string | null = null;
      let sprintName = "Sprint";
      let sprintGoal = "";
      if (payload.sprint_plan) {
        const sp = payload.sprint_plan;
        const createdSprint = await tx.sprintPlan.create({
          data: {
            projectId: project.id,
            name: sp.name || "Sprint",
            goal: sp.goal || payload.sprint_goal || "",
            status: SprintPlanStatus.DRAFT,
            color: sp.color || "#0052CC",
            creatorId: resolvedUserId,
            totalCapacityPoints: Number(sp.totalCapacityPoints) || 0,
            plannedPoints: Number(sp.plannedPoints) || 0,
            bufferPoints: Number(sp.bufferPoints) || 0,
            validationId: validationId,
          },
        });
        sprintPlanId = createdSprint.id;
        sprintName = createdSprint.name;
        sprintGoal = createdSprint.goal;
      }

      // Fetch task count to calculate sequential keys
      const taskCount = await tx.task.count({
        where: { projectId: project.id },
      });

      // Map to link temporary client/agent task UUIDs to the new database UUIDs
      const taskIdMap: Record<string, string> = {};
      const createdTasks = [];

      // Create Tasks
      const tasksToCreate = payload.tasks || [];
      for (let i = 0; i < tasksToCreate.length; i++) {
        const task = tasksToCreate[i];
        const key = `${project.key}-${taskCount + i + 1}`;
        const taskStatus = task.status
          ? (task.status as TaskStatus)
          : sprintPlanId
          ? TaskStatus.TODO
          : TaskStatus.BACKLOG;

        const createdTask = await tx.task.create({
          data: {
            projectId: project.id,
            sprintPlanId: sprintPlanId,
            assigneeId: task.assigneeId || null,
            reviewerId: task.reviewerId || null,
            reporterId: resolvedUserId,
            creatorId: resolvedUserId,
            validationId: validationId,
            title: task.title || task.name || "",
            description: task.description || "",
            acceptanceCriteria: task.acceptanceCriteria || [],
            status: taskStatus,
            type: (task.type as TaskType) || TaskType.TASK,
            priority: (task.priority as Priority) || Priority.P3_MEDIUM,
            labels: task.labels || [],
            storyPoints: task.storyPoints != null ? Number(task.storyPoints) : null,
            estimatedHours: task.estimatedHours != null ? Number(task.estimatedHours) : null,
            sprintPosition: i + 1,
            boardPosition: -1,
            aiGenerated: true,
            key: key,
          },
        });

        taskIdMap[task.id] = createdTask.id;
        createdTasks.push(createdTask);
      }

      // Create Assignments
      const createdAssignments = [];
      const assignmentsToCreate = payload.assignments || [];
      for (const ass of assignmentsToCreate) {
        const dbTaskId = taskIdMap[ass.taskId] || ass.taskId;
        if (!dbTaskId) continue;

        const createdAssignment = await tx.assignment.create({
          data: {
            taskId: dbTaskId,
            projectId: project.id,
            validationId: validationId,
            assigneeId: ass.assigneeId,
            reviewerId: ass.reviewerId || null,
            assigneeReason: ass.assigneeReason || "",
            reviewerReason: ass.reviewerReason || "",
            applied: true,
            appliedAt: new Date(),
          },
        });
        createdAssignments.push(createdAssignment);
      }

      return {
        sprint: sprintPlanId
          ? {
              id: sprintPlanId,
              name: sprintName,
              goal: sprintGoal,
            }
          : null,
        tasks: createdTasks,
        assignments: createdAssignments,
      };
    });

    return NextResponse.json({
      success: true,
      message: "Agents outputs accepted and stored successfully!",
      sprint: result.sprint,
      tasks: result.tasks,
      assignments: result.assignments,
    });
  } catch (error: any) {
    console.error("Failed to approve agent validation request:", error);
    return NextResponse.json(
      { error: "Internal server error: " + (error?.message ?? error) },
      { status: 500 }
    );
  }
}

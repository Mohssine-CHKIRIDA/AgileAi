import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getRequestAuth } from "@/server/dev-auth";
import {
  Prisma,
  TaskStatus,
  TaskType,
  Priority,
  SprintPlanStatus,
  ValidationStatus,
} from "@prisma/client";

type AssignmentPayload = {
  taskId: string;
  assigneeId?: string | null;
  reviewerId?: string | null;
  assigneeReason?: string;
  reviewerReason?: string;
};

type TaskPayload = {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  acceptanceCriteria?: string[];
  status?: string;
  type?: string;
  priority?: string;
  labels?: string[];
  storyPoints?: number | null;
  estimatedHours?: number | null;
  assigneeId?: string | null;
  reviewerId?: string | null;
};

function buildAssignmentMap(assignments: AssignmentPayload[]) {
  const map = new Map<string, AssignmentPayload>();
  for (const assignment of assignments) {
    if (assignment.taskId) {
      map.set(assignment.taskId, assignment);
    }
  }
  return map;
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await getRequestAuth(req);
    const resolvedUserId = userId ?? "local-user-1";

    const body = await req.json();
    const { validationId, decision, payload: modifiedPayload } = body as {
      validationId: string;
      decision: "APPROVED" | "REJECTED";
      payload: {
        sprint_plan?: Record<string, unknown>;
        sprint_goal?: string;
        tasks?: TaskPayload[];
        assignments?: AssignmentPayload[];
      };
    };

    if (!validationId) {
      return NextResponse.json({ error: "Validation ID is required" }, { status: 400 });
    }

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

    const payload = modifiedPayload || validationRequest.payload;
    const assignmentMap = buildAssignmentMap(
      (payload.assignments as AssignmentPayload[]) || []
    );

    const project = await prisma.project.findFirst({
      where: { id: validationRequest.projectId },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.validationRequest.update({
        where: { id: validationId },
        data: {
          status: ValidationStatus.APPROVED,
          decidedBy: resolvedUserId,
          decidedAt: new Date(),
          payload: payload as Prisma.InputJsonValue,
        },
      });

      const tasksToCreate = (payload.tasks as TaskPayload[]) || [];
      const hasTasks = tasksToCreate.length > 0;

      let sprintPlanId: string | null = null;
      let sprintName = "Sprint";
      let sprintGoal = "";

      if (payload.sprint_plan || hasTasks) {
        const sp = (payload.sprint_plan as Record<string, unknown>) || {};
        const now = new Date();
        const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

        await tx.sprintPlan.updateMany({
          where: {
            projectId: project.id,
            status: SprintPlanStatus.ACTIVE,
            deletedAt: null,
          },
          data: { status: SprintPlanStatus.CLOSED },
        });

        const createdSprint = await tx.sprintPlan.create({
          data: {
            projectId: project.id,
            name: String(sp.name || payload.sprint_goal || "Sprint 1"),
            goal: String(sp.goal || payload.sprint_goal || ""),
            status: SprintPlanStatus.ACTIVE,
            startDate: now,
            endDate: twoWeeks,
            color: String(sp.color || "#0052CC"),
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

      const taskCount = await tx.task.count({
        where: { projectId: project.id },
      });

      const taskIdMap: Record<string, string> = {};
      const createdTasks = [];

      let todoBoardPosition = 1;
      for (let i = 0; i < tasksToCreate.length; i++) {
        const task = tasksToCreate[i]!;
        const assignment = assignmentMap.get(task.id);
        const assigneeId = task.assigneeId ?? assignment?.assigneeId ?? null;
        const reviewerId = task.reviewerId ?? assignment?.reviewerId ?? null;
        const key = `${project.key}-${taskCount + i + 1}`;

        const taskStatus = sprintPlanId
          ? TaskStatus.TODO
          : task.status
          ? (task.status as TaskStatus)
          : TaskStatus.BACKLOG;

        const boardPosition =
          sprintPlanId && taskStatus === TaskStatus.TODO
            ? todoBoardPosition++
            : -1;

        const createdTask = await tx.task.create({
          data: {
            projectId: project.id,
            sprintPlanId: sprintPlanId,
            assigneeId,
            reviewerId,
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
            estimatedHours:
              task.estimatedHours != null ? Number(task.estimatedHours) : null,
            sprintPosition: i + 1,
            boardPosition,
            aiGenerated: true,
            key,
          },
        });

        taskIdMap[task.id] = createdTask.id;
        createdTasks.push(createdTask);
      }

      const createdAssignments = [];
      const assignmentsToCreate = (payload.assignments as AssignmentPayload[]) || [];
      for (const ass of assignmentsToCreate) {
        const dbTaskId = taskIdMap[ass.taskId] || ass.taskId;
        if (!dbTaskId) continue;

        if (ass.assigneeId || ass.reviewerId) {
          await tx.task.update({
            where: { id: dbTaskId },
            data: {
              ...(ass.assigneeId ? { assigneeId: ass.assigneeId } : {}),
              ...(ass.reviewerId ? { reviewerId: ass.reviewerId } : {}),
            },
          });
        }

        const createdAssignment = await tx.assignment.create({
          data: {
            taskId: dbTaskId,
            projectId: project.id,
            validationId: validationId,
            assigneeId: ass.assigneeId || resolvedUserId,
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
          ? { id: sprintPlanId, name: sprintName, goal: sprintGoal }
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
  } catch (error: unknown) {
    console.error("Failed to approve agent validation request:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Internal server error: " + message },
      { status: 500 }
    );
  }
}

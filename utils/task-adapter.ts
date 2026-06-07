/**
 * task-adapter.ts
 *
 * Converts Task (new DB model) ↔ Issue (shape the existing UI expects).
 *
 * The UI, helpers, and context files all reference:
 *   issue.name, issue.sprintId, issue.parentId, issue.isDeleted, issue.sprintColor
 *
 * Rather than rename every reference, this adapter normalises at the API
 * boundary — in, out — so zero component or helper changes are needed.
 */

import { type Task, type SprintPlan, type User } from "@prisma/client";

// ── The shape the UI has always consumed ──────────────────────────────────────

export type IssueUser = Pick<User, "id" | "name" | "email" | "avatar">;

export type IssueShape = Omit<
  Task,
  // Fields that are renamed or converted
  | "title"
  | "sprintPlanId"
  | "parentTaskId"
  | "deletedAt"
  | "reviewerId"
  | "validationId"
  | "acceptanceCriteria"
  | "isBlocked"
  | "blockedReason"
  | "aiGenerated"
  | "storyPoints"
  | "estimatedHours"
  | "labels"
  | "priority"
> & {
  // Old field names the UI uses
  name: string;             // ← Task.title
  sprintId: string | null;  // ← Task.sprintPlanId
  parentId: string | null;  // ← Task.parentTaskId
  isDeleted: boolean;       // ← Task.deletedAt !== null
  sprintColor: string | null;

  // Computed / joined fields
  sprintIsActive: boolean;
  assignee: IssueUser | null;
  reporter: IssueUser | null;
  children: IssueShape[];
  parent: (IssueShape & { children: IssueShape[]; parent: null }) | null;
};

// ── Task → IssueShape ─────────────────────────────────────────────────────────

/**
 * toIssueShape
 * Converts a raw Task row to the IssueShape the client expects.
 * Call this after joining assignee/reporter users.
 */
export function toIssueShape(
  task: Task,
  {
    assignee = null,
    reporter = null,
    children = [],
    parent = null,
    activeSprintIds = [],
  }: {
    assignee?: IssueUser | null;
    reporter?: IssueUser | null;
    children?: IssueShape[];
    parent?: IssueShape | null;
    activeSprintIds?: string[];
  } = {}
): IssueShape {
  return {
    // Pass-through fields (same name in both models)
    id: task.id,
    projectId: task.projectId,
    key: task.key,
    description: task.description,
    status: task.status,
    type: task.type,
    assigneeId: task.assigneeId,
    reporterId: task.reporterId,
    creatorId: task.creatorId,
    sprintPosition: task.sprintPosition,
    boardPosition: task.boardPosition,
    sprintColor: task.sprintColor,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,

    // Renamed fields
    name: task.title,                            // title → name
    sprintId: task.sprintPlanId ?? null,         // sprintPlanId → sprintId
    parentId: task.parentTaskId ?? null,         // parentTaskId → parentId
    isDeleted: task.deletedAt !== null,           // DateTime? → boolean

    // Computed
    sprintIsActive: activeSprintIds.includes(task.sprintPlanId ?? ""),
    assignee,
    reporter,
    children,
    parent: parent ? { ...parent, children: [], parent: null } : null,
  };
}

/**
 * generateTasksForClient
 * Drop-in replacement for the old generateIssuesForClient helper.
 * Takes raw Task[] + User[] and returns IssueShape[] with all relations resolved.
 */
export function generateTasksForClient(
  tasks: Task[],
  users: IssueUser[],
  activeSprintIds: string[] = []
): IssueShape[] {
  const userMap = new Map(users.map((u) => [u.id, u]));
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  return tasks.map((task) => {
    const assignee = userMap.get(task.assigneeId ?? "") ?? null;
    const reporter = userMap.get(task.reporterId) ?? null;
    const parentTask = taskMap.get(task.parentTaskId ?? "");

    const children: IssueShape[] = tasks
      .filter((t) => t.parentTaskId === task.id)
      .map((child) =>
        toIssueShape(child, {
          assignee: userMap.get(child.assigneeId ?? "") ?? null,
          activeSprintIds,
        })
      );

    const parent = parentTask
      ? toIssueShape(parentTask, {
          assignee: userMap.get(parentTask.assigneeId ?? "") ?? null,
          activeSprintIds,
        })
      : null;

    return toIssueShape(task, { assignee, reporter, children, parent, activeSprintIds });
  });
}

// ── IssueShape → Task write data ─────────────────────────────────────────────

/**
 * toTaskCreateData
 * Converts the POST /api/issues body to Prisma Task create input.
 */
export function toTaskCreateData(args: {
  name: string;
  type: Task["type"];
  sprintId: string | null;
  parentId: string | null;
  sprintColor?: string | null;
  reporterId: string;
  creatorId: string;
  projectId: string;
  key: string;
  sprintPosition: number;
  boardPosition: number;
}) {
  return {
    title: args.name,                            // name → title
    type: args.type,
    sprintPlanId: args.sprintId ?? undefined,    // sprintId → sprintPlanId
    parentTaskId: args.parentId ?? undefined,    // parentId → parentTaskId
    sprintColor: args.sprintColor ?? undefined,
    reporterId: args.reporterId,
    creatorId: args.creatorId,
    projectId: args.projectId,
    key: args.key,
    sprintPosition: args.sprintPosition,
    boardPosition: args.boardPosition,
  };
}

/**
 * toTaskUpdateData
 * Converts PATCH /api/issues body fields to Prisma Task update input.
 * Handles the isDeleted boolean ↔ deletedAt DateTime conversion.
 */
export function toTaskUpdateData(valid: {
  name?: string;
  description?: string;
  type?: Task["type"];
  status?: Task["status"];
  sprintPosition?: number;
  boardPosition?: number;
  assigneeId?: string | null;
  reporterId?: string;
  isDeleted?: boolean;
  sprintId?: string | null;
  parentId?: string | null;
  sprintColor?: string;
}) {
  return {
    title: valid.name,                           // name → title
    description: valid.description,
    type: valid.type,
    status: valid.status,
    sprintPosition: valid.sprintPosition,
    boardPosition: valid.boardPosition,
    assigneeId: valid.assigneeId,
    reporterId: valid.reporterId,
    sprintPlanId:                                // sprintId → sprintPlanId
      valid.sprintId === undefined ? undefined : valid.sprintId,
    parentTaskId:                                // parentId → parentTaskId
      valid.parentId === undefined ? undefined : valid.parentId,
    sprintColor: valid.sprintColor,
    // isDeleted boolean → deletedAt DateTime
    deletedAt:
      valid.isDeleted === undefined
        ? undefined
        : valid.isDeleted
        ? new Date()
        : null,
  };
}

// ── SprintPlan → Sprint shape ─────────────────────────────────────────────────

/**
 * toSprintShape
 * Converts SprintPlan to the Sprint-like shape the existing context/UI uses.
 * The UI references: sprint.id, sprint.name, sprint.status, sprint.color, sprint.creatorId
 */
export function toSprintShape(sprint: SprintPlan) {
  return {
    id: sprint.id,
    name: sprint.name,
    goal: sprint.goal,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    // Map SprintPlanStatus back to the old SprintStatus values the UI knows
    status: sprintPlanStatusToLegacy(sprint.status),
    color: sprint.color,
    creatorId: sprint.creatorId,
    projectId: sprint.projectId,
    totalCapacityPoints: sprint.totalCapacityPoints,
    plannedPoints: sprint.plannedPoints,
    bufferPoints: sprint.bufferPoints,
    createdAt: sprint.createdAt,
    updatedAt: sprint.updatedAt,
  };
}

/**
 * Maps new SprintPlanStatus to the old status strings the UI checks against.
 * Old UI does: sprint.status === "ACTIVE" | "PENDING"
 */
function sprintPlanStatusToLegacy(
  status: SprintPlan["status"]
): "ACTIVE" | "PENDING" | "CLOSED" | "VALIDATED" {
  switch (status) {
    case "DRAFT":
      return "PENDING";   // old name for DRAFT
    case "VALIDATED":
      return "VALIDATED";
    case "ACTIVE":
      return "ACTIVE";
    case "CLOSED":
      return "CLOSED";
  }
}

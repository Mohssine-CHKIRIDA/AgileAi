/**
 * utils/helpers.ts  (updated for AgileAI schema)
 *
 * All existing call sites are unchanged. generateIssuesForClient and
 * filterUserForClient now work with Task + User instead of Issue + DefaultUser.
 */

import { type IssueCountType } from "./types";
import { type IssueShape, type IssueUser, generateTasksForClient } from "./task-adapter";
import { type Task, type User } from "@prisma/client";

// Re-export IssueShape as IssueType so utils/types.ts stays unchanged
export type { IssueShape as IssueType };

// ── URL / HTTP ────────────────────────────────────────────────────────────────

export function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export function getHeaders() {
  return {
    "Content-type": "application/json",
    // In local dev, read the dev user id from sessionStorage if set
    ...(typeof window !== "undefined" && sessionStorage.getItem("devUserId")
      ? { "x-dev-user-id": sessionStorage.getItem("devUserId")! }
      : {}),
  };
}

// ── String utils ──────────────────────────────────────────────────────────────

export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function capitalizeMany(str: string) {
  return str
    .split(" ")
    .map((word) => capitalize(word))
    .join(" ");
}

// ── Issue / Task helpers ──────────────────────────────────────────────────────

export function getIssueCountByStatus(issues: IssueShape[]) {
  return issues.reduce(
    (acc, issue) => {
      acc[issue.status as keyof IssueCountType]++;
      return acc;
    },
    { TODO: 0, IN_PROGRESS: 0, DONE: 0 } as IssueCountType
  );
}

export function isEpic(issue: IssueShape | IssueShape["parent"] | null) {
  if (!issue) return false;
  return issue.type === "EPIC";
}

export function isSubtask(issue: IssueShape | null) {
  if (!issue) return false;
  return issue.type === "SUBTASK";
}

export function hasChildren(issue: IssueShape | IssueShape["parent"] | null) {
  if (!issue) return false;
  return issue.children.length > 0;
}

export function sprintId(id: string | null | undefined) {
  return id === "backlog" ? null : id;
}

export function isNullish<T>(value: T | null | undefined): value is null | undefined {
  return value == null || value === undefined;
}

export function isDone(issue: IssueShape) {
  return issue.status === "DONE";
}

// ── User helpers ──────────────────────────────────────────────────────────────

/**
 * filterUserForClient
 * Previously mapped a Clerk user to DefaultUser.
 * Now maps a prisma.User (business schema) to the same IssueUser shape.
 * Works for both Clerk users (duck-typed) and local prisma.User rows.
 */
export function filterUserForClient(user: User | IssueUser): IssueUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar ?? null,
  };
}

// ── Issue / Task generation ───────────────────────────────────────────────────

/**
 * generateIssuesForClient
 * Drop-in replacement: same signature as before, now delegates to task-adapter.
 * The `issues` parameter accepts Task[] (new) — callers pass prisma.task.findMany() results.
 */
export function generateIssuesForClient(
  tasks: Task[],
  users: IssueUser[],
  activeSprintIds?: string[]
): IssueShape[] {
  return generateTasksForClient(tasks, users, activeSprintIds ?? []);
}

/**
 * calculateInsertPosition
 * Works on Task[] — uses sprintPosition (same field name as old Issue).
 */
export function calculateInsertPosition(tasks: Task[]) {
  return Math.max(...tasks.map((t) => t.sprintPosition), 0) + 1;
}

// ── Filter helpers ────────────────────────────────────────────────────────────

export function issueNotInSearch({
  issue,
  search,
}: {
  issue: IssueShape;
  search: string;
}) {
  return (
    search.length &&
    !(
      issue.name.toLowerCase().includes(search.toLowerCase()) ||
      issue.assignee?.name.toLowerCase().includes(search.toLowerCase()) ||
      issue.key.toLowerCase().includes(search.toLowerCase())
    )
  );
}

export function assigneeNotInFilters({
  issue,
  assignees,
}: {
  issue: IssueShape;
  assignees: string[];
}) {
  return (
    assignees.length && !assignees.includes(issue.assignee?.id ?? "unassigned")
  );
}

export function epicNotInFilters({
  issue,
  epics,
}: {
  issue: IssueShape;
  epics: string[];
}) {
  return epics.length && (!issue.parentId || !epics.includes(issue.parentId));
}

export function issueTypeNotInFilters({
  issue,
  issueTypes,
}: {
  issue: IssueShape;
  issueTypes: string[];
}) {
  return issueTypes.length && !issueTypes.includes(issue.type);
}

export function issueSprintNotInFilters({
  issue,
  sprintIds,
  excludeBacklog = false,
}: {
  issue: IssueShape;
  sprintIds: string[];
  excludeBacklog?: boolean;
}) {
  if (isNullish(issue.sprintId)) {
    if (sprintIds.length && excludeBacklog) return true;
    return false;
  }
  return sprintIds.length && !sprintIds.includes(issue.sprintId);
}

// ── Date / colour utils ───────────────────────────────────────────────────────

export function dateToLongString(date: Date) {
  const dateString = new Date(date).toDateString();
  const timeString = new Date(date).toLocaleTimeString();
  return dateString + " at " + timeString;
}

export function hexToRgba(hex: string | null, opacity?: number) {
  if (!hex) return "rgba(0, 0, 0, 0)";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity ?? 1})`;
}

// ── Array utils ───────────────────────────────────────────────────────────────

export function moveItemWithinArray<T>(arr: T[], item: T, newIndex: number) {
  const arrClone = [...arr];
  const oldIndex = arrClone.indexOf(item);
  const oldItem = arrClone.splice(oldIndex, 1)[0];
  if (oldItem) arrClone.splice(newIndex, 0, oldItem);
  return arrClone;
}

export function insertItemIntoArray<T>(arr: T[], item: T, index: number) {
  const arrClone = [...arr];
  arrClone.splice(index, 0, item);
  return arrClone;
}

export function getPluralEnd<T>(arr: T[]) {
  if (arr.length === 0) return "s";
  return arr.length > 1 ? "s" : "";
}

type SprintPlanLike = {
  name?: string;
  goal?: string;
  plannedPoints?: number;
  totalCapacityPoints?: number;
  bufferPoints?: number;
  color?: string;
  status?: string;
};

type TaskLike = {
  storyPoints?: number | null;
};

const GENERIC_SPRINT_NAMES = new Set([
  "sprint",
  "sprint n",
  "sprint 1",
  "short theme-based sprint title",
  "upcoming sprint",
]);

export function isGenericSprintName(name?: string | null): boolean {
  if (!name?.trim()) return true;
  const normalized = name.trim().toLowerCase();
  if (GENERIC_SPRINT_NAMES.has(normalized)) return true;
  return /^sprint\s*[#n\d]*$/i.test(normalized);
}

export function deriveSprintName(
  goal?: string | null,
  tasks?: TaskLike[]
): string {
  if (goal?.trim()) {
    const segment = goal.split(".")[0]?.split(",")[0]?.trim() ?? goal.trim();
    if (segment.length <= 55) return segment;
    const words = segment.split(/\s+/).slice(0, 8).join(" ");
    return words.length > 55 ? `${words.slice(0, 52)}...` : words;
  }
  const firstTitle = (tasks?.[0] as { title?: string })?.title;
  if (firstTitle) {
    return firstTitle.length > 50 ? `${firstTitle.slice(0, 47)}...` : firstTitle;
  }
  return "Upcoming Sprint";
}

export function normalizeSprintPlanDisplay<T extends TaskLike>(
  sprintPlan: SprintPlanLike | null | undefined,
  tasks: T[] = []
): SprintPlanLike | null | undefined {
  if (!sprintPlan) return sprintPlan;

  const plannedFromTasks = tasks.reduce(
    (sum, task) => sum + (Number(task.storyPoints) || 0),
    0
  );

  const name = isGenericSprintName(sprintPlan.name)
    ? deriveSprintName(sprintPlan.goal, tasks)
    : sprintPlan.name;

  const plannedPoints =
    sprintPlan.plannedPoints && sprintPlan.plannedPoints > 0
      ? sprintPlan.plannedPoints
      : plannedFromTasks;

  return {
    ...sprintPlan,
    name,
    plannedPoints,
  };
}

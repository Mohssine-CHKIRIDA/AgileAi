export const queryKeys = {
  project: () => ["project"] as const,
  projectList: () => ["project-list"] as const,
  issues: (projectId?: string | null) => ["issues", projectId] as const,
  sprints: (projectId?: string | null) => ["sprints", projectId] as const,
  projectMembers: (projectId?: string | null) =>
    ["project-members", projectId] as const,
};

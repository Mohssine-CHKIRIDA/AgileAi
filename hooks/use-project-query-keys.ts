"use client";

import { useProject } from "@/hooks/query-hooks/use-project";
import { queryKeys } from "@/utils/query-keys";

export function useProjectQueryKeys() {
  const { project } = useProject();
  const projectId = project?.id;

  return {
    projectId,
    issuesKey: queryKeys.issues(projectId),
    sprintsKey: queryKeys.sprints(projectId),
  };
}

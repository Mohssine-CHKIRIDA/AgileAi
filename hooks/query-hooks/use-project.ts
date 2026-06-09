"use client";
import { api } from "@/utils/api";
import { queryKeys } from "@/utils/query-keys";
import { useQuery } from "@tanstack/react-query";

export const useProject = () => {
  const {
    data,
    isLoading: projectIsLoading,
    refetch: refetchProject,
  } = useQuery(queryKeys.project(), api.project.getProject, {
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const project = data?.project ?? null;
  const needsOnboarding = data?.needsOnboarding ?? false;

  const { data: members } = useQuery(
    queryKeys.projectMembers(project?.id),
    () => api.project.getMembers({ project_id: project?.id ?? "" }),
    {
      enabled: !!project?.id,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    }
  );

  return {
    project,
    projectIsLoading,
    needsOnboarding,
    refetchProject,
    members,
  };
};

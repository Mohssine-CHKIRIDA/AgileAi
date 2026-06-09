"use client";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import { useUpdateIssue } from "./use-update-issue";
import { useUpdateIssuesBatch } from "./use-update-batch";
import { usePostIssue } from "./use-post-issue";
import { useDeleteIssue } from "./use-delete-issue";
import { useProjectQueryKeys } from "@/hooks/use-project-query-keys";

export const TOO_MANY_REQUESTS = {
  message: `You have exceeded the number of requests allowed per minute.`,
  description: "Please try again later.",
};

export const useIssues = () => {
  const { projectId, issuesKey } = useProjectQueryKeys();

  const { data: issues, isLoading: issuesLoading } = useQuery(
    issuesKey,
    ({ signal }) => api.issues.getIssues({ signal }),
    {
      enabled: !!projectId,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      staleTime: 0,
    }
  );

  const { updateIssue, isUpdating } = useUpdateIssue();
  const { updateIssuesBatch, batchUpdating } = useUpdateIssuesBatch();
  const { createIssue, isCreating } = usePostIssue();
  const { deleteIssue, isDeleting } = useDeleteIssue();

  return {
    issues,
    issuesLoading,
    updateIssue,
    isUpdating,
    updateIssuesBatch,
    batchUpdating,
    createIssue,
    isCreating,
    deleteIssue,
    isDeleting,
  };
};

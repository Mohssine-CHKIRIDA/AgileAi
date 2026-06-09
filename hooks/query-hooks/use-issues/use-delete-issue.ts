"use client";
import { toast } from "@/components/toast";
import { useSelectedIssueContext } from "@/context/use-selected-issue-context";
import { api } from "@/utils/api";
import { type IssueType } from "@/utils/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type AxiosError } from "axios";
import { TOO_MANY_REQUESTS } from ".";
import { useProjectQueryKeys } from "@/hooks/use-project-query-keys";

const useDeleteIssue = () => {
  const { issueKey, setIssueKey } = useSelectedIssueContext();
  const queryClient = useQueryClient();
  const { issuesKey } = useProjectQueryKeys();

  const { mutate: deleteIssue, isLoading: isDeleting } = useMutation(
    api.issues.deleteIssue,
    {
      onMutate: async (deletedIssue) => {
        await queryClient.cancelQueries(issuesKey);
        const previousIssues = queryClient.getQueryData<IssueType[]>(issuesKey);
        queryClient.setQueryData(issuesKey, (old: IssueType[] | undefined) => {
          return old?.filter((issue) => issue.id !== deletedIssue.issueId);
        });
        return { previousIssues, issuesKey };
      },
      onError: (err: AxiosError, deletedIssue, context) => {
        if (err?.response?.data == "Too many requests") {
          toast.error(TOO_MANY_REQUESTS);
          return;
        }
        toast.error({
          message: `Something went wrong while deleting the issue ${deletedIssue.issueId}`,
          description: "Please try again later.",
        });
        if (context?.issuesKey) {
          queryClient.setQueryData(context.issuesKey, context?.previousIssues);
        }
      },
      onSettled: (deletedIssue, _err, _vars, context) => {
        if (context?.issuesKey) {
          void queryClient.invalidateQueries(context.issuesKey);
        }

        if (issueKey == deletedIssue?.key) {
          setIssueKey(null);
        }
      },
    }
  );
  return { deleteIssue, isDeleting };
};

export { useDeleteIssue };

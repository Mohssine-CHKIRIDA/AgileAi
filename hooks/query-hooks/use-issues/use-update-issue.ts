"use client";
import { toast } from "@/components/toast";
import { api } from "@/utils/api";
import { type IssueType } from "@/utils/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type AxiosError } from "axios";
import { TOO_MANY_REQUESTS } from ".";
import { useProjectQueryKeys } from "@/hooks/use-project-query-keys";

const useUpdateIssue = () => {
  const queryClient = useQueryClient();
  const { issuesKey } = useProjectQueryKeys();

  const { mutate: updateIssue, isLoading: isUpdating } = useMutation(
    api.issues.patchIssue,
    {
      onMutate: async (newIssue) => {
        await queryClient.cancelQueries(issuesKey);
        const previousIssues = queryClient.getQueryData<IssueType[]>(issuesKey);

        queryClient.setQueryData(issuesKey, (old?: IssueType[]) => {
          return (old ?? []).map((issue) => {
            const { issueId, ...updatedProps } = newIssue;
            if (issue.id === issueId) {
              return Object.assign(issue, updatedProps);
            }
            return issue;
          });
        });
        return { previousIssues, issuesKey };
      },
      onError: (err: AxiosError, newIssue, context) => {
        if (context?.issuesKey) {
          queryClient.setQueryData(context.issuesKey, context?.previousIssues);
        }

        if (err?.response?.data == "Too many requests") {
          toast.error(TOO_MANY_REQUESTS);
          return;
        }

        toast.error({
          message: `Something went wrong while updating the issue ${newIssue.issueId}`,
          description: "Please try again later.",
        });
      },
      onSettled: (_data, _err, _vars, context) => {
        if (context?.issuesKey) {
          void queryClient.invalidateQueries(context.issuesKey);
        }
      },
    }
  );

  return { updateIssue, isUpdating };
};

export { useUpdateIssue };

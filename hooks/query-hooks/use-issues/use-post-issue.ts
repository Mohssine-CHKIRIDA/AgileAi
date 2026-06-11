"use client";
import { toast } from "@/components/toast";
import { api } from "@/utils/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type AxiosError } from "axios";
import { TOO_MANY_REQUESTS } from ".";
import { useProjectQueryKeys } from "@/hooks/use-project-query-keys";

const usePostIssue = () => {
  const queryClient = useQueryClient();
  const { issuesKey } = useProjectQueryKeys();

  const { mutate: createIssue, isLoading: isCreating } = useMutation(
    api.issues.postIssue,
    {
      onError: (err: AxiosError, createdIssue) => {
        if (err?.response?.data == "Too many requests") {
          toast.error(TOO_MANY_REQUESTS);
          return;
        }
        toast.error({
          message: `Something went wrong while creating the issue ${createdIssue.name}`,
          description: "Please try again later.",
        });
      },
      onSettled: () => {
        void queryClient.invalidateQueries(issuesKey);
      },
    }
  );
  return { createIssue, isCreating };
};

export { usePostIssue };

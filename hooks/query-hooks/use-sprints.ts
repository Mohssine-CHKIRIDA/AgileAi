"use client";
import { toast } from "@/components/toast";
import { api } from "@/utils/api";
import { type Sprint } from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type AxiosError } from "axios";
import { TOO_MANY_REQUESTS } from "./use-issues";
import { useProjectQueryKeys } from "@/hooks/use-project-query-keys";

export const useSprints = () => {
  const queryClient = useQueryClient();
  const { projectId, sprintsKey } = useProjectQueryKeys();

  const { data: sprints, isLoading: sprintsLoading } = useQuery(
    sprintsKey,
    api.sprints.getSprints,
    {
      enabled: !!projectId,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      staleTime: 0,
    }
  );

  const { mutate: updateSprint, isLoading: isUpdating } = useMutation(
    api.sprints.patchSprint,
    {
      onMutate: async (newSprint) => {
        await queryClient.cancelQueries(sprintsKey);
        const previousSprints = queryClient.getQueryData<Sprint[]>(sprintsKey);
        queryClient.setQueryData(sprintsKey, (old?: Sprint[]) => {
          return (old ?? []).map((sprint) => {
            const { sprintId, ...updatedProps } = newSprint;
            if (sprint.id === sprintId) {
              return Object.assign(sprint, updatedProps);
            }
            return sprint;
          });
        });
        return { previousSprints, sprintsKey };
      },
      onError: (err: AxiosError, newSprint, context) => {
        if (context?.sprintsKey) {
          queryClient.setQueryData(context.sprintsKey, context?.previousSprints);
        }
        if (err?.response?.data == "Too many requests") {
          toast.error(TOO_MANY_REQUESTS);
          return;
        }
        toast.error({
          message: `Something went wrong while updating sprint ${newSprint.sprintId}`,
          description: "Please try again later.",
        });
      },
      onSettled: (_data, _err, _vars, context) => {
        if (context?.sprintsKey) {
          void queryClient.invalidateQueries(context.sprintsKey);
        }
      },
    }
  );

  const { mutate: createSprint, isLoading: isCreating } = useMutation(
    api.sprints.postSprint,
    {
      onError: (err: AxiosError) => {
        if (err?.response?.data == "Too many requests") {
          toast.error(TOO_MANY_REQUESTS);
          return;
        }
        toast.error({
          message: `Something went wrong while creating sprint`,
          description: "Please try again later.",
        });
      },
      onSettled: () => {
        void queryClient.invalidateQueries(sprintsKey);
      },
    }
  );

  const { mutate: deleteSprint, isLoading: isDeleting } = useMutation(
    api.sprints.deleteSprint,
    {
      onMutate: async (deletedSprint) => {
        await queryClient.cancelQueries(sprintsKey);
        const previousSprints = queryClient.getQueryData<Sprint[]>(sprintsKey);
        queryClient.setQueryData(sprintsKey, (old: Sprint[] | undefined) => {
          return old?.filter((sprint) => sprint.id !== deletedSprint.sprintId);
        });
        return { previousSprints, sprintsKey };
      },
      onError: (err: AxiosError, deletedSprint, context) => {
        if (err?.response?.data == "Too many requests") {
          toast.error(TOO_MANY_REQUESTS);
          return;
        }
        toast.error({
          message: `Something went wrong while deleting the sprint ${deletedSprint.sprintId}`,
          description: "Please try again later.",
        });
        if (context?.sprintsKey) {
          queryClient.setQueryData(context.sprintsKey, context?.previousSprints);
        }
      },
      onSettled: (_data, _err, _vars, context) => {
        if (context?.sprintsKey) {
          void queryClient.invalidateQueries(context.sprintsKey);
        }
      },
    }
  );

  return {
    sprints,
    sprintsLoading,
    updateSprint,
    isUpdating,
    createSprint,
    isCreating,
    deleteSprint,
    isDeleting,
  };
};

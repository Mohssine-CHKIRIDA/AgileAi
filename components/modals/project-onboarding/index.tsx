"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalOverlay,
  ModalPortal,
  ModalTitle,
} from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { api } from "@/utils/api";
import { queryKeys } from "@/utils/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import axios from "axios";

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const responseData: unknown = error.response?.data;
    if (typeof responseData === "string" && responseData.length > 0) {
      return responseData;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

type Mode = "join" | "create";

export function ProjectOnboardingModal({
  open,
  onClose,
  forceOpen = false,
}: {
  open: boolean;
  onClose?: () => void;
  forceOpen?: boolean;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("join");
  const [joinKey, setJoinKey] = useState("JIRA-CLONE");
  const [projectName, setProjectName] = useState("");
  const [projectKey, setProjectKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const invalidateProjectData = async () => {
    await queryClient.invalidateQueries(queryKeys.project());
    await queryClient.invalidateQueries(queryKeys.projectList());
    queryClient.removeQueries({ queryKey: ["issues"] });
    queryClient.removeQueries({ queryKey: ["sprints"] });
    queryClient.removeQueries({ queryKey: ["project-members"] });
    router.refresh();
  };

  const handleClose = () => {
    if (!forceOpen) onClose?.();
  };

  const handleJoin = async () => {
    const key = joinKey.trim().toUpperCase();
    if (!key) {
      toast.error("Enter a project key");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.project.joinProject({ key });
      await invalidateProjectData();
      toast.success(`Joined project ${key}`);
      handleClose();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not join project"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreate = async () => {
    const name = projectName.trim();
    const key = projectKey.trim().toUpperCase();
    if (!name || !key) {
      toast.error("Project name and key are required");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.project.postProject({ name, key });
      await invalidateProjectData();
      toast.success(`Created project ${name}`);
      handleClose();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not create project"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <ModalPortal>
        <ModalOverlay />
        <ModalContent className="w-full max-w-lg">
          <div className="flex items-center justify-between gap-4">
            <ModalTitle>Choose a project</ModalTitle>
            {!forceOpen && (
              <button
                type="button"
                onClick={handleClose}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            )}
          </div>
          <ModalDescription>
            Join an existing project with its key, or create a new one. Use{" "}
            <strong>JIRA-CLONE</strong> to access the demo project with sample
            issues.
          </ModalDescription>

          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              customColors
              className={
                mode === "join"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700"
              }
              onClick={() => setMode("join")}
            >
              Join existing
            </Button>
            <Button
              type="button"
              customColors
              className={
                mode === "create"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700"
              }
              onClick={() => setMode("create")}
            >
              Create new
            </Button>
          </div>

          {mode === "join" ? (
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Project key
              </label>
              <input
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="e.g. JIRA-CLONE"
                value={joinKey}
                onChange={(e) => setJoinKey(e.target.value)}
              />
              <Button
                type="button"
                customColors
                className="w-full bg-blue-600 text-white hover:bg-blue-700"
                disabled={isSubmitting}
                onClick={() => void handleJoin()}
              >
                {isSubmitting ? "Joining..." : "Join project"}
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Project name
                </label>
                <input
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="My awesome project"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Project key
                </label>
                <input
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm uppercase"
                  placeholder="MYPROJ"
                  value={projectKey}
                  onChange={(e) =>
                    setProjectKey(e.target.value.toUpperCase())
                  }
                />
              </div>
              <Button
                type="button"
                customColors
                className="w-full bg-blue-600 text-white hover:bg-blue-700"
                disabled={isSubmitting}
                onClick={() => void handleCreate()}
              >
                {isSubmitting ? "Creating..." : "Create project"}
              </Button>
            </div>
          )}
        </ModalContent>
      </ModalPortal>
    </Modal>
  );
}

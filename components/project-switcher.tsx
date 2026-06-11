"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { queryKeys } from "@/utils/query-keys";
import { api } from "@/utils/api";
import { useProject } from "@/hooks/query-hooks/use-project";
import { ProjectOnboardingModal } from "@/components/modals/project-onboarding";
import { FiChevronDown, FiFolder } from "react-icons/fi";
import toast from "react-hot-toast";
import clsx from "clsx";

export function ProjectSwitcher() {
  const { user, isLoaded } = useUser();
  const { project } = useProject();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const { data: projectList } = useQuery(
    queryKeys.projectList(),
    api.project.listProjects,
    {
      enabled: isLoaded && !!user,
      staleTime: 30 * 1000,
    }
  );

  if (!isLoaded || !user) return null;

  const invalidateAll = async () => {
    await queryClient.invalidateQueries(queryKeys.project());
    await queryClient.invalidateQueries(queryKeys.projectList());
    queryClient.removeQueries({ queryKey: ["issues"] });
    queryClient.removeQueries({ queryKey: ["sprints"] });
    queryClient.removeQueries({ queryKey: ["project-members"] });
    router.refresh();
  };

  const handleSwitch = async (projectId: string) => {
    if (projectId === project?.id || switchingId) return;
    setSwitchingId(projectId);
    try {
      await api.project.switchProject({ projectId });
      await invalidateAll();
      toast.success("Project switched");
      setOpen(false);
    } catch {
      toast.error("Could not switch project");
    } finally {
      setSwitchingId(null);
    }
  };

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-x-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-800 transition-colors"
        >
          <FiFolder className="text-blue-400" />
          <span className="max-w-[160px] truncate font-medium">
            {project?.name ?? "No project"}
          </span>
          <FiChevronDown
            className={clsx("text-slate-400 transition-transform", open && "rotate-180")}
          />
        </button>

        {open && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default"
              aria-label="Close project menu"
              onClick={() => setOpen(false)}
            />
            <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-lg border border-slate-700 bg-slate-950 py-2 shadow-xl">
              <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                Your projects
              </div>

              {(projectList?.projects.length ?? 0) === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-400">No projects yet</p>
              ) : (
                <ul className="max-h-48 overflow-y-auto">
                  {projectList?.projects.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        disabled={!!switchingId}
                        onClick={() => void handleSwitch(p.id)}
                        className={clsx(
                          "flex w-full flex-col px-3 py-2 text-left hover:bg-slate-900",
                          p.isActive && "bg-slate-900/80"
                        )}
                      >
                        <span className="text-sm font-medium text-slate-200">
                          {p.name}
                          {p.isActive && (
                            <span className="ml-2 text-[10px] text-blue-400">active</span>
                          )}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">{p.key}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-2 border-t border-slate-800 px-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setManageOpen(true);
                  }}
                  className="w-full rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"
                >
                  Create or join project
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <ProjectOnboardingModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        forceOpen={false}
      />
    </>
  );
}

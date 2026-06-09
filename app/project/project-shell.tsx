"use client";

import { Sidebar } from "@/components/sidebar";
import { TopNavbar } from "@/components/top-navbar";
import { FiltersProvider } from "@/context/use-filters-context";
import { ProjectOnboardingModal } from "@/components/modals/project-onboarding";
import { useProject } from "@/hooks/query-hooks/use-project";
import { useUser } from "@clerk/nextjs";
import { Fragment } from "react";

export function ProjectShell({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const { needsOnboarding, projectIsLoading } = useProject();

  const showOnboarding =
    isLoaded && !!user && !projectIsLoading && needsOnboarding;

  return (
    <Fragment>
      <TopNavbar />
      <main className="flex h-[calc(100vh_-_3rem)] w-full">
        <Sidebar />
        <FiltersProvider>
          <div className="w-full max-w-[calc(100vw_-_16rem)]">{children}</div>
        </FiltersProvider>
      </main>
      <ProjectOnboardingModal open={showOnboarding} forceOpen />
    </Fragment>
  );
}

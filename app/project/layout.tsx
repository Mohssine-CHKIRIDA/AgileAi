import { auth } from "@clerk/nextjs";
import { dehydrate } from "@tanstack/query-core";
import { getQueryClient } from "@/utils/get-query-client";
import { Hydrate } from "@/utils/hydrate";
import {
  getInitialIssuesFromServer,
  getInitialProjectFromServer,
  getInitialSprintsFromServer,
} from "@/server/functions";
import { ProjectShell } from "./project-shell";
import { queryKeys } from "@/utils/query-keys";

const ProjectLayout = async ({ children }: { children: React.ReactNode }) => {
  const { userId } = auth();
  const queryClient = getQueryClient();

  const project = await getInitialProjectFromServer(userId || undefined);
  const projectId = project?.id;

  await queryClient.prefetchQuery(queryKeys.project(), async () => ({
    project,
    needsOnboarding: !!userId && !project,
  }));

  if (projectId) {
    await Promise.all([
      queryClient.prefetchQuery(queryKeys.issues(projectId), () =>
        getInitialIssuesFromServer(userId || undefined)
      ),
      queryClient.prefetchQuery(queryKeys.sprints(projectId), () =>
        getInitialSprintsFromServer(userId || undefined)
      ),
    ]);
  }

  const dehydratedState = dehydrate(queryClient);

  return (
    <Hydrate state={dehydratedState}>
      <ProjectShell>{children}</ProjectShell>
    </Hydrate>
  );
};

export default ProjectLayout;

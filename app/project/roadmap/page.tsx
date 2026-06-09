import { type Metadata } from "next";
import { getQueryClient } from "@/utils/get-query-client";
import { Hydrate } from "@/utils/hydrate";
import { dehydrate } from "@tanstack/query-core";
import { Roadmap } from "@/components/roadmap";
import {
  getInitialIssuesFromServer,
  getInitialProjectFromServer,
  getInitialSprintsFromServer,
} from "@/server/functions";
import { auth } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Roadmap",
};

const RoadmapPage = async () => {
  const { userId } = auth();
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(["issues"], () =>
      getInitialIssuesFromServer(userId || undefined)
    ),
    queryClient.prefetchQuery(["sprints"], () =>
      getInitialSprintsFromServer(userId || undefined)
    ),
    queryClient.prefetchQuery(["project"], () =>
      getInitialProjectFromServer()
    ),
  ]);

  const dehydratedState = dehydrate(queryClient);

  return (
    <Hydrate state={dehydratedState}>
      <Roadmap />
    </Hydrate>
  );
};

export default RoadmapPage;

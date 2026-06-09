import {
  type GetProjectResponse,
  type PostProjectBody,
  type PostProjectResponse,
} from "@/app/api/project/route";
import { type PostJoinProjectBody, type PostJoinProjectResponse } from "@/app/api/project/join/route";
import axios from "axios";
import { getBaseUrl, getHeaders } from "../helpers";
import { type GetProjectMembersResponse } from "@/app/api/project/[project_id]/members/route";
import { type GetProjectListResponse } from "@/app/api/project/list/route";
import { type PostSwitchProjectResponse } from "@/app/api/project/switch/route";

const baseUrl = getBaseUrl();

export const projectRoutes = {
  getProject: async () => {
    const { data } = await axios.get<GetProjectResponse>(
      `${baseUrl}/api/project`,
      { headers: getHeaders() }
    );
    return data;
  },
  postProject: async (body: PostProjectBody) => {
    const { data } = await axios.post<PostProjectResponse>(
      `${baseUrl}/api/project`,
      body,
      { headers: getHeaders() }
    );
    return data?.project;
  },
  joinProject: async (body: PostJoinProjectBody) => {
    const { data } = await axios.post<PostJoinProjectResponse>(
      `${baseUrl}/api/project/join`,
      body,
      { headers: getHeaders() }
    );
    return data?.project;
  },
  listProjects: async () => {
    const { data } = await axios.get<GetProjectListResponse>(
      `${baseUrl}/api/project/list`,
      { headers: getHeaders() }
    );
    return data;
  },
  switchProject: async ({ projectId }: { projectId: string }) => {
    const { data } = await axios.post<PostSwitchProjectResponse>(
      `${baseUrl}/api/project/switch`,
      { projectId },
      { headers: getHeaders() }
    );
    return data?.project;
  },
  getMembers: async ({ project_id }: { project_id: string }) => {
    const { data } = await axios.get<GetProjectMembersResponse>(
      `${baseUrl}/api/project/${project_id}/members`,
      { headers: getHeaders() }
    );
    return data?.members;
  },
};

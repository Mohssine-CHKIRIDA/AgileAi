"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { AiOutlineSend, AiOutlineRobot, AiOutlineHistory } from "react-icons/ai";
import { BsCpu, BsTerminal, BsCheckCircleFill } from "react-icons/bs";
import { FaUserCheck, FaTasks, FaRegCalendarAlt, FaSpinner } from "react-icons/fa";
import { FiEdit2, FiCheck, FiX, FiAlertTriangle, FiPlus, FiTrash2 } from "react-icons/fi";
import Link from "next/link";
import clsx from "clsx";
import { normalizeSprintPlanDisplay } from "@/utils/sprint-display";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/utils/query-keys";
import { useProject } from "@/hooks/query-hooks/use-project";
import { useRouter } from "next/navigation";
import { api } from "@/utils/api";

type StepStatus = "idle" | "running" | "completed";

interface AgentStep {
  id: number;
  name: string;
  agent: string;
  desc: string;
  status: StepStatus;
  icon: React.ComponentType<{ className?: string }>;
}

interface TeamMember {
  id: string;
  name: string;
  skills: string[];
  current_load: number;
}

const templates = [
  {
    title: "Google OAuth Login Flow",
    prompt: "Setup Google OAuth authentication flow with JWT secure session tokens and middleware redirects.",
    desc: "Auth, cookies, & route protection."
  },
  {
    title: "Stripe Subscription Billing",
    prompt: "Integrate Stripe subscription checkout portal and webhooks to update membership status in the database.",
    desc: "Pricing grids, checkout, & hooks."
  },
  {
    title: "Admin Dashboard Analytics",
    prompt: "Create an admin analytics dashboard showing sprint completion rate, velocity tracking, and bottleneck alerts.",
    desc: "KPI widgets, chart API, & aggregates."
  }
];

export default function AgentsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { project } = useProject();
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Agent response payload and workflow state
  const [validationId, setValidationId] = useState<string | null>(null);
  const [payload, setPayload] = useState<any | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskData, setEditingTaskData] = useState<any | null>(null);
  const [isEditingSprint, setIsEditingSprint] = useState(false);
  const [editingSprintData, setEditingSprintData] = useState<any | null>(null);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const sprintPlanDisplay = useMemo(
    () =>
      payload
        ? normalizeSprintPlanDisplay(payload.sprint_plan, payload.tasks ?? [])
        : null,
    [payload]
  );

  const [steps, setSteps] = useState<AgentStep[]>([
    {
      id: 1,
      name: "Supervisor Agent",
      agent: "Supervisor",
      desc: "Analyzing user requirements backlog state and routing...",
      status: "idle",
      icon: BsCpu,
    },
    {
      id: 2,
      name: "Task Agent",
      agent: "Product Owner",
      desc: "Decomposing requirements into clear user stories, priority, and acceptance criteria...",
      status: "idle",
      icon: FaTasks,
    },
    {
      id: 3,
      name: "Planning Agent",
      agent: "Scrum Master",
      desc: "Estimating story points, calculating team capacity, and structuring new sprint plan...",
      status: "idle",
      icon: FaRegCalendarAlt,
    },
    {
      id: 4,
      name: "Assignment Agent",
      agent: "Resource Manager",
      desc: "Analyzing developer skill matrix and workloads to assign tasks and code reviewers...",
      status: "idle",
      icon: FaUserCheck,
    },
  ]);

  useEffect(() => {
    setRecentSessions([
      { id: "1", input: "Setup Google OAuth Login Flow", createdAt: "Just now" },
      { id: "2", input: "Stripe Subscription Billing", createdAt: "10 mins ago" },
      { id: "3", input: "Database migration for subtasks", createdAt: "Yesterday" },
    ]);
  }, []);

  const handleTemplateClick = (text: string) => {
    setPrompt(text);
  };

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const runAgentWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setValidationId(null);
    setPayload(null);
    setSaveSuccess(false);

    // Reset steps
    setSteps((prev) => prev.map((s) => ({ ...s, status: "idle" })));

    // Step 1: Supervisor start
    setSteps((prev) =>
      prev.map((s, idx) => (idx === 0 ? { ...s, status: "running" } : s))
    );

    // Start API request in parallel
    const apiPromise = fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to execute agent workflow");
      }
      return data;
    });

    try {
      await delay(1200);
      setSteps((prev) =>
        prev.map((s, idx) => (idx === 0 ? { ...s, status: "completed" } : idx === 1 ? { ...s, status: "running" } : s))
      );

      await delay(1500);
      setSteps((prev) =>
        prev.map((s, idx) => (idx === 1 ? { ...s, status: "completed" } : idx === 2 ? { ...s, status: "running" } : s))
      );

      await delay(1500);
      setSteps((prev) =>
        prev.map((s, idx) => (idx === 2 ? { ...s, status: "completed" } : idx === 3 ? { ...s, status: "running" } : s))
      );

      const data = await apiPromise;

      setSteps((prev) =>
        prev.map((s) => (s.id === 4 ? { ...s, status: "completed" } : s))
      );

      setValidationId(data.validationId);
      setPayload({
        ...data.payload,
        sprint_plan: normalizeSprintPlanDisplay(
          data.payload?.sprint_plan,
          data.payload?.tasks ?? []
        ),
      });
      setTeamMembers(data.teamMembers || []);

      setRecentSessions((prev) => [
        { id: data.session.id, input: prompt, createdAt: "Just now" },
        ...prev.slice(0, 4),
      ]);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "An error occurred during orchestration.");
      setSteps((prev) => prev.map((s) => (s.status === "running" ? { ...s, status: "idle" } : s)));
    } finally {
      setIsSubmitting(false);
      setPrompt("");
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    }
  };

  // Approval actions
  const handleAccept = async () => {
    if (!validationId || !payload || isSaving) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/agents/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          validationId,
          decision: "APPROVED",
          payload,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to approve sprint proposal");
      }

      setSaveSuccess(true);
      if (project?.id) {
        await queryClient.removeQueries({ queryKey: ["issues", project.id] });
        await queryClient.removeQueries({ queryKey: ["sprints", project.id] });
        await queryClient.prefetchQuery(queryKeys.issues(project.id), () =>
          api.issues.getIssues({})
        );
        await queryClient.prefetchQuery(queryKeys.sprints(project.id), () =>
          api.sprints.getSprints()
        );
        router.refresh();
      }
      setPayload(null);
      setValidationId(null);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to save generated sprint.");
    } finally {
      setIsSaving(false);
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    }
  };

  const handleDecline = async () => {
    if (!validationId || isSaving) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      await fetch("/api/agents/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          validationId,
          decision: "REJECTED",
        }),
      });

      // Clear states to let user try again
      setPayload(null);
      setValidationId(null);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to decline sprint proposal.");
    } finally {
      setIsSaving(false);
    }
  };

  // Editing utilities
  const startEditingTask = (task: any) => {
    setEditingTaskId(task.id);
    setEditingTaskData({ ...task });
  };

  const saveTaskEdit = () => {
    if (!payload || !editingTaskData) return;

    const updatedTasks = payload.tasks.map((t: any) =>
      t.id === editingTaskData.id ? { ...t, ...editingTaskData } : t
    );

    const updatedAssignments = payload.assignments.map((ass: any) => {
      if (ass.taskId === editingTaskData.id) {
        return {
          ...ass,
          assigneeId: editingTaskData.assigneeId,
          reviewerId: editingTaskData.reviewerId,
          assigneeReason: ass.assigneeId === editingTaskData.assigneeId ? ass.assigneeReason : "Manually updated by user",
          reviewerReason: ass.reviewerId === editingTaskData.reviewerId ? ass.reviewerReason : "Manually updated by user",
        };
      }
      return ass;
    });

    setPayload({
      ...payload,
      tasks: updatedTasks,
      assignments: updatedAssignments,
    });
    setEditingTaskId(null);
    setEditingTaskData(null);
  };

  const deleteGeneratedTask = (taskId: string) => {
    if (!payload) return;
    setPayload({
      ...payload,
      tasks: payload.tasks.filter((t: any) => t.id !== taskId),
      assignments: payload.assignments.filter((ass: any) => ass.taskId !== taskId),
    });
  };

  const addNewTask = () => {
    if (!payload) return;
    const tempId = `temp-${Date.now()}`;
    const newTask = {
      id: tempId,
      title: "New AI Task",
      description: "Describe what needs to be implemented...",
      acceptanceCriteria: ["Ensure code is verified and builds properly."],
      status: "TODO",
      type: "TASK",
      priority: "P3_MEDIUM",
      labels: ["ai-sprint"],
      storyPoints: 3,
      estimatedHours: 4,
      assigneeId: teamMembers[0]?.id || null,
      reviewerId: teamMembers[1]?.id || null,
    };
    const newAssignment = {
      taskId: tempId,
      assigneeId: newTask.assigneeId,
      reviewerId: newTask.reviewerId,
      assigneeReason: "Added manually",
      reviewerReason: "Added manually",
    };
    setPayload({
      ...payload,
      tasks: [...payload.tasks, newTask],
      assignments: [...payload.assignments, newAssignment],
    });
  };

  const startEditingSprint = () => {
    setEditingSprintData({ ...payload.sprint_plan });
    setIsEditingSprint(true);
  };

  const saveSprintEdit = () => {
    if (!payload || !editingSprintData) return;
    setPayload({
      ...payload,
      sprint_plan: { ...editingSprintData },
    });
    setIsEditingSprint(false);
    setEditingSprintData(null);
  };

  return (
    <div className="flex h-full w-full bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* Sessions Left Sidebar */}
      <div className="hidden md:flex w-64 flex-col border-r border-slate-800 bg-slate-950 p-4">
        <div className="flex items-center gap-x-2 pb-4 border-b border-slate-800 mb-4">
          <AiOutlineHistory className="text-xl text-blue-400" />
          <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-400">Agent Runs</h3>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2">
          {recentSessions.map((session) => (
            <div
              key={session.id}
              onClick={() => handleTemplateClick(session.input)}
              className="group flex flex-col gap-y-1 p-2.5 rounded-md hover:bg-slate-900 hover:cursor-pointer transition-all border border-transparent hover:border-slate-800"
            >
              <span className="text-xs text-slate-300 font-medium truncate">{session.input}</span>
              <span className="text-[10px] text-slate-500">{session.createdAt}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Workspace */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 space-y-6">
        {/* Workspace Header */}
        <div className="flex flex-col gap-y-1 pb-4 border-b border-slate-850">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-x-2">
              <AiOutlineRobot className="text-3xl text-blue-500 animate-bounce" />
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                AI Agent Workspace
              </h1>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono">
              Live Coordinated Agents
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Decompose backlog requirements, structure Fibonacci-pointed sprints, and assign developers based on active live workloads.
          </p>
        </div>

        {/* Templates recommended boxes */}
        {!isSubmitting && !payload && !saveSuccess && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.map((tmpl, idx) => (
              <div
                key={idx}
                onClick={() => handleTemplateClick(tmpl.prompt)}
                className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-blue-500 hover:bg-slate-950 hover:cursor-pointer transition-all flex flex-col justify-between"
              >
                <div>
                  <h4 className="text-sm font-semibold text-slate-200 mb-1">{tmpl.title}</h4>
                  <p className="text-xs text-slate-400 line-clamp-3">{tmpl.prompt}</p>
                </div>
                <span className="text-[10px] text-blue-400 mt-4 font-mono uppercase tracking-widest">{tmpl.desc}</span>
              </div>
            ))}
          </div>
        )}

        {/* Input prompt form */}
        {!payload && !saveSuccess && (
          <form onSubmit={runAgentWorkflow} className="w-full">
            <div className="relative flex items-center rounded-xl bg-slate-950 border border-slate-800 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 shadow-lg px-4 py-3 transition-all">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your feature requirements (e.g., JWT Auth flow)..."
                disabled={isSubmitting}
                className="w-full bg-transparent resize-none text-slate-100 text-sm focus:outline-none placeholder-slate-500 pr-12 min-h-[48px] max-h-[120px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void runAgentWorkflow(e);
                  }
                }}
              />
              <button
                type="submit"
                disabled={isSubmitting || !prompt.trim()}
                className="absolute right-4 bottom-3.5 p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 transition-colors"
              >
                {isSubmitting ? <FaSpinner className="animate-spin text-sm" /> : <AiOutlineSend className="text-sm" />}
              </button>
            </div>
          </form>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-x-2">
            <FiAlertTriangle className="text-base shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Live Agent Telemetry Logging Feed */}
        {isSubmitting && (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-x-2 border-b border-slate-850 pb-3">
              <BsTerminal className="text-lg text-emerald-400" />
              <h3 className="text-sm font-semibold text-slate-300 font-mono">LangGraph Execution Logs</h3>
            </div>
            <div className="relative pl-6 space-y-6">
              <div className="absolute left-[11px] top-2 bottom-4 w-[1px] bg-slate-800" />
              {steps.map((step) => {
                const IconComponent = step.icon;
                return (
                  <div key={step.id} className="relative flex gap-x-4 items-start">
                    <div
                      className={clsx(
                        "z-10 flex h-6 w-6 items-center justify-center rounded-full border text-xs transition-all",
                        step.status === "completed"
                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-md"
                          : step.status === "running"
                          ? "bg-blue-500/10 border-blue-500 text-blue-400 animate-pulse shadow-md"
                          : "bg-slate-900 border-slate-800 text-slate-500"
                      )}
                    >
                      {step.status === "completed" ? (
                        <BsCheckCircleFill className="text-sm text-emerald-400" />
                      ) : step.status === "running" ? (
                        <FaSpinner className="animate-spin text-[10px]" />
                      ) : (
                        <IconComponent className="text-[10px]" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-x-2">
                        <span className="text-sm font-semibold text-slate-200">{step.name}</span>
                        <span className="text-[10px] font-mono uppercase bg-slate-900 border border-slate-850 text-slate-400 px-1.5 py-0.5 rounded-sm">
                          {step.agent}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Interactive Sprint Review Layout */}
        {payload && (
          <div className="space-y-6 animate-fade-in">
            {/* Header / Main actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-blue-400 font-bold">
                  Review Agent Orchestration Output
                </span>
                <h3 className="text-base font-bold text-slate-200 mt-0.5">
                  Confirm generated Sprint Plan, Tasks, and Assignments
                </h3>
              </div>
              <div className="flex items-center gap-x-3 shrink-0">
                <button
                  onClick={handleDecline}
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-755 border border-slate-700 text-slate-300 disabled:opacity-50 transition-all"
                >
                  {isSaving ? "Processing..." : "Decline & Regenerate"}
                </button>
                <button
                  onClick={handleAccept}
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 shadow-md shadow-blue-500/20 transition-all flex items-center gap-x-1.5"
                >
                  {isSaving ? <FaSpinner className="animate-spin text-xs" /> : <FiCheck className="text-sm" />}
                  Accept & Save Plan
                </button>
              </div>
            </div>

            {/* Warnings Alert block */}
            {payload.warnings && payload.warnings.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-1">
                <div className="flex items-center gap-x-1.5 font-bold">
                  <FiAlertTriangle className="text-sm shrink-0" />
                  <span>Warnings Detected by Agents:</span>
                </div>
                <ul className="list-disc pl-5 space-y-0.5 mt-1">
                  {payload.warnings.map((warn: string, i: number) => (
                    <li key={i}>{warn}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Next actions block */}
            {payload.next_actions && payload.next_actions.length > 0 && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs space-y-1">
                <div className="flex items-center gap-x-1.5 font-bold">
                  <BsCheckCircleFill className="text-sm shrink-0" />
                  <span>Agent-Recommended Next Action Tasks:</span>
                </div>
                <ul className="list-disc pl-5 space-y-0.5 mt-1">
                  {payload.next_actions.map((act: any, i: number) => (
                    <li key={i}>
                      User <strong className="text-emerald-200">
                        {teamMembers.find(t => t.id === act.userId)?.name || act.userId}
                      </strong>: {act.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Sprint Details Section */}
            <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                <div className="flex items-center gap-x-2 text-slate-200 font-bold">
                  <FaRegCalendarAlt className="text-blue-400" />
                  <span>Proposed Sprint Plan</span>
                </div>
                {!isEditingSprint && (
                  <button
                    onClick={startEditingSprint}
                    className="p-1.5 hover:bg-slate-900 border border-transparent hover:border-slate-800 rounded-md text-slate-400 hover:text-slate-200 transition-all text-xs flex items-center gap-x-1"
                  >
                    <FiEdit2 />
                    <span>Edit Sprint</span>
                  </button>
                )}
              </div>

              {isEditingSprint ? (
                <div className="space-y-4 p-4 rounded-lg bg-slate-900 border border-slate-850">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Sprint Name</label>
                      <input
                        type="text"
                        value={editingSprintData.name}
                        onChange={(e) => setEditingSprintData({ ...editingSprintData, name: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1.5">Sprint Goal</label>
                      <input
                        type="text"
                        value={editingSprintData.goal}
                        onChange={(e) => setEditingSprintData({ ...editingSprintData, goal: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-x-2 justify-end pt-2 border-t border-slate-850">
                    <button
                      onClick={() => setIsEditingSprint(false)}
                      className="px-3 py-1 text-xs rounded bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveSprintEdit}
                      className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-x-1"
                    >
                      <FiCheck />
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-850">
                    <span className="block text-[9px] uppercase font-mono tracking-wider text-slate-500 mb-1">Sprint Name</span>
                    <span className="text-sm font-semibold text-slate-200">{sprintPlanDisplay?.name}</span>
                  </div>
                  <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-850 md:col-span-2">
                    <span className="block text-[9px] uppercase font-mono tracking-wider text-slate-500 mb-1">Sprint Goal</span>
                    <span className="text-xs text-slate-300 font-medium italic">{sprintPlanDisplay?.goal || "None"}</span>
                  </div>
                  <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-850">
                    <span className="block text-[9px] uppercase font-mono tracking-wider text-slate-500 mb-1">Story Points</span>
                    <span className="text-sm font-semibold text-slate-200">
                      {sprintPlanDisplay?.plannedPoints} / {sprintPlanDisplay?.totalCapacityPoints} SP
                    </span>
                    <span className="block text-[9px] text-slate-500 mt-1">Planned vs team capacity</span>
                  </div>
                </div>
              )}
            </div>

            {/* Generated Task list */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                <div className="flex items-center gap-x-2 text-slate-200 font-bold">
                  <FaTasks className="text-blue-400" />
                  <span>Proposed Task List ({payload.tasks?.length})</span>
                </div>
                <button
                  onClick={addNewTask}
                  className="px-2.5 py-1 text-[10px] uppercase font-mono tracking-wider rounded bg-slate-950 border border-slate-800 hover:border-blue-500 hover:bg-slate-900 text-blue-400 font-bold flex items-center gap-x-1.5 transition-all cursor-pointer"
                >
                  <FiPlus className="text-xs" />
                  <span>Add Task</span>
                </button>
              </div>

              {/* Task Edit Form Inline */}
              {editingTaskId && editingTaskData && (
                <div className="p-4 rounded-xl bg-slate-950 border border-blue-500/40 shadow-xl space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                    <h4 className="text-sm font-bold text-blue-400">Edit Task: {editingTaskData.title}</h4>
                    <button
                      onClick={() => setEditingTaskId(null)}
                      className="p-1 rounded-full hover:bg-slate-900 text-slate-400"
                    >
                      <FiX />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1">Title</label>
                      <input
                        type="text"
                        value={editingTaskData.title}
                        onChange={(e) => setEditingTaskData({ ...editingTaskData, title: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1">Story Points</label>
                      <input
                        type="number"
                        value={editingTaskData.storyPoints || ""}
                        onChange={(e) => setEditingTaskData({ ...editingTaskData, storyPoints: parseInt(e.target.value) || 0 })}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1">Description</label>
                      <textarea
                        value={editingTaskData.description || ""}
                        onChange={(e) => setEditingTaskData({ ...editingTaskData, description: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 h-20 resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1">Type</label>
                      <select
                        value={editingTaskData.type}
                        onChange={(e) => setEditingTaskData({ ...editingTaskData, type: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
                      >
                        <option value="TASK">Task</option>
                        <option value="BUG">Bug</option>
                        <option value="STORY">Story</option>
                        <option value="EPIC">Epic</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1">Priority</label>
                      <select
                        value={editingTaskData.priority}
                        onChange={(e) => setEditingTaskData({ ...editingTaskData, priority: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
                      >
                        <option value="P1_CRITICAL">P1 Critical</option>
                        <option value="P2_HIGH">P2 High</option>
                        <option value="P3_MEDIUM">P3 Medium</option>
                        <option value="P4_LOW">P4 Low</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-500 mb-1">Assignee</label>
                      <select
                        value={editingTaskData.assigneeId || ""}
                        onChange={(e) => setEditingTaskData({ ...editingTaskData, assigneeId: e.target.value || null })}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
                      >
                        <option value="">Unassigned</option>
                        {teamMembers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-x-2 pt-2 border-t border-slate-850">
                    <button
                      onClick={() => setEditingTaskId(null)}
                      className="px-3.5 py-1.5 rounded bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveTaskEdit}
                      className="px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-x-1"
                    >
                      <FiCheck />
                      Apply Changes
                    </button>
                  </div>
                </div>
              )}

              {/* Task list view */}
              <div className="grid grid-cols-1 gap-3">
                {payload.tasks?.map((task: any) => {
                  const assignment = payload.assignments?.find((ass: any) => ass.taskId === task.id);
                  const assignee = teamMembers.find((m) => m.id === task.assigneeId);
                  return (
                    <div
                      key={task.id}
                      className="flex flex-col p-4 rounded-xl bg-slate-950 border border-slate-850 hover:border-slate-800 hover:bg-slate-950/80 transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="truncate space-y-1">
                          <div className="flex items-center gap-x-2">
                            <span className="text-xs font-mono font-bold text-blue-400">
                              {task.key || "PENDING"}
                            </span>
                            <span className="text-xs font-bold text-slate-200">{task.title}</span>
                          </div>
                          <p className="text-xs text-slate-400 truncate max-w-2xl">{task.description}</p>
                        </div>
                        <div className="flex items-center gap-x-2 shrink-0">
                          <button
                            onClick={() => startEditingTask(task)}
                            className="p-1 hover:bg-slate-900 border border-transparent hover:border-slate-855 text-slate-400 hover:text-slate-200 rounded transition-all"
                            title="Edit task"
                          >
                            <FiEdit2 className="text-xs" />
                          </button>
                          <button
                            onClick={() => deleteGeneratedTask(task.id)}
                            className="p-1 hover:bg-rose-950/30 border border-transparent hover:border-rose-900/50 text-slate-400 hover:text-rose-400 rounded transition-all"
                            title="Delete task"
                          >
                            <FiTrash2 className="text-xs" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-850 gap-2">
                        {/* Tags */}
                        <div className="flex items-center gap-x-2">
                          <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-850">
                            {task.type}
                          </span>
                          <span
                            className={clsx(
                              "text-[9px] font-bold px-1.5 py-0.5 rounded",
                              task.priority === "P1_CRITICAL"
                                ? "bg-rose-900/20 text-rose-400"
                                : task.priority === "P2_HIGH"
                                ? "bg-amber-900/20 text-amber-400"
                                : "bg-blue-900/20 text-blue-400"
                            )}
                          >
                            {task.priority?.replace("P1_", "").replace("P2_", "").replace("P3_", "").replace("P4_", "")}
                          </span>
                          <span className="text-[9px] font-mono bg-indigo-900/20 text-indigo-400 px-1.5 py-0.5 rounded">
                            {task.storyPoints} SP
                          </span>
                        </div>

                        {/* Assignee / review rationale */}
                        <div className="flex items-center gap-x-2 text-[10px] text-slate-400">
                          {assignee ? (
                            <span className="flex items-center gap-x-1">
                              <span>Assignee:</span>
                              <strong className="text-slate-200 font-semibold">{assignee.name}</strong>
                            </span>
                          ) : (
                            <span className="text-slate-500">Unassigned</span>
                          )}
                          {assignment?.assigneeReason && (
                            <span className="hidden lg:inline text-slate-500 italic max-w-sm truncate">
                              ({assignment.assigneeReason})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Generated output details card (SAVED SUCCESS) */}
        {saveSuccess && (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-xl space-y-5 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <div className="flex items-center gap-x-2">
                <BsCheckCircleFill className="text-emerald-500 text-xl" />
                <h3 className="text-lg font-bold text-slate-200">Orchestration Stored & Approved!</h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">DB Commits Finalized</span>
            </div>

            <p className="text-sm text-slate-300">
              The generated Sprint Plan, user stories, and resource allocations have been saved to your PostgreSQL database. They are now fully integrated and visible in your project workspace.
            </p>

            <div className="flex items-center gap-x-4 pt-2">
              <Link href="/project/backlog">
                <span className="inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer shadow-lg shadow-blue-600/20">
                  Go to Backlog
                </span>
              </Link>
              <Link href="/project/board">
                <span className="inline-flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 px-5 py-2.5 text-xs font-bold text-slate-200 border border-slate-700 transition-colors cursor-pointer">
                  Go to Active Board
                </span>
              </Link>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>
    </div>
  );
}

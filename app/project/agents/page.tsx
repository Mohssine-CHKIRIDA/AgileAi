"use client";

import React, { useState, useEffect, useRef } from "react";
import { AiOutlineSend, AiOutlineRobot, AiOutlineHistory } from "react-icons/ai";
import { BsCpu, BsTerminal, BsCheckCircleFill } from "react-icons/bs";
import { FaUserCheck, FaTasks, FaRegCalendarAlt, FaSpinner } from "react-icons/fa";
import Link from "next/link";
import clsx from "clsx";

type StepStatus = "idle" | "running" | "completed";

interface AgentStep {
  id: number;
  name: string;
  agent: string;
  desc: string;
  status: StepStatus;
  icon: React.ComponentType<{ className?: string }>;
}

interface SimulatedTask {
  id: string;
  key: string;
  title: string;
  storyPoints: number;
  type: string;
  priority: string;
}

interface SessionRecord {
  id: string;
  input: string;
  createdAt: string;
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
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [recentSessions, setRecentSessions] = useState<SessionRecord[]>([]);
  const [generatedSprint, setGeneratedSprint] = useState<{ name: string; goal: string } | null>(null);
  const [generatedTasks, setGeneratedTasks] = useState<SimulatedTask[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
    fetchSessions();
  }, []);

  async function fetchSessions() {
    try {
      const res = await fetch("/api/issues"); // Read issues to test headers/cookies
      // For now, load a static history mock or get it dynamically if needed.
      // In local dev, we will pre-populate.
      setRecentSessions([
        { id: "1", input: "Setup Google OAuth Login Flow", createdAt: "Just now" },
        { id: "2", input: "Stripe Subscription Billing", createdAt: "10 mins ago" },
        { id: "3", input: "Database migration for subtasks", createdAt: "Yesterday" },
      ]);
    } catch (e) {
      console.error(e);
    }
  }

  const handleTemplateClick = (text: string) => {
    setPrompt(text);
  };

  const runAgentWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setGeneratedSprint(null);
    setGeneratedTasks([]);
    setCurrentStep(0);

    // Reset all steps to idle
    setSteps((prev) => prev.map((s) => ({ ...s, status: "idle" })));

    // Step 1: Supervisor start
    setSteps((prev) =>
      prev.map((s, idx) => (idx === 0 ? { ...s, status: "running" } : s))
    );
    await delay(1500);
    setSteps((prev) =>
      prev.map((s, idx) => (idx === 0 ? { ...s, status: "completed" } : idx === 1 ? { ...s, status: "running" } : s))
    );

    // Step 2: Task Agent
    await delay(2000);
    setSteps((prev) =>
      prev.map((s, idx) => (idx === 1 ? { ...s, status: "completed" } : idx === 2 ? { ...s, status: "running" } : s))
    );

    // Step 3: Planning Agent
    await delay(2000);
    setSteps((prev) =>
      prev.map((s, idx) => (idx === 2 ? { ...s, status: "completed" } : idx === 3 ? { ...s, status: "running" } : s))
    );

    // Step 4: Assignment Agent
    await delay(2000);

    try {
      // Send actual request to backend to save into DB
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setGeneratedSprint(data.sprint);
        setGeneratedTasks(data.tasks);
        // Refresh local session items list
        setRecentSessions(prev => [
          { id: data.session.id, input: prompt, createdAt: "Just now" },
          ...prev.slice(0, 4)
        ]);
      } else {
        console.error("Agent execution failed:", data.error);
      }
    } catch (err) {
      console.error("Failed to contact agents API:", err);
    } finally {
      setSteps((prev) =>
        prev.map((s) => (s.id === 4 ? { ...s, status: "completed" } : s))
      );
      setIsSubmitting(false);
      setPrompt("");
      // Scroll to summary details
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    }
  };

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
          <div className="flex items-center gap-x-2">
            <AiOutlineRobot className="text-3xl text-blue-500 animate-bounce" />
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              AI Agent Workspace
            </h1>
          </div>
          <p className="text-sm text-slate-400">
            Prompt our coordinated multi-agent workflow to decompose requirements, schedule story-pointed sprints, and assign tasks.
          </p>
        </div>

        {/* Template recommendation boxes (only visible when not submitting and not loaded details) */}
        {!isSubmitting && generatedTasks.length === 0 && (
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
        <form onSubmit={runAgentWorkflow} className="w-full">
          <div className="relative flex items-center rounded-xl bg-slate-950 border border-slate-800 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 shadow-lg px-4 py-3 transition-all">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your feature requirements (e.g. JWT Auth flow)..."
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

        {/* Live Agent Telemetry Logging Feed */}
        {(isSubmitting || steps.some((s) => s.status !== "idle")) && (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-x-2 border-b border-slate-850 pb-3">
              <BsTerminal className="text-lg text-emerald-400" />
              <h3 className="text-sm font-semibold text-slate-300 font-mono">LangGraph Execution Logs</h3>
            </div>
            <div className="relative pl-6 space-y-6">
              {/* Stepper vertical line */}
              <div className="absolute left-[11px] top-2 bottom-4 w-[1px] bg-slate-800" />

              {steps.map((step) => {
                const IconComponent = step.icon;
                return (
                  <div key={step.id} className="relative flex gap-x-4 items-start">
                    {/* Circle icon marker */}
                    <div
                      className={clsx(
                        "z-10 flex h-6 w-6 items-center justify-center rounded-full border text-xs transition-all",
                        step.status === "completed"
                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-500/20"
                          : step.status === "running"
                          ? "bg-blue-500/10 border-blue-500 text-blue-400 animate-pulse shadow-md shadow-blue-500/20"
                          : "bg-slate-900 border-slate-800 text-slate-500"
                      )}
                    >
                      {step.status === "completed" ? (
                        <BsCheckCircleFill className="text-sm" />
                      ) : step.status === "running" ? (
                        <FaSpinner className="animate-spin text-[10px]" />
                      ) : (
                        <IconComponent className="text-[10px]" />
                      )}
                    </div>

                    {/* Step Content */}
                    <div className="flex flex-col">
                      <div className="flex items-center gap-x-2">
                        <span className="text-sm font-semibold text-slate-200">{step.name}</span>
                        <span className="text-[10px] font-mono uppercase bg-slate-900 border border-slate-850 text-slate-400 px-1.5 py-0.5 rounded-sm">
                          {step.agent}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Generated output details card */}
        {generatedSprint && (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-xl space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <div className="flex items-center gap-x-2">
                <BsCheckCircleFill className="text-emerald-500 text-xl" />
                <h3 className="text-lg font-bold text-slate-200">Orchestration Completed Successfully!</h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">DB Transaction Stored</span>
            </div>

            {/* Sprint Summary */}
            <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-850">
              <div className="flex items-center gap-x-2 text-slate-300 font-bold mb-1">
                <FaRegCalendarAlt className="text-blue-400 text-sm" />
                <span>{generatedSprint.name} Created</span>
              </div>
              <p className="text-xs text-slate-400 italic">Goal: {generatedSprint.goal}</p>
            </div>

            {/* Backlog Task List */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-300">Generated Task List</h4>
              <div className="grid grid-cols-1 gap-2">
                {generatedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-850/60 hover:bg-slate-900/80 transition-all"
                  >
                    <div className="flex items-center gap-x-3 truncate">
                      <span className="text-xs font-mono font-bold text-blue-400">{task.key}</span>
                      <span className="text-xs text-slate-200 truncate">{task.title}</span>
                    </div>
                    <div className="flex items-center gap-x-2 shrink-0">
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded-sm bg-slate-800 text-slate-400">
                        {task.type}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-blue-900/30 text-blue-400">
                        {task.storyPoints} SP
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Action Navigation links */}
            <div className="flex items-center gap-x-4 pt-2">
              <Link href="/project/backlog">
                <span className="inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-bold text-white transition-colors cursor-pointer">
                  Go to Backlog
                </span>
              </Link>
              <Link href="/project/board">
                <span className="inline-flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-bold text-slate-200 border border-slate-700 transition-colors cursor-pointer">
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

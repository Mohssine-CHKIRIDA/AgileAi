import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getDevAuth } from "@/server/dev-auth";
import { TaskStatus, TaskType, Priority, SprintPlanStatus, ValidationStatus } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const { userId } = getDevAuth(req);
    const resolvedUserId = userId ?? "local-user-1";

    const body = await req.json();
    const { prompt } = body as { prompt?: string };

    if (!prompt || prompt.trim() === "") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // 1. Locate the default project
    const project = await prisma.project.findFirst({
      where: { key: "JIRA-CLONE" },
    });

    if (!project) {
      return NextResponse.json({ error: "Default project not found" }, { status: 404 });
    }

    // 2. Fetch users in the system and compute their workloads
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      include: { skills: true },
    });

    const teamMembers = await Promise.all(
      users.map(async (user) => {
        const activeTasksCount = await prisma.task.count({
          where: {
            assigneeId: user.id,
            deletedAt: null,
            status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
          },
        });
        return {
          id: user.id,
          name: user.name,
          skills: user.skills.map((s) => s.skill),
          current_load: activeTasksCount,
        };
      })
    );

    // 3. Invoke the Python LangGraph API in stateless mode (skip_db_write: true)
    let agentResponse;
    try {
      const response = await fetch("http://localhost:8000/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_input: prompt,
          project_id: project.id,
          team_members: teamMembers,
          skip_db_write: true,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return NextResponse.json(
          { error: `Python agents API error: ${response.status} - ${errText}` },
          { status: 502 }
        );
      }

      agentResponse = await response.json();
    } catch (err: any) {
      console.error("Failed to connect to Python agents microservice:", err);
      return NextResponse.json(
        { error: "Failed to connect to Python agents microservice. Make sure it is running on port 8000." },
        { status: 503 }
      );
    }

    if (agentResponse.error) {
      return NextResponse.json({ error: agentResponse.error }, { status: 422 });
    }

    // 4. Log the Agent Session
    const sessionOutput = {
      action: "orchestrate",
      sprint_goal: agentResponse.sprint_goal,
      sprint_plan: agentResponse.sprint_plan,
      tasks: agentResponse.tasks,
      assignments: agentResponse.assignments,
      next_actions: agentResponse.next_actions,
      warnings: agentResponse.warnings,
    };

    const session = await prisma.agentSession.create({
      data: {
        agentName: "supervisor",
        projectId: project.id,
        requestedBy: resolvedUserId,
        input: prompt,
        output: JSON.stringify(sessionOutput),
        status: "completed",
        durationMs: 1500, // estimated
      },
    });

    // 5. Create a PENDING Validation Request containing the payload
    const validationRequest = await prisma.validationRequest.create({
      data: {
        agentName: "Supervisor",
        action: "orchestrate",
        status: ValidationStatus.PENDING,
        projectId: project.id,
        requestedBy: resolvedUserId,
        sessionId: session.id,
        payload: sessionOutput,
        warnings: agentResponse.warnings || [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    return NextResponse.json({
      success: true,
      validationId: validationRequest.id,
      payload: sessionOutput,
      session: session,
      teamMembers: teamMembers,
    });
  } catch (error: any) {
    console.error("Agent orchestration error:", error);
    return NextResponse.json(
      { error: "Internal server error: " + (error?.message ?? error) },
      { status: 500 }
    );
  }
}

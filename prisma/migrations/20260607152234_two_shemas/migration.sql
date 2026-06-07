-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "agents";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "business";

-- CreateEnum
CREATE TYPE "business"."MemberRole" AS ENUM ('OWNER', 'ADMIN', 'PROJECT_MANAGER', 'DEVELOPER', 'VIEWER');

-- CreateEnum
CREATE TYPE "business"."IntegrationProvider" AS ENUM ('GITHUB', 'GITLAB', 'SLACK', 'DISCORD');

-- CreateEnum
CREATE TYPE "business"."IntegrationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR');

-- CreateEnum
CREATE TYPE "agents"."ValidationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "agents"."TaskStatus" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE');

-- CreateEnum
CREATE TYPE "agents"."TaskType" AS ENUM ('BUG', 'TASK', 'SUBTASK', 'STORY', 'EPIC');

-- CreateEnum
CREATE TYPE "agents"."Priority" AS ENUM ('P1_CRITICAL', 'P2_HIGH', 'P3_MEDIUM', 'P4_LOW');

-- CreateEnum
CREATE TYPE "agents"."SprintPlanStatus" AS ENUM ('DRAFT', 'VALIDATED', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "agents"."AutomationTrigger" AS ENUM ('WEBHOOK_PR_MERGED', 'WEBHOOK_COMMIT_PUSHED', 'WEBHOOK_CI_PASSED', 'WEBHOOK_CI_FAILED', 'ISSUE_STATUS_CHANGED', 'ISSUE_CREATED', 'SPRINT_STARTED', 'SPRINT_CLOSED', 'SCHEDULE', 'AGENT_EVENT');

-- CreateEnum
CREATE TYPE "agents"."AutomationAction" AS ENUM ('MOVE_ISSUE', 'ASSIGN_ISSUE', 'CREATE_ISSUE', 'ADD_LABEL', 'CLOSE_SPRINT', 'SEND_NOTIFICATION', 'POST_SLACK_MESSAGE', 'TRIGGER_AGENT');

-- CreateTable
CREATE TABLE "business"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business"."Project" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "defaultAssignee" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business"."TeamMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" "business"."MemberRole" NOT NULL DEFAULT 'DEVELOPER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business"."MemberSkill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business"."Integration" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" "business"."IntegrationProvider" NOT NULL,
    "status" "business"."IntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "externalId" TEXT,
    "webhookSecret" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "lastSyncAt" TIMESTAMP(3),
    "errorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents"."AgentSession" (
    "id" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL DEFAULT 'user',
    "input" TEXT NOT NULL,
    "output" TEXT,
    "toolsCalled" JSONB NOT NULL DEFAULT '[]',
    "durationMs" INTEGER,
    "tokenCount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "errorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents"."ValidationRequest" (
    "id" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" "agents"."ValidationStatus" NOT NULL DEFAULT 'PENDING',
    "projectId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "sessionId" TEXT,
    "payload" JSONB NOT NULL,
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "rawOutput" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValidationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents"."AgentContext" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "contextData" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents"."EventLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'user',
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents"."Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents"."Task" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sprintPlanId" TEXT,
    "assigneeId" TEXT,
    "reviewerId" TEXT,
    "parentTaskId" TEXT,
    "validationId" TEXT,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "acceptanceCriteria" JSONB NOT NULL DEFAULT '[]',
    "status" "agents"."TaskStatus" NOT NULL DEFAULT 'BACKLOG',
    "type" "agents"."TaskType" NOT NULL DEFAULT 'TASK',
    "priority" "agents"."Priority" NOT NULL DEFAULT 'P3_MEDIUM',
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "storyPoints" INTEGER,
    "estimatedHours" DOUBLE PRECISION,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "blockedReason" TEXT,
    "sprintPosition" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "boardPosition" DOUBLE PRECISION NOT NULL DEFAULT -1,
    "reporterId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents"."Comment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents"."DuplicateDetection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "newTaskTitle" TEXT NOT NULL,
    "similarTaskId" TEXT NOT NULL,
    "similarityScore" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuplicateDetection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents"."IssueSplitSuggestion" (
    "id" TEXT NOT NULL,
    "originalTaskId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "validationId" TEXT,
    "subtasks" JSONB NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueSplitSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents"."Assignment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "validationId" TEXT,
    "assigneeId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "assigneeReason" TEXT,
    "reviewerReason" TEXT,
    "workloadSnapshot" JSONB,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents"."SprintPlan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "validationId" TEXT,
    "name" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "agents"."SprintPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "totalCapacityPoints" INTEGER NOT NULL DEFAULT 0,
    "plannedPoints" INTEGER NOT NULL DEFAULT 0,
    "bufferPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SprintPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents"."VelocityRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sprintPlanId" TEXT NOT NULL,
    "sprintName" TEXT NOT NULL,
    "plannedPoints" INTEGER NOT NULL DEFAULT 0,
    "completedPoints" INTEGER NOT NULL DEFAULT 0,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "completionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VelocityRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents"."RiskAssessment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sprintPlanId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "level" TEXT NOT NULL,
    "factors" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "mitigations" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents"."WorkflowTransition" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "triggerRef" TEXT,
    "reason" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents"."BlockedTask" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sprintPlanId" TEXT,
    "reason" TEXT NOT NULL,
    "blockedSince" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents"."BottleneckRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sprintPlanId" TEXT,
    "columnStatus" TEXT NOT NULL,
    "taskCount" INTEGER NOT NULL,
    "wipLimit" INTEGER,
    "avgDaysInColumn" DOUBLE PRECISION,
    "severity" TEXT NOT NULL,
    "suggestion" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BottleneckRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents"."WorkflowSuggestion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents"."WebhookEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signature" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "sessionId" TEXT,
    "errorMsg" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents"."AutomationRule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "validationId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "triggerType" "agents"."AutomationTrigger" NOT NULL,
    "triggerConfig" JSONB NOT NULL,
    "actionType" "agents"."AutomationAction" NOT NULL,
    "actionConfig" JSONB NOT NULL,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "lastFiredAt" TIMESTAMP(3),
    "fireCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents"."AutomationExecution" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "triggerEventId" TEXT,
    "sessionId" TEXT,
    "success" BOOLEAN NOT NULL,
    "result" JSONB,
    "errorMsg" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents"."AutomationSuggestion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "suggestedRule" JSONB NOT NULL,
    "rationale" TEXT NOT NULL,
    "patternObserved" JSONB,
    "validationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents"."PullRequestLink" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "prUrl" TEXT NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "prTitle" TEXT,
    "repoFullName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "mergedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PullRequestLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "business"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Project_key_key" ON "business"."Project"("key");

-- CreateIndex
CREATE INDEX "TeamMember_projectId_idx" ON "business"."TeamMember"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_userId_projectId_key" ON "business"."TeamMember"("userId", "projectId");

-- CreateIndex
CREATE INDEX "MemberSkill_userId_idx" ON "business"."MemberSkill"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberSkill_userId_skill_key" ON "business"."MemberSkill"("userId", "skill");

-- CreateIndex
CREATE INDEX "Integration_projectId_idx" ON "business"."Integration"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_projectId_provider_key" ON "business"."Integration"("projectId", "provider");

-- CreateIndex
CREATE INDEX "AgentSession_projectId_idx" ON "agents"."AgentSession"("projectId");

-- CreateIndex
CREATE INDEX "AgentSession_agentName_idx" ON "agents"."AgentSession"("agentName");

-- CreateIndex
CREATE INDEX "ValidationRequest_projectId_status_idx" ON "agents"."ValidationRequest"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentContext_projectId_agentName_key" ON "agents"."AgentContext"("projectId", "agentName");

-- CreateIndex
CREATE INDEX "EventLog_projectId_idx" ON "agents"."EventLog"("projectId");

-- CreateIndex
CREATE INDEX "EventLog_entityType_entityId_idx" ON "agents"."EventLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "agents"."Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Task_projectId_idx" ON "agents"."Task"("projectId");

-- CreateIndex
CREATE INDEX "Task_sprintPlanId_idx" ON "agents"."Task"("sprintPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_key_projectId_key" ON "agents"."Task"("key", "projectId");

-- CreateIndex
CREATE INDEX "Comment_taskId_idx" ON "agents"."Comment"("taskId");

-- CreateIndex
CREATE INDEX "DuplicateDetection_projectId_idx" ON "agents"."DuplicateDetection"("projectId");

-- CreateIndex
CREATE INDEX "IssueSplitSuggestion_projectId_idx" ON "agents"."IssueSplitSuggestion"("projectId");

-- CreateIndex
CREATE INDEX "Assignment_taskId_idx" ON "agents"."Assignment"("taskId");

-- CreateIndex
CREATE INDEX "Assignment_projectId_idx" ON "agents"."Assignment"("projectId");

-- CreateIndex
CREATE INDEX "SprintPlan_projectId_idx" ON "agents"."SprintPlan"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "VelocityRecord_sprintPlanId_key" ON "agents"."VelocityRecord"("sprintPlanId");

-- CreateIndex
CREATE INDEX "VelocityRecord_projectId_idx" ON "agents"."VelocityRecord"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskAssessment_sprintPlanId_key" ON "agents"."RiskAssessment"("sprintPlanId");

-- CreateIndex
CREATE INDEX "RiskAssessment_projectId_idx" ON "agents"."RiskAssessment"("projectId");

-- CreateIndex
CREATE INDEX "WorkflowTransition_taskId_idx" ON "agents"."WorkflowTransition"("taskId");

-- CreateIndex
CREATE INDEX "WorkflowTransition_projectId_idx" ON "agents"."WorkflowTransition"("projectId");

-- CreateIndex
CREATE INDEX "BlockedTask_projectId_idx" ON "agents"."BlockedTask"("projectId");

-- CreateIndex
CREATE INDEX "BlockedTask_taskId_idx" ON "agents"."BlockedTask"("taskId");

-- CreateIndex
CREATE INDEX "BottleneckRecord_projectId_idx" ON "agents"."BottleneckRecord"("projectId");

-- CreateIndex
CREATE INDEX "WorkflowSuggestion_projectId_idx" ON "agents"."WorkflowSuggestion"("projectId");

-- CreateIndex
CREATE INDEX "WebhookEvent_projectId_processed_idx" ON "agents"."WebhookEvent"("projectId", "processed");

-- CreateIndex
CREATE INDEX "AutomationRule_projectId_enabled_idx" ON "agents"."AutomationRule"("projectId", "enabled");

-- CreateIndex
CREATE INDEX "AutomationExecution_ruleId_idx" ON "agents"."AutomationExecution"("ruleId");

-- CreateIndex
CREATE INDEX "AutomationExecution_projectId_idx" ON "agents"."AutomationExecution"("projectId");

-- CreateIndex
CREATE INDEX "AutomationSuggestion_projectId_idx" ON "agents"."AutomationSuggestion"("projectId");

-- CreateIndex
CREATE INDEX "PullRequestLink_taskId_idx" ON "agents"."PullRequestLink"("taskId");

-- CreateIndex
CREATE INDEX "PullRequestLink_projectId_idx" ON "agents"."PullRequestLink"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "PullRequestLink_provider_repoFullName_prNumber_key" ON "agents"."PullRequestLink"("provider", "repoFullName", "prNumber");

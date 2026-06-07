/*
  Warnings:

  - Added the required column `creatorId` to the `SprintPlan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "agents"."SprintPlan" ADD COLUMN     "color" TEXT NOT NULL DEFAULT '#0052CC',
ADD COLUMN     "creatorId" TEXT NOT NULL,
ALTER COLUMN "goal" SET DEFAULT '';

-- AlterTable
ALTER TABLE "agents"."Task" ADD COLUMN     "sprintColor" TEXT,
ALTER COLUMN "aiGenerated" SET DEFAULT false;

-- CreateIndex
CREATE INDEX "SprintPlan_creatorId_idx" ON "agents"."SprintPlan"("creatorId");

-- CreateIndex
CREATE INDEX "Task_creatorId_idx" ON "agents"."Task"("creatorId");

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "currentPhase" TEXT,
ADD COLUMN     "hasNextPhase" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nextPhaseDescription" TEXT,
ADD COLUMN     "parentTaskId" TEXT;

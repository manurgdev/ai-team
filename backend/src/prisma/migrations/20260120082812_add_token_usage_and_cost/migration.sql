-- AlterTable
ALTER TABLE "AgentOutput" ADD COLUMN     "estimatedCost" DOUBLE PRECISION,
ADD COLUMN     "inputTokens" INTEGER,
ADD COLUMN     "outputTokens" INTEGER,
ADD COLUMN     "totalTokens" INTEGER;

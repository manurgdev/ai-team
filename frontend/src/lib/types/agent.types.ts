import { GitHubContextSelection } from './github.types';

export type AgentRole =
  | 'tech-lead'
  | 'product-owner'
  | 'frontend'
  | 'backend'
  | 'devops'
  | 'qa';

export interface AgentDefinition {
  role: AgentRole;
  name: string;
  description: string;
  systemPrompt: string;
  capabilities: string[];
  dependencies: AgentRole[];
}

export interface Artifact {
  type: 'code' | 'document' | 'diagram' | 'config';
  filename: string;
  content: string;
  language?: string;
}

export interface AgentOutput {
  id: string;
  agentRole: AgentRole;
  content: string;
  artifacts?: Artifact[];
  status: 'success' | 'error';
  error?: string;
  executionTime?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  createdAt: string;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string;
  selectedAgents: AgentRole[];
  executionMode: ExecutionMode;
  status: TaskStatus;
  provider: string;
  model?: string;
  createdAt: string;
  completedAt?: string;
  agentOutputs?: AgentOutput[];
  hasNextPhase?: boolean;
  nextPhaseDescription?: string | null;
  currentPhase?: string | null;
  parentTaskId?: string | null;
}

export type ExecutionMode = 'sequential' | 'parallel';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'error';

export interface ExecuteTaskDto {
  taskDescription: string;
  selectedAgents: AgentRole[];
  executionMode: ExecutionMode;
  provider: string;
  model?: string;
  githubContext?: GitHubContextSelection;
}

export interface ExecutionResult {
  taskId: string;
  status: TaskStatus;
  outputs: AgentOutput[];
  totalExecutionTime: number;
  completedAt?: string;
}

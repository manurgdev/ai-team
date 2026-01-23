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

export interface AgentContext {
  taskDescription: string;
  previousOutputs: Map<string, AgentOutput>;
  teamComposition: AgentRole[];
  githubFiles?: GitHubFileContext[];
  allPreviousOutputs?: AgentOutput[]; // All outputs including multiple from same agent
  isReviewTask?: boolean; // True if this is a review/fix task
}

export interface GitHubFileContext {
  path: string;
  content: string;
  language: string;
  size: number;
  tokens: number;
}

export interface AgentOutput {
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
  executionLog?: ExecutionLog;
  createdAt: Date;
}

export interface Artifact {
  type: 'code' | 'document' | 'diagram' | 'config';
  filename: string;
  content: string;
  language?: string;
}

export interface ExecutionResult {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  outputs: AgentOutput[];
  totalExecutionTime: number;
  completedAt?: Date;
}

export type ExecutionMode = 'sequential' | 'parallel';

export interface ExecutionStep {
  timestamp: string;
  type: 'thinking' | 'tool_call' | 'tool_result' | 'message';
  content: string;
  toolName?: string;
  toolInput?: any;
  toolOutput?: any;
  error?: string;
}

export interface ExecutionLog {
  steps: ExecutionStep[];
  summary: {
    totalSteps: number;
    totalToolCalls: number;
    startTime: string;
    endTime: string;
  };
}

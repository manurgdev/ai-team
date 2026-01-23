import apiClient from './client';
import {
  AgentDefinition,
  ExecuteTaskDto,
  ExecutionResult,
  Task,
} from '../types/agent.types';

export const agentsApi = {
  getDefinitions: async (): Promise<AgentDefinition[]> => {
    const response = await apiClient.get<AgentDefinition[]>('/agents/definitions');
    return response.data;
  },

  executeTask: async (data: ExecuteTaskDto): Promise<ExecutionResult> => {
    const response = await apiClient.post<ExecutionResult>('/agents/execute', data);
    return response.data;
  },

  getTask: async (taskId: string): Promise<Task> => {
    const response = await apiClient.get<Task>(`/agents/tasks/${taskId}`);
    return response.data;
  },

  getTasks: async (limit?: number): Promise<Task[]> => {
    const response = await apiClient.get<Task[]>('/agents/tasks', {
      params: { limit },
    });
    return response.data;
  },

  reviewTask: async (data: {
    originalTaskId: string;
    errors: string;
    provider: string;
    model?: string;
    selectedAgents?: string[];
    exportInfo?: {
      owner: string;
      repo: string;
      branchName: string;
      pullRequestUrl: string;
    };
  }): Promise<ExecutionResult & { originalTaskId: string; exportInfo?: any }> => {
    const response = await apiClient.post('/agents/review-task', data);
    return response.data;
  },
};

import { create } from 'zustand';
import { AgentDefinition, AgentRole, ExecutionMode } from '../lib/types/agent.types';
import { GitHubContextSelection } from '../lib/types/github.types';

interface TeamState {
  availableAgents: AgentDefinition[];
  selectedAgents: AgentRole[];
  executionMode: ExecutionMode;
  taskDescription: string;
  selectedModel: string | null;
  githubContext: GitHubContextSelection | null;
  isLoading: boolean;

  setAvailableAgents: (agents: AgentDefinition[]) => void;
  toggleAgent: (role: AgentRole) => void;
  setExecutionMode: (mode: ExecutionMode) => void;
  setTaskDescription: (description: string) => void;
  setSelectedModel: (model: string | null) => void;
  setGithubContext: (context: GitHubContextSelection | null) => void;
  setLoading: (loading: boolean) => void;
  clearSelection: () => void;
  reset: () => void;
}

export const useTeamStore = create<TeamState>((set) => ({
  availableAgents: [],
  selectedAgents: [],
  executionMode: 'sequential',
  taskDescription: '',
  selectedModel: null,
  githubContext: null,
  isLoading: false,

  setAvailableAgents: (agents) => set({ availableAgents: agents }),

  toggleAgent: (role) =>
    set((state) => {
      const isSelected = state.selectedAgents.includes(role);
      return {
        selectedAgents: isSelected
          ? state.selectedAgents.filter((r) => r !== role)
          : [...state.selectedAgents, role],
      };
    }),

  setExecutionMode: (mode) => set({ executionMode: mode }),

  setTaskDescription: (description) => set({ taskDescription: description }),

  setSelectedModel: (model) => set({ selectedModel: model }),

  setGithubContext: (context) => set({ githubContext: context }),

  setLoading: (loading) => set({ isLoading: loading }),

  clearSelection: () => set({ selectedAgents: [] }),

  reset: () =>
    set({
      selectedAgents: [],
      executionMode: 'sequential',
      taskDescription: '',
      selectedModel: null,
      githubContext: null,
      isLoading: false,
    }),
}));

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTeamStore } from '../../store/team-store';
import { agentsApi } from '../../lib/api/agents';
import { AgentCard } from './AgentCard';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { X } from 'lucide-react';

export function TeamBuilder() {
  const {
    availableAgents,
    selectedAgents,
    setAvailableAgents,
    toggleAgent,
    clearSelection,
  } = useTeamStore();

  const { data: agents, isLoading } = useQuery({
    queryKey: ['agentDefinitions'],
    queryFn: agentsApi.getDefinitions,
  });

  useEffect(() => {
    if (agents) {
      // Filter out task-completion-validator (automatic agent, not user-selectable)
      const selectableAgents = agents.filter(
        (agent) => agent.role !== 'task-completion-validator'
      );
      setAvailableAgents(selectableAgents);
    }
  }, [agents, setAvailableAgents]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-6 border rounded-lg space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
                <Skeleton className="h-5 w-5 rounded" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <div className="flex flex-wrap gap-1">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-28 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Build Your Team</h2>
          <p className="text-muted-foreground">
            Select AI agents to collaborate on your task
          </p>
        </div>

        {selectedAgents.length > 0 && (
          <div className="flex items-center gap-3">
            <Badge variant="default" className="text-sm px-3 py-1">
              {selectedAgents.length} agent{selectedAgents.length !== 1 ? 's' : ''}{' '}
              selected
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={clearSelection}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {availableAgents.map((agent) => (
          <AgentCard
            key={agent.role}
            agent={agent}
            isSelected={selectedAgents.includes(agent.role)}
            onToggle={() => toggleAgent(agent.role)}
          />
        ))}
      </div>

      {selectedAgents.length === 0 && availableAgents.length > 0 && (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <div className="text-4xl">👥</div>
            <p className="text-lg font-medium">No agents selected</p>
            <p className="text-sm text-muted-foreground max-w-md">
              Click on the agent cards above to add them to your team. You can select multiple agents to collaborate on your task.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

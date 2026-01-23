import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Play, Settings as SettingsIcon } from 'lucide-react';
import { useTeamStore } from '../store/team-store';
import { useConfigStore } from '../store/config-store';
import { configApi } from '../lib/api/config';
import { TeamBuilder } from '../components/team/TeamBuilder';
import { TaskInput } from '../components/task/TaskInput';
import { ExecutionViewer } from '../components/execution/ExecutionViewer';
import { AppHeader } from '../components/layout/AppHeader';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';

export function NewTask() {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedAgents, taskDescription, executionMode, selectedModel, githubContext, setTaskDescription, setSelectedAgents, setExecutionMode, setGithubContext } = useTeamStore();
  const { selectedProvider } = useConfigStore();
  const [isExecuting, setIsExecuting] = useState(false);
  const [isExecuteDisabled, setIsExecuteDisabled] = useState(false);

  // Pre-populate from location state if coming from "Continue to Next Phase"
  useEffect(() => {
    const state = location.state as any;
    if (state) {
      if (state.description) {
        setTaskDescription(state.description);
      }
      if (state.selectedAgents) {
        setSelectedAgents(state.selectedAgents);
      }
      if (state.executionMode) {
        setExecutionMode(state.executionMode);
      }
      if (state.githubContext) {
        setGithubContext(state.githubContext);
      }
    }
  }, [location.state, setTaskDescription, setSelectedAgents, setExecutionMode, setGithubContext]);

  // Check if user has API keys configured
  const { data: apiKeys } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: configApi.getApiKeys,
  });

  const hasApiKeys = apiKeys && apiKeys.length > 0;

  // Get auth token
  const authToken = localStorage.getItem('auth_token') || '';

  const handleExecute = () => {
    // Prevent double execution
    if (isExecuteDisabled || isExecuting) {
      return;
    }

    if (selectedAgents.length === 0) {
      toast.error('Please select at least one agent');
      return;
    }

    if (!taskDescription.trim()) {
      toast.error('Please enter a task description');
      return;
    }

    if (!selectedProvider) {
      toast.error('Please select an AI provider');
      return;
    }

    // Disable button immediately to prevent double-clicks
    setIsExecuteDisabled(true);
    setIsExecuting(true);
  };

  const canExecute =
    selectedAgents.length > 0 &&
    taskDescription.trim() &&
    selectedProvider &&
    hasApiKeys &&
    !isExecuteDisabled &&
    !isExecuting;

  const getExecuteTooltip = () => {
    if (!hasApiKeys) return 'Configure an API key first';
    if (selectedAgents.length === 0) return 'Select at least one agent';
    if (!taskDescription.trim()) return 'Enter a task description';
    if (!selectedProvider) return 'Select an AI provider';
    return 'Execute task';
  };

  // Show execution viewer if executing
  if (isExecuting) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader showBackButton backTo="/dashboard" backLabel="Back to Dashboard" />

        <main className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <ExecutionViewer
              taskDescription={taskDescription}
              selectedAgents={selectedAgents}
              executionMode={executionMode}
              provider={selectedProvider!}
              model={selectedModel || undefined}
              authToken={authToken}
              githubContext={githubContext || undefined}
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        showBackButton
        backTo="/dashboard"
        backLabel="Back to Dashboard"
        rightContent={
          <Button
            onClick={handleExecute}
            disabled={!canExecute}
            className="gap-2"
            title={getExecuteTooltip()}
          >
            <Play className="h-4 w-4" />
            <span className="hidden sm:inline">Execute Task</span>
          </Button>
        }
      />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Create New Task</h1>
            <p className="text-muted-foreground">
              Build your AI team and describe the task you want them to work on
            </p>
          </div>

          {!hasApiKeys && (
            <Alert variant="destructive">
              <SettingsIcon className="h-4 w-4" />
              <AlertTitle>No API Keys Configured</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span>
                  You need to configure at least one AI provider API key before creating tasks.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/settings')}
                  className="ml-4"
                >
                  Go to Settings
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <TeamBuilder />
          <TaskInput />
        </div>
      </main>
    </div>
  );
}

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTeamStore } from '../../store/team-store';
import { useConfigStore } from '../../store/config-store';
import { configApi } from '../../lib/api/config';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { AlertCircle, Zap, Layers, Loader2 } from 'lucide-react';
import { ModelSelector } from '../config/ModelSelector';
import { GitHubFileSelector } from './GitHubFileSelector';

export function TaskInput() {
  const { taskDescription, executionMode, setTaskDescription, setExecutionMode, setGithubContext } =
    useTeamStore();
  const { selectedProvider, setSelectedProvider } = useConfigStore();

  // Fetch available providers and API keys
  const { data: providers } = useQuery({
    queryKey: ['providers'],
    queryFn: configApi.getProviders,
  });

  const { data: apiKeys, isLoading: isLoadingKeys } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: configApi.getApiKeys,
  });

  // Get providers that have active API keys
  const availableProviders = providers?.filter((provider) =>
    apiKeys?.some((key) => key.provider === provider.id && key.isActive)
  ) || [];

  // Auto-select first provider if none selected and providers available
  useEffect(() => {
    if (!selectedProvider && availableProviders.length > 0) {
      setSelectedProvider(availableProviders[0].id);
    }
  }, [availableProviders, selectedProvider, setSelectedProvider]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Task Details</CardTitle>
        <CardDescription>
          Describe what you want your AI team to work on
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="task">Task Description</Label>
          <Textarea
            id="task"
            placeholder="Example: Build a todo list application with user authentication and task management features..."
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            rows={6}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Be specific about requirements, features, and any technical preferences
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="mode">Execution Mode</Label>
            <Select
              value={executionMode}
              onValueChange={(value: 'sequential' | 'parallel') =>
                setExecutionMode(value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sequential">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    <div className="text-left">
                      <div className="font-medium">Sequential</div>
                      <div className="text-xs text-muted-foreground">
                        Agents work one after another
                      </div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="parallel">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    <div className="text-left">
                      <div className="font-medium">Parallel</div>
                      <div className="text-xs text-muted-foreground">
                        Independent agents work simultaneously
                      </div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider">AI Provider</Label>
            {isLoadingKeys ? (
              <div className="flex items-center gap-2 p-2 border rounded-md">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading providers...</span>
              </div>
            ) : availableProviders.length > 0 ? (
              <Select
                value={selectedProvider || ''}
                onValueChange={setSelectedProvider}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {availableProviders.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="p-3 border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-900 rounded-md">
                <p className="text-sm text-amber-900 dark:text-amber-100">
                  No API keys configured. Please configure an API key in Settings.
                </p>
              </div>
            )}
            {availableProviders.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {availableProviders.length} provider{availableProviders.length !== 1 ? 's' : ''} configured
              </p>
            )}
          </div>
        </div>

        <ModelSelector />

        <GitHubFileSelector onContextChange={setGithubContext} />

        {executionMode === 'sequential' && (
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-blue-900 dark:text-blue-100">
              <strong>Sequential mode:</strong> Agents will execute in dependency
              order. Later agents can see and build upon earlier agents' work.
            </div>
          </div>
        )}

        {executionMode === 'parallel' && (
          <div className="flex items-start gap-2 p-3 bg-purple-50 dark:bg-purple-950 rounded-lg text-sm">
            <Zap className="h-4 w-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
            <div className="text-purple-900 dark:text-purple-100">
              <strong>Parallel mode:</strong> Independent agents execute
              simultaneously for faster results. Agents with dependencies will wait
              for their prerequisites.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

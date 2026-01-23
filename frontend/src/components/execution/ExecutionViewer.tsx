import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { CheckCircle, Loader2, XCircle, Clock, Eye, ChevronDown, ChevronUp, DollarSign, Zap } from 'lucide-react';
import { GitHubContextSelection } from '../../lib/types/github.types';

interface Agent {
  role: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  executionTime?: number;
  startTime?: number;
  error?: string;
  hasArtifacts?: boolean;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  events: string[];
}

interface ExecutionViewerProps {
  taskDescription: string;
  selectedAgents: string[];
  executionMode: 'sequential' | 'parallel';
  provider: string;
  model?: string;
  authToken: string;
  githubContext?: GitHubContextSelection;
}

export function ExecutionViewer({
  taskDescription,
  selectedAgents,
  executionMode,
  provider,
  model,
  authToken,
  githubContext,
}: ExecutionViewerProps) {
  const navigate = useNavigate();
  const [taskId, setTaskId] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [expandedAgents, setExpandedAgents] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<'connecting' | 'running' | 'completed' | 'error'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [totalCost, setTotalCost] = useState<number>(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const hasStartedRef = useRef(false);

  // Initialize agents
  useEffect(() => {
    const initialAgents: Agent[] = selectedAgents.map((role) => ({
      role,
      name: getAgentName(role),
      description: getAgentDescription(role),
      status: 'pending',
      events: [],
    }));
    setAgents(initialAgents);

    // Auto-expand all agents initially
    const expanded: Record<string, boolean> = {};
    selectedAgents.forEach(role => expanded[role] = true);
    setExpandedAgents(expanded);
  }, [selectedAgents]);

  // Live timer updater for running agents
  useEffect(() => {
    const interval = setInterval(() => {
      setAgents(prev => prev.map(agent => {
        if (agent.status === 'running' && agent.startTime) {
          return {
            ...agent,
            executionTime: Date.now() - agent.startTime,
          };
        }
        return agent;
      }));
    }, 100); // Update every 100ms for smooth timer

    return () => clearInterval(interval);
  }, []);

  // Connect to SSE and start execution
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const url = `${apiUrl}/agents/execute/stream`;

    const startExecution = async () => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            taskDescription,
            selectedAgents,
            executionMode,
            provider,
            model,
            githubContext,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to start execution');
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        setStatus('running');

        // Read the stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;

            const eventMatch = line.match(/^event: (.+)$/m);
            const dataMatch = line.match(/^data: (.+)$/m);

            if (eventMatch && dataMatch) {
              const eventType = eventMatch[1];
              const data = JSON.parse(dataMatch[1]);

              handleSSEEvent(eventType, data);
            }
          }
        }
      } catch (err: any) {
        console.error('Execution error:', err);
        setStatus('error');
        setError(err.message);
      }
    };

    startExecution();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleSSEEvent = (eventType: string, data: any) => {
    switch (eventType) {
      case 'task_created':
        setTaskId(data.taskId);
        addEventToAgent('all', `Task created: ${data.title}`);
        break;

      case 'agent_start':
        setAgents((prev) => {
          // Check if agent exists
          const exists = prev.some(a => a.role === data.agentRole);

          if (!exists) {
            // Add new agent (e.g., task-completion-validator)
            const newAgent: Agent = {
              role: data.agentRole,
              name: data.agentName || getAgentName(data.agentRole),
              description: data.agentDescription || getAgentDescription(data.agentRole),
              status: 'running',
              startTime: Date.now(),
              events: [`Started: ${data.agentName || getAgentName(data.agentRole)}`],
            };
            // Auto-expand validation agent
            setExpandedAgents(exp => ({ ...exp, [data.agentRole]: true }));
            return [...prev, newAgent];
          }

          // Update existing agent
          return prev.map((agent) =>
            agent.role === data.agentRole
              ? {
                  ...agent,
                  status: 'running',
                  startTime: Date.now(),
                  events: [...agent.events, `Started: ${agent.name}`],
                }
              : agent
          );
        });
        break;

      case 'agent_progress':
        addEventToAgent(data.agentRole, data.message || 'Processing...');
        break;

      case 'tool_call':
        const toolName = data.toolName;
        const toolArgs = data.arguments;
        let toolMessage = `🔧 Using tool: ${toolName}`;

        // Add more context based on the tool
        if (toolName === 'get_github_file') {
          toolMessage = `📄 Reading file: ${toolArgs.path}`;
        } else if (toolName === 'list_github_directory') {
          toolMessage = `📁 Exploring directory: ${toolArgs.path || '/'}`;
        } else if (toolName === 'search_github_repo') {
          toolMessage = `🔍 Searching repo for: ${toolArgs.query}`;
        } else if (toolName === 'get_config_files') {
          toolMessage = `⚙️ Getting config files`;
        }

        addEventToAgent(data.agentRole, toolMessage);
        break;

      case 'agent_complete':
        setAgents((prev) =>
          prev.map((agent) =>
            agent.role === data.agentRole
              ? {
                  ...agent,
                  status: 'completed',
                  executionTime: data.executionTime,
                  hasArtifacts: data.hasArtifacts,
                  inputTokens: data.inputTokens,
                  outputTokens: data.outputTokens,
                  totalTokens: data.totalTokens,
                  estimatedCost: data.estimatedCost,
                  events: [
                    ...agent.events,
                    `✓ Completed in ${formatTime(data.executionTime)}`,
                    ...(data.totalTokens ? [`Tokens: ${formatNumber(data.totalTokens)} (${formatNumber(data.inputTokens)} in, ${formatNumber(data.outputTokens)} out)`] : []),
                    ...(data.estimatedCost ? [`Cost: ${formatCost(data.estimatedCost)}`] : []),
                  ],
                }
              : agent
          )
        );
        if (data.estimatedCost) {
          setTotalCost(prev => prev + data.estimatedCost);
        }
        break;

      case 'agent_error':
        setAgents((prev) =>
          prev.map((agent) =>
            agent.role === data.agentRole
              ? {
                  ...agent,
                  status: 'error',
                  error: data.error,
                  executionTime: data.executionTime,
                  events: [...agent.events, `✗ Error: ${data.error}`],
                }
              : agent
          )
        );
        break;

      case 'task_complete':
        setStatus('completed');
        break;

      case 'task_error':
        setStatus('error');
        setError(data.error);
        break;

      case 'complete':
        setStatus('completed');
        if (data.taskId) {
          setTaskId(data.taskId);
        }
        break;

      case 'error':
        setStatus('error');
        setError(data.error);
        break;
    }
  };

  const addEventToAgent = (agentRole: string, message: string) => {
    setAgents((prev) =>
      prev.map((agent) =>
        agent.role === agentRole || agentRole === 'all'
          ? { ...agent, events: [...agent.events, message] }
          : agent
      )
    );
  };

  const toggleAgentExpanded = (agentRole: string) => {
    setExpandedAgents(prev => ({ ...prev, [agentRole]: !prev[agentRole] }));
  };

  const formatTime = (ms?: number) => {
    if (!ms) return '0s';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatNumber = (num?: number) => {
    if (!num) return '0';
    return num.toLocaleString();
  };

  const formatCost = (cost?: number) => {
    if (!cost) return '$0.0000';
    if (cost < 0.01) return `$${cost.toFixed(6)}`;
    return `$${cost.toFixed(4)}`;
  };

  const getAgentName = (role: string): string => {
    const names: Record<string, string> = {
      'tech-lead': 'Technical Lead',
      'product-owner': 'Product Owner',
      frontend: 'Frontend Developer',
      backend: 'Backend Developer',
      devops: 'DevOps Engineer',
      qa: 'QA Engineer',
      'task-completion-validator': '✓ Task Completion Validator',
    };
    return names[role] || role;
  };

  const getAgentDescription = (role: string): string => {
    const descriptions: Record<string, string> = {
      'tech-lead': 'Designing architecture and technical decisions',
      'product-owner': 'Defining requirements and user stories',
      frontend: 'Implementing UI and client-side logic',
      backend: 'Implementing APIs and business logic',
      devops: 'Managing deployment and infrastructure',
      qa: 'Designing testing strategies',
      'task-completion-validator': 'Validating task completeness and creating missing files',
    };
    return descriptions[role] || '';
  };

  const getStatusIcon = (status: Agent['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'running':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: Agent['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">Completed</Badge>;
      case 'running':
        return <Badge className="bg-blue-500">Running</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  if (status === 'connecting') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Connecting to execution service...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Task Execution</CardTitle>
              <CardDescription className="mt-1">
                {status === 'running' && 'Agents are working on your task...'}
                {status === 'completed' && 'Task completed successfully!'}
                {status === 'error' && 'Execution encountered an error'}
              </CardDescription>
            </div>
            {status === 'running' && (
              <Badge className="bg-blue-500 animate-pulse">In Progress</Badge>
            )}
            {status === 'completed' && (
              <Badge className="bg-green-500">Completed</Badge>
            )}
            {status === 'error' && (
              <Badge variant="destructive">Error</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Cost Summary */}
          {totalCost > 0 && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div className="flex-1">
                <p className="text-sm font-medium">Total Estimated Cost</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  {formatCost(totalCost)}
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-900">
              <p className="text-sm text-red-900 dark:text-red-100 font-medium">Error</p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
            </div>
          )}

          {/* View Results Button */}
          {status === 'completed' && taskId && (
            <Button onClick={() => navigate(`/tasks/${taskId}`)} className="w-full">
              <Eye className="mr-2 h-4 w-4" />
              View Full Results
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Agent Cards */}
      <div className="space-y-4">
        {agents.map((agent) => (
          <Card key={agent.role} className="overflow-hidden">
            <CardHeader
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => toggleAgentExpanded(agent.role)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  {getStatusIcon(agent.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-lg">{agent.name}</CardTitle>
                      {getStatusBadge(agent.status)}
                    </div>
                    <CardDescription className="mt-1">
                      {agent.description}
                    </CardDescription>
                    {/* Stats Row */}
                    <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                      {agent.executionTime !== undefined && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatTime(agent.executionTime)}</span>
                        </div>
                      )}
                      {agent.totalTokens !== undefined && agent.totalTokens > 0 && (
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          <span>{formatNumber(agent.totalTokens)} tokens</span>
                        </div>
                      )}
                      {agent.estimatedCost !== undefined && agent.estimatedCost > 0 && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          <span>{formatCost(agent.estimatedCost)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAgentExpanded(agent.role);
                  }}
                >
                  {expandedAgents[agent.role] ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>

            {/* Expanded Event Log */}
            {expandedAgents[agent.role] && agent.events.length > 0 && (
              <CardContent className="pt-0">
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">Event Log:</p>
                  <div className="space-y-1 max-h-60 overflow-y-auto bg-muted/30 rounded p-3">
                    {agent.events.map((event, idx) => (
                      <div
                        key={idx}
                        className="text-xs font-mono text-muted-foreground py-0.5"
                      >
                        <span className="text-primary mr-2">►</span>
                        {event}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            )}

            {/* Error Display */}
            {agent.error && (
              <CardContent className="pt-0">
                <div className="p-3 bg-red-50 dark:bg-red-950 rounded border border-red-200 dark:border-red-900">
                  <p className="text-sm text-red-900 dark:text-red-100 font-medium">
                    Error Details:
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {agent.error}
                  </p>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

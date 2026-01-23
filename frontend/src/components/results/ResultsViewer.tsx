import { useState } from 'react';
import { Task } from '../../lib/types/agent.types';
import { AgentOutputCard } from './AgentOutputCard';
import { ArtifactCard } from './ArtifactCard';
import { NextPhasePrompt } from './NextPhasePrompt';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';
import { Clock, Zap, Layers, CheckCircle, Loader2, XCircle, DollarSign, AlertTriangle, Wrench } from 'lucide-react';
import { toast } from 'sonner';

interface ResultsViewerProps {
  task: Task;
  onTaskUpdate?: () => void;
}

export function ResultsViewer({ task, onTaskUpdate }: ResultsViewerProps) {
  const [isRunningCompletion, setIsRunningCompletion] = useState(false);

  const handleManualCompletion = async () => {
    setIsRunningCompletion(true);

    const authToken = localStorage.getItem('auth_token');
    if (!authToken) {
      toast.error('Not authenticated');
      setIsRunningCompletion(false);
      return;
    }

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const response = await fetch(`${apiUrl}/agents/manual-completion/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ taskId: task.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to start manual completion');
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      toast.success('Starting completion round...');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const messages = buffer.split('\n\n');
        buffer = messages.pop() || '';

        for (const message of messages) {
          if (!message.trim()) continue;

          const eventMatch = message.match(/^event: (.+)$/m);
          const dataMatch = message.match(/^data: (.+)$/m);

          if (eventMatch && dataMatch) {
            const eventType = eventMatch[1];
            const data = JSON.parse(dataMatch[1]);

            if (eventType === 'completion-complete') {
              toast.success('Completion round finished!');
              // Trigger task refresh
              if (onTaskUpdate) {
                onTaskUpdate();
              }
            } else if (eventType === 'error') {
              toast.error(data.error || 'Completion failed');
            }
          }
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to run completion round');
    } finally {
      setIsRunningCompletion(false);
    }
  };

  const getStatusIcon = () => {
    switch (task.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'running':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusText = () => {
    switch (task.status) {
      case 'completed':
        return 'Completed';
      case 'running':
        return 'Running';
      case 'error':
        return 'Error';
      case 'pending':
        return 'Pending';
      default:
        return task.status;
    }
  };

  const getTotalExecutionTime = () => {
    if (!task.agentOutputs) return 0;
    return task.agentOutputs.reduce((sum, output) => sum + (output.executionTime || 0), 0);
  };

  const getTotalTokens = () => {
    if (!task.agentOutputs) return 0;
    return task.agentOutputs.reduce((sum, output) => sum + (output.totalTokens || 0), 0);
  };

  const getTotalCost = () => {
    if (!task.agentOutputs) return 0;
    return task.agentOutputs.reduce((sum, output) => sum + (output.estimatedCost || 0), 0);
  };

  const formatExecutionTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const formatCost = (cost: number) => {
    if (cost < 0.01) return `$${cost.toFixed(6)}`;
    return `$${cost.toFixed(4)}`;
  };

  const getValidationResult = () => {
    if (!task.agentOutputs) return null;

    // Find the last task-completion-validator output (final check)
    const validatorOutputs = task.agentOutputs.filter(
      (output) => output.agentRole === 'task-completion-validator'
    );

    if (validatorOutputs.length === 0) return null;

    // Get the last one (final validation)
    const lastValidator = validatorOutputs[validatorOutputs.length - 1];

    try {
      // Extract JSON from markdown code block
      const jsonMatch = lastValidator.content.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonContent = jsonMatch ? jsonMatch[1] : lastValidator.content;
      return JSON.parse(jsonContent);
    } catch (error) {
      console.error('Failed to parse validation result:', error);
      return null;
    }
  };

  const validationResult = getValidationResult();

  return (
    <div className="space-y-6">
      {/* Task Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl mb-2">{task.title}</CardTitle>
              <CardDescription className="text-base">
                {task.description}
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="font-medium">{getStatusText()}</span>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Execution Mode</p>
              <div className="flex items-center gap-2">
                {task.executionMode === 'sequential' ? (
                  <>
                    <Layers className="h-4 w-4" />
                    <span className="font-medium">Sequential</span>
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    <span className="font-medium">Parallel</span>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">AI Provider</p>
              <Badge variant="secondary" className="mt-1">
                {task.provider}
              </Badge>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Agents</p>
              <p className="font-medium">{task.selectedAgents.length}</p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Time</p>
              <p className="font-medium">
                {formatExecutionTime(getTotalExecutionTime())}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Tokens</p>
              <p className="font-medium">
                {formatNumber(getTotalTokens())}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Cost</p>
              <div className="flex items-center gap-1">
                <DollarSign className="h-4 w-4 text-green-600" />
                <p className="font-medium text-green-600">
                  {formatCost(getTotalCost())}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {task.selectedAgents.map((agent) => (
              <Badge key={agent} variant="outline">
                {agent}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Next Phase Prompt */}
      {task.status === 'completed' && task.hasNextPhase && (
        <NextPhasePrompt task={task} />
      )}

      {/* Validation Status */}
      {validationResult && task.status === 'completed' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              {validationResult.status === 'complete' || validationResult.completionPercentage === 100 ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              )}
              <CardTitle>Task Completion Status</CardTitle>
            </div>
            <CardDescription>
              Validation by Task Completion Validator
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Completion Percentage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Completion</span>
                <span className="text-sm font-bold">
                  {validationResult.completionPercentage}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div
                  className={`h-2.5 rounded-full ${
                    validationResult.completionPercentage === 100
                      ? 'bg-green-600'
                      : validationResult.completionPercentage >= 80
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${validationResult.completionPercentage}%` }}
                ></div>
              </div>
            </div>

            {/* Files Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Planned Files</p>
                <p className="text-2xl font-bold">
                  {validationResult.plannedFiles?.length || 0}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Created Files</p>
                <p className="text-2xl font-bold text-green-600">
                  {validationResult.createdFiles?.length || 0}
                </p>
              </div>
            </div>

            {/* Missing Files Alert */}
            {validationResult.missingFiles && validationResult.missingFiles.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Missing Files ({validationResult.missingFiles.length})</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    {validationResult.missingFiles.slice(0, 5).map((file: any, idx: number) => (
                      <li key={idx} className="text-sm">
                        <code className="font-mono text-xs">{file.path || file}</code>
                        {file.reason && (
                          <span className="text-xs ml-2">- {file.reason}</span>
                        )}
                      </li>
                    ))}
                    {validationResult.missingFiles.length > 5 && (
                      <li className="text-sm text-muted-foreground">
                        ... and {validationResult.missingFiles.length - 5} more
                      </li>
                    )}
                  </ul>

                  {/* Manual Completion Button */}
                  <div className="mt-4">
                    <Button
                      onClick={handleManualCompletion}
                      disabled={isRunningCompletion}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      {isRunningCompletion ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Running Completion...
                        </>
                      ) : (
                        <>
                          <Wrench className="h-4 w-4" />
                          Run Completion Round
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      This will attempt to create the missing files automatically
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Success Message */}
            {validationResult.status === 'complete' && validationResult.completionPercentage === 100 && (
              <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-900 dark:text-green-100">
                  All Tasks Completed
                </AlertTitle>
                <AlertDescription className="text-green-800 dark:text-green-200">
                  All planned files have been successfully created. The implementation is complete!
                </AlertDescription>
              </Alert>
            )}

            {/* Recommendations */}
            {validationResult.recommendations && validationResult.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Recommendations</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {validationResult.recommendations.map((rec: any, idx: number) => {
                    // Handle both string and object recommendations
                    const text = typeof rec === 'string'
                      ? rec
                      : rec.action || rec.details || rec.recommendation || JSON.stringify(rec);
                    return <li key={idx}>{text}</li>;
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Created Files */}
      {task.agentOutputs && task.agentOutputs.some(o => o.artifacts && o.artifacts.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Created Files</CardTitle>
            <CardDescription>
              All files generated by the AI team
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {task.agentOutputs
              .filter(output => output.artifacts && output.artifacts.length > 0)
              .map((output) => (
                <div key={output.id} className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    {output.agentRole}
                  </h4>
                  <div className="space-y-2">
                    {output.artifacts?.map((artifact: any, idx: number) => (
                      <ArtifactCard
                        key={idx}
                        artifact={artifact}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Agent Outputs */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Agent Outputs</h2>

        {task.agentOutputs && task.agentOutputs.length > 0 ? (
          <div className="space-y-4">
            {task.agentOutputs.map((output) => (
              <AgentOutputCard key={output.id} output={output} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Agents are working on your task...</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

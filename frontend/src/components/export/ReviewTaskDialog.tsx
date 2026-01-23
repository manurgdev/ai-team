import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Loader2, AlertTriangle, CheckCircle, Wrench, ExternalLink } from 'lucide-react';
import { githubApi } from '../../lib/api/github';
import { toast } from 'sonner';
import { Task } from '../../lib/types/agent.types';
import { ExportPreview } from './ExportPreview';
import { ExportPreview as ExportPreviewType } from '@/lib/types/github.types';

interface ReviewTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  errors: string;
  exportInfo: {
    owner: string;
    repo: string;
    branchName: string;
    pullRequestUrl: string;
  };
}

export function ReviewTaskDialog({
  open,
  onOpenChange,
  task,
  errors,
  exportInfo,
}: ReviewTaskDialogProps) {
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewCompleted, setReviewCompleted] = useState(false);
  const [newPullRequestUrl, setNewPullRequestUrl] = useState<string | null>(null);
  const [agentProgress, setAgentProgress] = useState<Record<string, { status: string; content?: string }>>({});
  const [isExporting, setIsExporting] = useState(false);
  const [reviewTaskId, setReviewTaskId] = useState<string | null>(null);
  const [additionalErrors, setAdditionalErrors] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<ExportPreviewType | null>(null);
  const [reviewIterationCount, setReviewIterationCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const previewMutation = useMutation({
    mutationFn: () => {
      return githubApi.previewExport(
        reviewTaskId!,
        exportInfo.owner,
        exportInfo.repo,
        exportInfo.branchName
      );
    },
    onSuccess: (preview) => {
      setPreviewData(preview);
      setShowPreview(true);
      setIsReviewing(false);
      toast.success('Review complete! Please review changes before committing.');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to generate preview');
      setIsReviewing(false);
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const githubContext = task.githubContext as any;
      return await githubApi.exportToGitHub({
        taskId,
        owner: exportInfo.owner,
        repo: exportInfo.repo,
        baseBranch: githubContext?.branch || 'main',
        branchName: exportInfo.branchName,
        updateExisting: true,
        pullRequestUrl: exportInfo.pullRequestUrl,
      });
    },
    onSuccess: (data) => {
      setReviewCompleted(true);
      setNewPullRequestUrl(data.pullRequestUrl);
      setIsExporting(false);
      toast.success('Review completed and fixes pushed to PR!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to export fixes');
      setIsReviewing(false);
      setIsExporting(false);
    },
  });

  const handleReview = async () => {
    setIsReviewing(true);
    setAgentProgress({});

    const authToken = localStorage.getItem('auth_token');
    if (!authToken) {
      toast.error('Not authenticated');
      setIsReviewing(false);
      return;
    }

    // Combine automatic errors from GitHub checks with user-provided additional errors
    let combinedErrors = errors;
    if (additionalErrors.trim()) {
      combinedErrors += '\n\n---\n\n## Additional Error Information (from external logs)\n\n' + additionalErrors;
    }

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const response = await fetch(`${apiUrl}/agents/review-task/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          originalTaskId: task.id,
          errors: combinedErrors,
          provider: task.provider,
          model: task.model || undefined,
          selectedAgents: task.selectedAgents,
          exportInfo,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start review task');
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages (separated by double newlines)
        const messages = buffer.split('\n\n');
        buffer = messages.pop() || '';

        for (const message of messages) {
          if (!message.trim()) continue;

          const eventMatch = message.match(/^event: (.+)$/m);
          const dataMatch = message.match(/^data: (.+)$/m);

          if (eventMatch && dataMatch) {
            const eventType = eventMatch[1];
            const data = JSON.parse(dataMatch[1]);

            console.log('SSE Event:', eventType, data);

            if (eventType === 'agent-start' || eventType === 'agent_start') {
              setAgentProgress(prev => ({
                ...prev,
                [data.agentRole]: { status: 'running' }
              }));
            } else if (eventType === 'agent-progress' || eventType === 'agent_progress') {
              setAgentProgress(prev => ({
                ...prev,
                [data.agentRole]: {
                  status: 'running',
                  content: data.message || data.content
                }
              }));
            } else if (eventType === 'tool_call' || eventType === 'tool-call') {
              // Show tool usage in progress
              const toolName = data.toolName;
              const toolArgs = data.arguments;
              let toolMessage = `Using tool: ${toolName}`;

              if (toolName === 'get_github_file') {
                toolMessage = `Reading ${toolArgs.path}`;
              } else if (toolName === 'list_github_directory') {
                toolMessage = `Exploring ${toolArgs.path || '/'}`;
              } else if (toolName === 'search_github_repo') {
                toolMessage = `Searching for: ${toolArgs.query}`;
              } else if (toolName === 'get_config_files') {
                toolMessage = `Getting config files`;
              }

              setAgentProgress(prev => ({
                ...prev,
                [data.agentRole]: {
                  status: 'running',
                  content: toolMessage
                }
              }));
            } else if (eventType === 'agent-complete' || eventType === 'agent_complete') {
              setAgentProgress(prev => ({
                ...prev,
                [data.agentRole]: {
                  status: 'completed',
                  content: data.content
                }
              }));
            } else if (eventType === 'review-complete') {
              setReviewTaskId(data.taskId);
              // Generate preview instead of exporting directly
              previewMutation.mutate();
            } else if (eventType === 'error') {
              toast.error(data.error);
              setIsReviewing(false);
            }
          }
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to review and fix task');
      setIsReviewing(false);
    }
  };

  const handleApproveReview = () => {
    setIsExporting(true);
    setShowPreview(false);
    exportMutation.mutate(reviewTaskId!);
  };

  const handleRejectReview = () => {
    setShowPreview(false);
    setPreviewData(null);
    setReviewIterationCount(prev => prev + 1);
    setReviewTaskId(null);
    // User can adjust error text and retry
    toast.info('Changes rejected. Adjust error description and try again if needed.');
  };

  const handleClose = () => {
    if (reviewCompleted) {
      // Reload page to show updated checks
      window.location.reload();
    } else {
      onOpenChange(false);
    }
  };

  // Show preview if available
  if (showPreview && previewData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Review Changes{reviewIterationCount > 0 ? ` - Iteration ${reviewIterationCount + 1}` : ''}
            </DialogTitle>
            <DialogDescription>
              Review the AI-generated fixes before committing to GitHub
            </DialogDescription>
          </DialogHeader>

          <ExportPreview
            preview={previewData}
            onApprove={handleApproveReview}
            onReject={handleRejectReview}
            isLoading={exportMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Review & Fix Deployment Errors
          </DialogTitle>
          <DialogDescription>
            The AI team will analyze the errors and generate fixes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Task Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Original Task</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="font-medium text-sm">Title:</span>{' '}
                <span className="text-sm text-muted-foreground">{task.title}</span>
              </div>
              <div>
                <span className="font-medium text-sm">Agents:</span>{' '}
                {task.selectedAgents.map((agent) => (
                  <Badge key={agent} variant="outline" className="ml-1">
                    {agent}
                  </Badge>
                ))}
              </div>
              {task.githubContext && (
                <div>
                  <span className="font-medium text-sm">Repository:</span>{' '}
                  <span className="text-sm text-muted-foreground">
                    {(task.githubContext as any).repository?.fullName}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Error Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Deployment Errors (from GitHub Checks)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded-lg">
                <pre className="text-xs whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
                  {errors}
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* Additional Error Input */}
          {!isReviewing && !reviewCompleted && (
            <div className="space-y-2">
              <Label htmlFor="additional-errors" className="text-sm font-medium">
                Additional Error Logs (Optional)
              </Label>
              <p className="text-xs text-muted-foreground">
                If the check only shows a URL to external logs (Vercel, Netlify, etc.) that require authentication,
                paste the complete error logs here.
              </p>
              <Textarea
                id="additional-errors"
                placeholder="Paste complete error logs from external services here..."
                value={additionalErrors}
                onChange={(e) => setAdditionalErrors(e.target.value)}
                className="min-h-[120px] font-mono text-xs"
              />
            </div>
          )}

          {/* Review Progress */}
          {isReviewing && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Review Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(agentProgress).map(([agentRole, progress]) => (
                    <div key={agentRole} className="flex items-start gap-3">
                      {progress.status === 'running' ? (
                        <Loader2 className="h-4 w-4 mt-1 animate-spin text-blue-500" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mt-1 text-green-500" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{agentRole}</p>
                        {progress.content && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {progress.content}
                          </p>
                        )}
                      </div>
                      <Badge variant={progress.status === 'completed' ? 'outline' : 'secondary'}>
                        {progress.status === 'completed' ? 'Done' : 'Working...'}
                      </Badge>
                    </div>
                  ))}

                  {Object.keys(agentProgress).length === 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Initializing review process...
                    </div>
                  )}
                </CardContent>
              </Card>

              {isExporting && (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertDescription>
                    Exporting fixes to GitHub...
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          {reviewCompleted && (
            <Alert className="border-green-500">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                Review completed! Fixes have been pushed to the PR.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          {!reviewCompleted ? (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isReviewing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleReview}
                disabled={isReviewing}
              >
                {isExporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting to GitHub...
                  </>
                ) : isReviewing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reviewing...
                  </>
                ) : (
                  <>
                    <Wrench className="mr-2 h-4 w-4" />
                    Start Review & Fix
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => window.open(newPullRequestUrl || exportInfo.pullRequestUrl, '_blank')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View PR
              </Button>
              <Button onClick={handleClose}>
                Done
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

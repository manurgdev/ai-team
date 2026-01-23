import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { githubApi } from '../../lib/api/github';
import { GitHubRepository, ExportPreview as ExportPreviewType } from '../../lib/types/github.types';
import { Task } from '../../lib/types/agent.types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, Github, CheckCircle, ExternalLink, Info } from 'lucide-react';
import { toast } from 'sonner';
import { GitHubChecksViewer } from './GitHubChecksViewer';
import { ReviewTaskDialog } from './ReviewTaskDialog';
import { ExportPreview } from './ExportPreview';

interface GitHubExporterProps {
  taskId: string;
  taskTitle: string;
  task?: Task;
}

export function GitHubExporter({ taskId, taskTitle, task }: GitHubExporterProps) {
  const queryClient = useQueryClient();

  // Extract githubContext from task if available
  const githubContext = task?.githubContext as any;
  const hasGithubContext = !!githubContext?.repository;
  // Handle both fullName (camelCase) and full_name (snake_case) for backwards compatibility
  const restrictedRepoFullName = hasGithubContext
    ? (githubContext.repository.fullName || githubContext.repository.full_name)
    : null;

  const [githubToken, setGithubToken] = useState('');
  const useStoredToken = true; // Always try to use stored token first
  const [isTokenValidated, setIsTokenValidated] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(null);
  const [baseBranch, setBaseBranch] = useState(githubContext?.branch || 'main');
  const [customBranchName, setCustomBranchName] = useState('');
  const [exportResult, setExportResult] = useState<{
    pullRequestUrl: string;
    branchName: string;
  } | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewErrors, setReviewErrors] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<ExportPreviewType | null>(null);

  // Check if user has a stored GitHub token
  const { data: storedTokenInfo, isLoading: isLoadingToken } = useQuery({
    queryKey: ['githubToken'],
    queryFn: githubApi.getTokenInfo,
  });

  // Load existing exports for this task
  const { data: taskExports, isLoading: isLoadingExports } = useQuery({
    queryKey: ['task-exports', taskId],
    queryFn: () => githubApi.getTaskExports(taskId),
  });

  // Validate GitHub token and fetch user info
  const validateTokenMutation = useMutation({
    mutationFn: () => githubApi.getAuthenticatedUser(githubToken),
    onSuccess: (user) => {
      setIsTokenValidated(true);
      toast.success(`Connected as ${user.login}`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to validate GitHub token');
      setIsTokenValidated(false);
    },
  });

  // Fetch repositories - use stored token if available, otherwise use manual token
  const { data: repositories, isLoading: isLoadingRepos } = useQuery({
    queryKey: ['github-repositories', useStoredToken, githubToken],
    queryFn: () => {
      if (useStoredToken && storedTokenInfo?.hasToken) {
        // Use stored token (backend will decrypt it)
        return githubApi.listRepositories();
      }
      // Use manual token
      return githubApi.listRepositories(githubToken);
    },
    enabled: (useStoredToken && storedTokenInfo?.hasToken) || isTokenValidated,
  });

  // Auto-select repository if task has githubContext
  useEffect(() => {
    if (hasGithubContext && repositories && !selectedRepo) {
      console.log('Looking for repo:', restrictedRepoFullName);
      console.log('Available repos:', repositories.map(r => r.full_name));
      const repo = repositories.find(r => r.full_name === restrictedRepoFullName);
      if (repo) {
        console.log('Found and selecting repo:', repo.full_name);
        setSelectedRepo(repo);
        setBaseBranch(githubContext.branch || repo.default_branch);
      } else {
        console.warn('Repository not found in user repositories:', restrictedRepoFullName);
        toast.error(`Repository ${restrictedRepoFullName} not found in your accessible repositories`);
      }
    }
  }, [hasGithubContext, restrictedRepoFullName, repositories, selectedRepo, githubContext]);

  // Load latest successful export when taskExports is loaded
  useEffect(() => {
    if (taskExports && taskExports.length > 0 && !exportResult) {
      const latestExport = taskExports.find(exp => exp.status === 'completed' && exp.pullRequestUrl);
      if (latestExport) {
        setExportResult({
          pullRequestUrl: latestExport.pullRequestUrl!,
          branchName: latestExport.branchName,
        });

        // Also set the selected repo if available
        if (repositories && latestExport.repositoryUrl) {
          const repoFullName = latestExport.repositoryUrl.replace('https://github.com/', '');
          const repo = repositories.find(r => r.full_name === repoFullName);
          if (repo) {
            setSelectedRepo(repo);
          }
        }
      }
    }
  }, [taskExports, exportResult, repositories]);

  // Preview export mutation
  const previewMutation = useMutation({
    mutationFn: () => {
      if (!selectedRepo) throw new Error('No repository selected');

      const owner = selectedRepo.full_name.split('/')[0];
      const repo = selectedRepo.name;

      return githubApi.previewExport(
        taskId,
        owner,
        repo,
        baseBranch || selectedRepo.default_branch
      );
    },
    onSuccess: (preview) => {
      setPreviewData(preview);
      setShowPreview(true);
      toast.success('Preview loaded successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to generate preview');
    },
  });

  // Export to GitHub mutation
  const exportMutation = useMutation({
    mutationFn: () => {
      if (!selectedRepo) throw new Error('No repository selected');

      const owner = selectedRepo.full_name.split('/')[0];
      const repo = selectedRepo.name;

      return githubApi.exportToGitHub({
        taskId,
        githubToken: useStoredToken && storedTokenInfo?.hasToken ? undefined : githubToken,
        owner,
        repo,
        baseBranch: baseBranch || selectedRepo.default_branch,
        branchName: customBranchName || undefined,
      });
    },
    onSuccess: (result) => {
      setExportResult(result);
      setShowPreview(false);
      setPreviewData(null);
      // Invalidate task exports cache so new export appears in list
      queryClient.invalidateQueries({ queryKey: ['task-exports', taskId] });
      toast.success('Task exported to GitHub successfully!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to export to GitHub');
    },
  });

  const handleValidateToken = () => {
    if (!githubToken.trim()) {
      toast.error('Please enter a GitHub token');
      return;
    }
    validateTokenMutation.mutate();
  };

  const handleSelectRepo = (repoFullName: string) => {
    const repo = repositories?.find((r) => r.full_name === repoFullName);
    if (repo) {
      setSelectedRepo(repo);
      setBaseBranch(repo.default_branch);
    }
  };

  const handleExport = () => {
    if (!selectedRepo) {
      toast.error('Please select a repository');
      return;
    }
    // First, show preview
    previewMutation.mutate();
  };

  const handleApproveExport = () => {
    // User approved, proceed with actual export
    exportMutation.mutate();
  };

  const handleRejectExport = () => {
    // User wants to review & fix again
    setShowPreview(false);
    setPreviewData(null);
    // Open review dialog with a generic message
    setReviewErrors('User requested changes after previewing the export.');
    setShowReviewDialog(true);
  };

  const handleReviewClick = (errors: string) => {
    setReviewErrors(errors);
    setShowReviewDialog(true);
  };

  // Show preview if available
  if (showPreview && previewData) {
    return (
      <div className="space-y-4">
        <ExportPreview
          preview={previewData}
          onApprove={handleApproveExport}
          onReject={handleRejectExport}
          isLoading={exportMutation.isPending}
        />

        {/* Review Dialog */}
        {task && selectedRepo && (
          <ReviewTaskDialog
            open={showReviewDialog}
            onOpenChange={setShowReviewDialog}
            task={task}
            errors={reviewErrors}
            exportInfo={{
              owner: selectedRepo.full_name.split('/')[0],
              repo: selectedRepo.name,
              branchName: customBranchName || `ai-team-${taskId.slice(0, 8)}`,
              pullRequestUrl: exportResult?.pullRequestUrl || '',
            }}
          />
        )}
      </div>
    );
  }

  // If export is successful, show result
  if (exportResult) {
    // Check if this is a loaded export (from DB) or a fresh one
    const isLoadedExport = taskExports?.some(
      exp => exp.pullRequestUrl === exportResult.pullRequestUrl
    );

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <CardTitle>
                {isLoadedExport ? 'Previous Export' : 'Export Successful!'}
              </CardTitle>
            </div>
            <CardDescription>
              {isLoadedExport
                ? 'Showing the most recent export for this task'
                : 'Your task results have been exported to GitHub'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Branch:</span> {exportResult.branchName}
              </p>
              <Button
                onClick={() => window.open(exportResult.pullRequestUrl, '_blank')}
                className="w-full"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Pull Request
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Show GitHub Checks Status */}
        <GitHubChecksViewer
          pullRequestUrl={exportResult.pullRequestUrl}
          onReviewClick={handleReviewClick}
        />

        {/* Review Dialog */}
        {task && selectedRepo && (
          <ReviewTaskDialog
            open={showReviewDialog}
            onOpenChange={setShowReviewDialog}
            task={task}
            errors={reviewErrors}
            exportInfo={{
              owner: selectedRepo.full_name.split('/')[0],
              repo: selectedRepo.name,
              branchName: exportResult.branchName,
              pullRequestUrl: exportResult.pullRequestUrl,
            }}
          />
        )}
      </div>
    );
  }

  // Show loading state while checking for existing exports
  if (isLoadingExports) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            <CardTitle>Export to GitHub</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading exports...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Github className="h-5 w-5" />
          <CardTitle>Export to GitHub</CardTitle>
        </div>
        <CardDescription>
          Export task results as a Pull Request to your GitHub repository
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: GitHub Token */}
        {isLoadingToken ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : storedTokenInfo?.hasToken ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>GitHub Token</Label>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm">
                <span className="text-muted-foreground">Connected as: </span>
                <span className="font-medium">{storedTokenInfo.token?.githubUsername}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Using stored token. Manage in header menu.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="github-token">GitHub Personal Access Token</Label>
              {isTokenValidated && (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
            </div>
            <div className="flex gap-2">
              <Input
                id="github-token"
                type="password"
                placeholder="ghp_..."
                value={githubToken}
                onChange={(e) => {
                  setGithubToken(e.target.value);
                  setIsTokenValidated(false);
                }}
                disabled={isTokenValidated}
              />
              <Button
                onClick={handleValidateToken}
                disabled={validateTokenMutation.isPending || isTokenValidated}
              >
                {validateTokenMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Validating
                  </>
                ) : isTokenValidated ? (
                  'Validated'
                ) : (
                  'Validate'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Create a token at{' '}
              <a
                href="https://github.com/settings/tokens/new?scopes=repo"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                GitHub Settings
              </a>{' '}
              with "repo" scope, or save it in the header menu for future use.
            </p>
          </div>
        )}

        {/* Step 2: Select Repository */}
        {((useStoredToken && storedTokenInfo?.hasToken) || isTokenValidated) && (
          <>
            {hasGithubContext && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  This task was created with context from <strong>{restrictedRepoFullName}</strong>.
                  Export is restricted to this repository.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              <Label>Select Repository</Label>
              {isLoadingRepos ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : repositories && repositories.length > 0 ? (
                <>
                  <Select
                    onValueChange={handleSelectRepo}
                    value={selectedRepo?.full_name}
                    disabled={hasGithubContext && !!selectedRepo}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a repository" />
                    </SelectTrigger>
                    <SelectContent>
                      {hasGithubContext ? (
                        // Only show the restricted repo if githubContext exists
                        repositories
                          .filter(r => r.full_name === restrictedRepoFullName)
                          .map((repo) => (
                            <SelectItem key={repo.id} value={repo.full_name}>
                              {repo.full_name} {repo.private && '(Private)'}
                            </SelectItem>
                          ))
                      ) : (
                        // Show all repos if no restriction
                        repositories.map((repo) => (
                          <SelectItem key={repo.id} value={repo.full_name}>
                            {repo.full_name} {repo.private && '(Private)'}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {hasGithubContext && !selectedRepo && (
                    <Alert variant="destructive">
                      <AlertDescription>
                        Repository <strong>{restrictedRepoFullName}</strong> not found in your accessible repositories.
                        Please make sure you have access to this repository.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No repositories found
                </p>
              )}
              {hasGithubContext && selectedRepo && (
                <p className="text-xs text-muted-foreground">
                  Repository locked to: <strong>{selectedRepo.full_name}</strong>
                </p>
              )}
            </div>

            {/* Step 3: Branch Configuration */}
            {selectedRepo && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="base-branch">Base Branch</Label>
                  <Input
                    id="base-branch"
                    value={baseBranch}
                    onChange={(e) => setBaseBranch(e.target.value)}
                    placeholder="main"
                  />
                  <p className="text-xs text-muted-foreground">
                    The branch to create the PR against (usually "main" or "master").
                    {selectedRepo?.default_branch && ` Default: ${selectedRepo.default_branch}`}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="branch-name">
                    Custom Branch Name (Optional)
                  </Label>
                  <Input
                    id="branch-name"
                    value={customBranchName}
                    onChange={(e) => setCustomBranchName(e.target.value)}
                    placeholder="ai-team-results"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to auto-generate
                  </p>
                </div>

                <div className="space-y-2 p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">Export Preview</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Repository: {selectedRepo.full_name}</li>
                    <li>
                      • PR Title: AI Team Results: {taskTitle}
                    </li>
                    <li>• Base Branch: {baseBranch || selectedRepo.default_branch}</li>
                    <li>
                      • New Branch:{' '}
                      {customBranchName || `ai-team-${taskId.slice(0, 8)}-...`}
                    </li>
                  </ul>
                </div>

                <Button
                  onClick={handleExport}
                  disabled={exportMutation.isPending || previewMutation.isPending}
                  className="w-full"
                  size="lg"
                >
                  {previewMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating Preview...
                    </>
                  ) : exportMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Exporting to GitHub...
                    </>
                  ) : (
                    <>
                      <Github className="h-4 w-4 mr-2" />
                      Create Pull Request
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

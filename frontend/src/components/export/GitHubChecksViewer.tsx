import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { githubApi } from '../../lib/api/github';
import { GitHubCheckRun } from '../../lib/types/github.types';

interface GitHubChecksViewerProps {
  pullRequestUrl: string;
  onReviewClick?: (errors: string) => void;
}

export function GitHubChecksViewer({ pullRequestUrl, onReviewClick }: GitHubChecksViewerProps) {
  // Parse PR URL to extract owner, repo, and pull number
  // Format: https://github.com/{owner}/{repo}/pull/{number}
  const parsePRUrl = (url: string) => {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!match) return null;
    return {
      owner: match[1],
      repo: match[2],
      pullNumber: parseInt(match[3], 10),
    };
  };

  const prInfo = parsePRUrl(pullRequestUrl);

  const {
    data: checks,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['pr-checks', prInfo?.owner, prInfo?.repo, prInfo?.pullNumber],
    queryFn: () => {
      if (!prInfo) throw new Error('Invalid PR URL');
      return githubApi.getPullRequestChecks(prInfo.owner, prInfo.repo, prInfo.pullNumber);
    },
    enabled: !!prInfo,
    refetchInterval: (query) => {
      // Auto-refresh every 10 seconds if checks are still running
      const hasRunning = query.state.data?.check_runs.some(
        (check) => check.status !== 'completed'
      );
      return hasRunning ? 10000 : false;
    },
  });

  const getStatusIcon = (check: GitHubCheckRun) => {
    if (check.status !== 'completed') {
      return <Clock className="h-4 w-4 text-yellow-500" />;
    }

    switch (check.conclusion) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failure':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
      case 'skipped':
        return <AlertTriangle className="h-4 w-4 text-gray-400" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (check: GitHubCheckRun) => {
    if (check.status !== 'completed') {
      return <Badge variant="outline" className="text-yellow-600">Running</Badge>;
    }

    switch (check.conclusion) {
      case 'success':
        return <Badge variant="outline" className="text-green-600">Success</Badge>;
      case 'failure':
        return <Badge variant="destructive">Failed</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="text-gray-600">Cancelled</Badge>;
      case 'skipped':
        return <Badge variant="outline" className="text-gray-600">Skipped</Badge>;
      default:
        return <Badge variant="outline">{check.conclusion || check.status}</Badge>;
    }
  };

  const hasFailures = checks?.check_runs.some(
    (check) => check.status === 'completed' && check.conclusion === 'failure'
  );

  const getFailureErrors = (): string => {
    if (!checks) return '';

    const failedChecks = checks.check_runs.filter(
      (check) => check.status === 'completed' && check.conclusion === 'failure'
    );

    return failedChecks
      .map((check) => {
        let error = `## ${check.name}\n\n`;
        if (check.output.title) {
          error += `**Title:** ${check.output.title}\n\n`;
        }
        if (check.output.summary) {
          error += `**Summary:**\n${check.output.summary}\n\n`;
        }
        if (check.output.text) {
          error += `**Details:**\n${check.output.text}\n\n`;
        }
        error += `**Check URL:** ${check.html_url}\n`;
        return error;
      })
      .join('\n---\n\n');
  };

  if (!prInfo) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Invalid Pull Request URL format</AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load PR checks. {(error as Error).message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>GitHub Checks Status</CardTitle>
            <CardDescription>
              CI/CD status for Pull Request #{prInfo.pullNumber}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(pullRequestUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && !checks ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : checks && checks.check_runs.length > 0 ? (
          <>
            <div className="space-y-2">
              {checks.check_runs.map((check) => (
                <div
                  key={check.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(check)}
                    <div>
                      <p className="font-medium text-sm">{check.name}</p>
                      {check.output.title && (
                        <p className="text-xs text-muted-foreground">{check.output.title}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(check)}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(check.html_url, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {hasFailures && onReviewClick && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>Some checks have failed. Review and fix the issues.</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReviewClick(getFailureErrors())}
                    className="ml-4"
                  >
                    Review & Fix
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No checks found for this Pull Request
          </p>
        )}
      </CardContent>
    </Card>
  );
}

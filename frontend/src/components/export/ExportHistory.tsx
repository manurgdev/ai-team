import { useQuery } from '@tanstack/react-query';
import { githubApi } from '../../lib/api/github';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { ExternalLink, Github, CheckCircle, XCircle, Clock } from 'lucide-react';

export function ExportHistory() {
  const { data: exports, isLoading } = useQuery({
    queryKey: ['github-exports'],
    queryFn: () => githubApi.getExportHistory(10),
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusVariant = (status: string): 'default' | 'destructive' | 'outline' => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            Export History
          </CardTitle>
          <CardDescription>
            Recent exports to GitHub repositories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="p-3 rounded-lg border space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Github className="h-5 w-5" />
          Export History
        </CardTitle>
        <CardDescription>
          Recent exports to GitHub repositories
        </CardDescription>
      </CardHeader>
      <CardContent>
        {exports && exports.length > 0 ? (
          <div className="space-y-3">
            {exports.map((exp) => (
              <div
                key={exp.id}
                className="flex items-start justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(exp.status)}
                    <p className="font-medium text-sm truncate">
                      {exp.task?.title || 'Unknown Task'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={getStatusVariant(exp.status)} className="text-xs">
                      {exp.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground truncate">
                      {exp.repositoryUrl}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Branch: {exp.branchName}
                  </p>
                  {exp.error && (
                    <p className="text-xs text-red-600">
                      Error: {exp.error}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(exp.createdAt).toLocaleString()}
                  </p>
                </div>
                {exp.pullRequestUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(exp.pullRequestUrl!, '_blank')}
                    className="ml-2 flex-shrink-0"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 border-2 border-dashed rounded-lg">
            <div className="flex flex-col items-center gap-2">
              <Github className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium">No exports yet</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Complete a task and export its results to GitHub to see your export history here
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

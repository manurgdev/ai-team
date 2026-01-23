import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, ArrowLeft } from 'lucide-react';
import { agentsApi } from '../lib/api/agents';
import { ResultsViewer } from '../components/results/ResultsViewer';
import { GitHubExporter } from '../components/export/GitHubExporter';
import { AppHeader } from '../components/layout/AppHeader';
import { Button } from '../components/ui/button';

export function TaskResults() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: task,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['task', id],
    queryFn: () => agentsApi.getTask(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      // Auto-refresh every 3 seconds if task is running
      return query.state.data?.status === 'running' ? 3000 : false;
    },
  });

  useEffect(() => {
    // Initial fetch
    if (id) {
      refetch();
    }
  }, [id, refetch]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading task results...</p>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive text-lg">Failed to load task</p>
          <Button onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
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
          task.status === 'running' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          ) : null
        }
      />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <ResultsViewer task={task} onTaskUpdate={() => refetch()} />

          {/* GitHub Export - Only show when task is completed */}
          {task.status === 'completed' && (
            <GitHubExporter taskId={task.id} taskTitle={task.title} task={task} />
          )}
        </div>
      </main>
    </div>
  );
}

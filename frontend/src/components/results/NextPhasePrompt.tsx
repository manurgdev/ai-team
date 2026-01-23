import { useState } from 'react';
import { Task } from '../../lib/types/agent.types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { ArrowRight, Sparkles, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from '../ui/alert';

interface NextPhasePromptProps {
  task: Task;
}

export function NextPhasePrompt({ task }: NextPhasePromptProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  if (!task.hasNextPhase) {
    return null;
  }

  const handleContinueToNextPhase = () => {
    setIsLoading(true);

    // Build the description for the next phase
    const nextPhaseNumber = task.currentPhase
      ? parseInt(task.currentPhase.replace(/\D/g, '')) + 1
      : 2;

    const nextPhaseTitle = `${task.title} - Phase ${nextPhaseNumber}`;
    const nextPhaseDescription = task.nextPhaseDescription
      ? `Continue from ${task.currentPhase || 'Phase 1'}.\n\n${task.nextPhaseDescription}`
      : `Continue implementing the next phase of: ${task.description}`;

    // Navigate to new task page with pre-filled information
    navigate('/tasks/new', {
      state: {
        title: nextPhaseTitle,
        description: nextPhaseDescription,
        parentTaskId: task.id,
        selectedAgents: task.selectedAgents,
        executionMode: task.executionMode,
        githubContext: (task as any).githubContext,
      }
    });
  };

  return (
    <Card className="border-blue-500/50 bg-blue-950/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-400" />
          <CardTitle className="text-blue-100">More Phases Available</CardTitle>
        </div>
        <CardDescription>
          {task.currentPhase || 'Phase 1'} is complete. Continue with the next phase?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {task.nextPhaseDescription && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Next Phase:</strong>
              <div className="mt-2 whitespace-pre-wrap text-muted-foreground">
                {task.nextPhaseDescription.length > 300
                  ? `${task.nextPhaseDescription.substring(0, 300)}...`
                  : task.nextPhaseDescription}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleContinueToNextPhase}
            disabled={isLoading}
            className="flex-1"
            size="lg"
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            Continue to Next Phase
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          This will create a new task that continues from the current implementation.
          The new task will have access to all files created in {task.currentPhase || 'Phase 1'}.
        </p>
      </CardContent>
    </Card>
  );
}

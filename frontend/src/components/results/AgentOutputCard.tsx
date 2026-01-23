import { useState } from 'react';
import { AgentOutput } from '../../lib/types/agent.types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ArtifactCard } from './ArtifactCard';
import { Clock, CheckCircle, XCircle, FileText, ChevronDown, ChevronUp, Zap, DollarSign } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AgentOutputCardProps {
  output: AgentOutput;
}

export function AgentOutputCard({ output }: AgentOutputCardProps) {
  const [isExpanded, setIsExpanded] = useState(false); // Start collapsed for better UX

  const getAgentIcon = () => {
    const iconMap: Record<string, string> = {
      'tech-lead': '🏗️',
      'product-owner': '📋',
      frontend: '💻',
      backend: '⚙️',
      devops: '🚀',
      qa: '🧪',
    };
    return iconMap[output.agentRole] || '👤';
  };

  const getAgentName = () => {
    const nameMap: Record<string, string> = {
      'tech-lead': 'Technical Lead',
      'product-owner': 'Product Owner',
      frontend: 'Frontend Developer',
      backend: 'Backend Developer',
      devops: 'DevOps Engineer',
      qa: 'QA Engineer',
      'task-completion-validator': 'Task Completion Validator',
    };
    return nameMap[output.agentRole] || output.agentRole;
  };

  const formatExecutionTime = (ms?: number) => {
    if (!ms) return 'N/A';
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

  return (
    <Card>
      <CardHeader
        className="cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="text-3xl flex-shrink-0">{getAgentIcon()}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-xl">{getAgentName()}</CardTitle>
                {output.status === 'success' ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Success
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    Error
                  </Badge>
                )}
              </div>
              <CardDescription className="mt-1">
                {new Date(output.createdAt).toLocaleString()}
              </CardDescription>

              {/* Stats Row */}
              <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                {output.executionTime !== undefined && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{formatExecutionTime(output.executionTime)}</span>
                  </div>
                )}
                {output.totalTokens !== undefined && output.totalTokens > 0 && (
                  <div className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    <span>{formatNumber(output.totalTokens)} tokens</span>
                  </div>
                )}
                {output.estimatedCost !== undefined && output.estimatedCost > 0 && (
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    <span>{formatCost(output.estimatedCost)}</span>
                  </div>
                )}
                {output.artifacts && output.artifacts.length > 0 && (
                  <div className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    <span>{output.artifacts.length} artifact{output.artifacts.length !== 1 ? 's' : ''}</span>
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
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {/* Expanded Content */}
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="border-t pt-6 space-y-6">
            {output.status === 'error' && output.error ? (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive font-medium mb-1">Error:</p>
                <p className="text-sm text-destructive/80">{output.error}</p>
              </div>
            ) : (
              <>
                {/* Content */}
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown
                    components={{
                      code({ node, inline, className, children, ...props }: any) {
                        if (inline) {
                          return (
                            <code
                              className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono"
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        }
                        return (
                          <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto">
                            <code className="font-mono text-sm" {...props}>
                              {children}
                            </code>
                          </pre>
                        );
                      },
                    }}
                  >
                    {output.content}
                  </ReactMarkdown>
                </div>

                {/* Artifacts */}
                {output.artifacts && output.artifacts.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="h-4 w-4" />
                      Artifacts ({output.artifacts.length})
                    </div>
                    <div className="space-y-3">
                      {output.artifacts.map((artifact, index) => (
                        <ArtifactCard key={index} artifact={artifact} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

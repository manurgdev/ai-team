import { AgentDefinition } from '../../lib/types/agent.types';
import { Card, CardContent } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { Users, Workflow } from 'lucide-react';

interface AgentCardProps {
  agent: AgentDefinition;
  isSelected: boolean;
  onToggle: () => void;
}

export function AgentCard({ agent, isSelected, onToggle }: AgentCardProps) {
  const getAgentIcon = () => {
    const iconMap: Record<string, string> = {
      'tech-lead': '🏗️',
      'product-owner': '📋',
      frontend: '💻',
      backend: '⚙️',
      devops: '🚀',
      qa: '🧪',
    };
    return iconMap[agent.role] || '👤';
  };

  return (
    <Card
      className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] ${
        isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:border-primary/50'
      }`}
      onClick={onToggle}
    >
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            className="mt-1"
          />

          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{getAgentIcon()}</span>
              <div>
                <h3 className="font-semibold text-lg">{agent.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {agent.description}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Capabilities:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {agent.capabilities.map((capability) => (
                  <Badge key={capability} variant="secondary">
                    {capability}
                  </Badge>
                ))}
              </div>
            </div>

            {agent.dependencies.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Workflow className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Depends on:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {agent.dependencies.map((dep) => (
                    <Badge key={dep} variant="outline">
                      {dep}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

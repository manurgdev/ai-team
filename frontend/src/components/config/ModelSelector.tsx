import { useQuery } from '@tanstack/react-query';
import { configApi } from '../../lib/api/config';
import { useConfigStore } from '../../store/config-store';
import { useTeamStore } from '../../store/team-store';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export function ModelSelector() {
  const { selectedProvider } = useConfigStore();
  const { selectedModel, setSelectedModel } = useTeamStore();

  // Fetch providers with their models
  const { data: providers, isLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: configApi.getProviders,
  });

  // Find current provider
  const currentProvider = providers?.find((p) => p.id === selectedProvider);

  // If provider changes, reset selected model
  const handleProviderChange = (model: string) => {
    setSelectedModel(model);
  };

  if (!selectedProvider) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label htmlFor="model">AI Model</Label>
        <div className="h-10 animate-pulse bg-muted rounded-md" />
      </div>
    );
  }

  if (!currentProvider || currentProvider.models.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="model">
        AI Model <span className="text-muted-foreground text-xs">(optional)</span>
      </Label>
      <Select value={selectedModel || undefined} onValueChange={handleProviderChange}>
        <SelectTrigger id="model">
          <SelectValue placeholder={`Select ${currentProvider.name} model`} />
        </SelectTrigger>
        <SelectContent>
          {currentProvider.models.map((model) => (
            <SelectItem key={model} value={model}>
              {model}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!selectedModel && (
        <p className="text-xs text-muted-foreground">
          If not selected, the default model for {currentProvider.name} will be used
        </p>
      )}
    </div>
  );
}

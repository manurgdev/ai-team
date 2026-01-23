import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Key, Check, Loader2 } from 'lucide-react';
import { configApi } from '../../lib/api/config';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export function ApiKeyManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const queryClient = useQueryClient();

  const { data: providers } = useQuery({
    queryKey: ['providers'],
    queryFn: configApi.getProviders,
  });

  const { data: apiKeys } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: configApi.getApiKeys,
  });

  const saveApiKeyMutation = useMutation({
    mutationFn: configApi.saveApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      setIsDialogOpen(false);
      setSelectedProvider('');
      setApiKey('');
      toast.success('API key saved successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to save API key');
    },
  });

  const deleteApiKeyMutation = useMutation({
    mutationFn: configApi.deleteApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      toast.success('API key deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete API key');
    },
  });

  const validateApiKeyMutation = useMutation({
    mutationFn: ({ provider, apiKey }: { provider: string; apiKey: string }) =>
      configApi.validateApiKey(provider, apiKey),
    onSuccess: (isValid) => {
      if (isValid) {
        toast.success('API key is valid! You can now save it.');
      } else {
        toast.error('API key validation failed. Please check your key.');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to validate API key');
    },
  });

  const handleTestConnection = async () => {
    if (!selectedProvider || !apiKey) {
      toast.error('Please select a provider and enter an API key');
      return;
    }

    validateApiKeyMutation.mutate({ provider: selectedProvider, apiKey });
  };

  const handleSave = async () => {
    if (!selectedProvider || !apiKey) {
      toast.error('Please select a provider and enter an API key');
      return;
    }

    saveApiKeyMutation.mutate({ provider: selectedProvider, apiKey });
  };

  const handleDelete = async (provider: string) => {
    if (confirm('Are you sure you want to delete this API key?')) {
      deleteApiKeyMutation.mutate(provider);
    }
  };

  const getProviderName = (providerId: string) => {
    return providers?.find((p) => p.id === providerId)?.name || providerId;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">API Keys</h2>
          <p className="text-muted-foreground">
            Manage your AI provider API keys
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add API Key</DialogTitle>
              <DialogDescription>
                Add or update an API key for an AI provider
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers?.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name} - {provider.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Your API key will be encrypted and stored securely
                </p>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={validateApiKeyMutation.isPending || !selectedProvider || !apiKey}
                className="sm:mr-auto"
              >
                {validateApiKeyMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saveApiKeyMutation.isPending}
                >
                  {saveApiKeyMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {apiKeys && apiKeys.length > 0 ? (
          apiKeys.map((key) => (
            <Card key={key.id}>
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Key className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{getProviderName(key.provider)}</p>
                    <p className="text-sm text-muted-foreground">
                      Added {new Date(key.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {key.isActive && (
                    <div className="flex items-center gap-1 text-green-600">
                      <Check className="h-4 w-4" />
                      <span className="text-sm">Active</span>
                    </div>
                  )}
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(key.provider)}
                  disabled={deleteApiKeyMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No API Keys</CardTitle>
              <CardDescription>
                Add an API key to start using AI agents
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Settings, Github, Key, Plus, Trash2, Loader2, Check, X } from 'lucide-react';
import { configApi } from '../../lib/api/config';
import { githubApi } from '../../lib/api/github';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

export function SettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  // API Keys state
  const [isAddingApiKey, setIsAddingApiKey] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [apiKey, setApiKey] = useState('');

  // GitHub Token state
  const [githubToken, setGithubToken] = useState('');
  const [isValidatingGitHub, setIsValidatingGitHub] = useState(false);

  // Fetch providers
  const { data: providers } = useQuery({
    queryKey: ['providers'],
    queryFn: configApi.getProviders,
  });

  // Fetch API keys
  const { data: apiKeys } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: configApi.getApiKeys,
  });

  // Fetch GitHub token info
  const { data: githubTokenInfo, isLoading: isLoadingGitHub } = useQuery({
    queryKey: ['githubToken'],
    queryFn: githubApi.getTokenInfo,
  });

  // Save API Key mutation
  const saveApiKeyMutation = useMutation({
    mutationFn: configApi.saveApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      setIsAddingApiKey(false);
      setSelectedProvider('');
      setApiKey('');
      toast.success('API key saved successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to save API key');
    },
  });

  // Delete API Key mutation
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

  // Validate API Key mutation
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

  // Save GitHub Token mutation
  const saveGitHubTokenMutation = useMutation({
    mutationFn: githubApi.saveToken,
    onSuccess: (response: { message: string; token: { githubUsername: string | null } }) => {
      queryClient.invalidateQueries({ queryKey: ['githubToken'] });
      setGithubToken('');
      toast.success(`GitHub token saved! Connected as ${response.token.githubUsername}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to save GitHub token');
    },
  });

  // Delete GitHub Token mutation
  const deleteGitHubTokenMutation = useMutation({
    mutationFn: githubApi.deleteToken,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['githubToken'] });
      toast.success('GitHub token deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete GitHub token');
    },
  });

  // Handlers
  const handleTestApiKey = async () => {
    if (!selectedProvider || !apiKey) {
      toast.error('Please select a provider and enter an API key');
      return;
    }
    validateApiKeyMutation.mutate({ provider: selectedProvider, apiKey });
  };

  const handleSaveApiKey = async () => {
    if (!selectedProvider || !apiKey) {
      toast.error('Please select a provider and enter an API key');
      return;
    }
    saveApiKeyMutation.mutate({ provider: selectedProvider, apiKey });
  };

  const handleValidateGitHub = async () => {
    if (!githubToken) {
      toast.error('Please enter a GitHub token');
      return;
    }

    setIsValidatingGitHub(true);
    try {
      const result = await githubApi.validateToken(githubToken);

      if (result.isValid) {
        toast.success(`Token is valid! Connected as ${result.username}`);
      } else {
        toast.error('Token validation failed. Please check your token.');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to validate token');
    } finally {
      setIsValidatingGitHub(false);
    }
  };

  const handleSaveGitHub = () => {
    if (!githubToken) {
      toast.error('Please enter a GitHub token');
      return;
    }
    saveGitHubTokenMutation.mutate({ token: githubToken });
  };

  const handleDeleteGitHub = () => {
    if (confirm('Are you sure you want to delete your GitHub token?')) {
      deleteGitHubTokenMutation.mutate();
    }
  };

  const getProviderName = (provider: string) => {
    const names: Record<string, string> = {
      anthropic: 'Anthropic (Claude)',
      openai: 'OpenAI (GPT)',
      google: 'Google (Gemini)',
    };
    return names[provider] || provider;
  };

  const hasConfigured = (apiKeys?.length || 0) > 0 || githubTokenInfo?.hasToken;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          title="Settings"
        >
          <Settings className="h-5 w-5" />
          {hasConfigured && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-green-500 ring-2 ring-background" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuration</DialogTitle>
          <DialogDescription>
            Manage your AI provider API keys and GitHub integration
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="api-keys" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="api-keys" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              AI Providers
            </TabsTrigger>
            <TabsTrigger value="github" className="flex items-center gap-2">
              <Github className="h-4 w-4" />
              GitHub
            </TabsTrigger>
          </TabsList>

          <TabsContent value="api-keys" className="space-y-4 mt-4">
            {/* Existing API Keys */}
            <div className="space-y-3">
              {apiKeys && apiKeys.length > 0 ? (
                <div className="space-y-2">
                  {apiKeys.map((key) => (
                    <Card key={key.id}>
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <Key className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{getProviderName(key.provider)}</p>
                            <p className="text-xs text-muted-foreground">
                              Added {new Date(key.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteApiKeyMutation.mutate(key.provider)}
                          disabled={deleteApiKeyMutation.isPending}
                        >
                          {deleteApiKeyMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No API keys configured yet
                </p>
              )}
            </div>

            {/* Add New API Key */}
            {!isAddingApiKey ? (
              <Button
                onClick={() => setIsAddingApiKey(true)}
                className="w-full"
                variant="outline"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add API Key
              </Button>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Add New API Key</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="provider">Provider</Label>
                    <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                      <SelectTrigger id="provider">
                        <SelectValue placeholder="Select a provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {providers?.map((provider) => (
                          <SelectItem key={provider.id} value={provider.id}>
                            {provider.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="api-key">API Key</Label>
                    <Input
                      id="api-key"
                      type="password"
                      placeholder="Enter your API key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleTestApiKey}
                      disabled={validateApiKeyMutation.isPending || !selectedProvider || !apiKey}
                      className="flex-1"
                    >
                      {validateApiKeyMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Testing
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Test Connection
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleSaveApiKey}
                      disabled={saveApiKeyMutation.isPending || !selectedProvider || !apiKey}
                      className="flex-1"
                    >
                      {saveApiKeyMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving
                        </>
                      ) : (
                        'Save'
                      )}
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsAddingApiKey(false);
                      setSelectedProvider('');
                      setApiKey('');
                    }}
                    className="w-full"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="github" className="space-y-4 mt-4">
            {isLoadingGitHub ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : githubTokenInfo?.hasToken ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">GitHub Integration</CardTitle>
                  <CardDescription>Your GitHub token is configured</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm">
                      <span className="text-muted-foreground">Connected as: </span>
                      <span className="font-medium">{githubTokenInfo.token?.githubUsername}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Added: {new Date(githubTokenInfo.token?.createdAt || '').toLocaleDateString()}
                    </p>
                  </div>

                  <Button
                    variant="destructive"
                    onClick={handleDeleteGitHub}
                    disabled={deleteGitHubTokenMutation.isPending}
                    className="w-full"
                  >
                    {deleteGitHubTokenMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Token
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Add GitHub Token</CardTitle>
                  <CardDescription>
                    Connect your GitHub account to export task results
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="github-token">GitHub Personal Access Token</Label>
                    <Input
                      id="github-token"
                      type="password"
                      placeholder="ghp_..."
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      <a
                        href="https://github.com/settings/tokens/new?scopes=repo"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        Create a new token
                      </a>{' '}
                      with "repo" scope
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleValidateGitHub}
                      disabled={isValidatingGitHub || !githubToken}
                      className="flex-1"
                    >
                      {isValidatingGitHub ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Validating
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Validate
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleSaveGitHub}
                      disabled={saveGitHubTokenMutation.isPending || !githubToken}
                      className="flex-1"
                    >
                      {saveGitHubTokenMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving
                        </>
                      ) : (
                        'Save'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

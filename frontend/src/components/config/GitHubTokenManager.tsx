import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Github, Trash2, Loader2, Check } from 'lucide-react';
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

export function GitHubTokenManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [token, setToken] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const queryClient = useQueryClient();

  const { data: tokenInfo, isLoading } = useQuery({
    queryKey: ['githubToken'],
    queryFn: githubApi.getTokenInfo,
  });

  const saveTokenMutation = useMutation({
    mutationFn: githubApi.saveToken,
    onSuccess: (response: { message: string; token: { githubUsername: string | null } }) => {
      queryClient.invalidateQueries({ queryKey: ['githubToken'] });
      setIsDialogOpen(false);
      setToken('');
      toast.success(`GitHub token saved! Connected as ${response.token.githubUsername}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to save GitHub token');
    },
  });

  const deleteTokenMutation = useMutation({
    mutationFn: githubApi.deleteToken,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['githubToken'] });
      toast.success('GitHub token deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete GitHub token');
    },
  });

  const handleValidate = async () => {
    if (!token) {
      toast.error('Please enter a GitHub token');
      return;
    }

    setIsValidating(true);
    try {
      const result = await githubApi.validateToken(token);

      if (result.isValid) {
        toast.success(`Token is valid! Connected as ${result.username}`);
      } else {
        toast.error('Token validation failed. Please check your token.');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to validate token');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = () => {
    if (!token) {
      toast.error('Please enter a GitHub token');
      return;
    }

    saveTokenMutation.mutate({ token });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete your GitHub token?')) {
      deleteTokenMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          title={tokenInfo?.hasToken ? `GitHub: ${tokenInfo.token?.githubUsername}` : 'Configure GitHub'}
        >
          <Github className="h-5 w-5" />
          {tokenInfo?.hasToken && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-green-500 ring-2 ring-background" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>GitHub Integration</DialogTitle>
          <DialogDescription>
            {tokenInfo?.hasToken
              ? 'Manage your GitHub Personal Access Token'
              : 'Add your GitHub Personal Access Token to enable repository exports'}
          </DialogDescription>
        </DialogHeader>

        {tokenInfo?.hasToken ? (
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm">
                <span className="text-muted-foreground">Connected as: </span>
                <span className="font-medium">{tokenInfo.token?.githubUsername}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Added: {new Date(tokenInfo.token?.createdAt || '').toLocaleDateString()}
              </p>
            </div>

            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteTokenMutation.isPending}
              className="w-full"
            >
              {deleteTokenMutation.isPending ? (
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
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="github-token">GitHub Token</Label>
                <Input
                  id="github-token"
                  type="password"
                  placeholder="ghp_..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
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
              <Button
                variant="outline"
                onClick={handleValidate}
                disabled={isValidating || !token}
                className="w-full"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Validate Token
                  </>
                )}
              </Button>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setToken('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saveTokenMutation.isPending || !token}
              >
                {saveTokenMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Token'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

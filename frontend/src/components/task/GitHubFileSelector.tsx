import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Loader2, Folder, File, ChevronRight, ChevronDown, AlertTriangle, XCircle } from 'lucide-react';
import { githubApi } from '../../lib/api/github';
import { GitHubRepository, GitHubTreeNode, GitHubContextSelection } from '../../lib/types/github.types';

interface GitHubFileSelectorProps {
  onContextChange: (context: GitHubContextSelection | null) => void;
}

const MAX_TOKENS = 2000;
const WARNING_THRESHOLD = MAX_TOKENS * 0.8;

export function GitHubFileSelector({ onContextChange }: GitHubFileSelectorProps) {
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(null);
  const [branch, setBranch] = useState('main');
  const [fileTree, setFileTree] = useState<GitHubTreeNode[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalTokens, setTotalTokens] = useState(0);

  // Load repositories on mount
  useEffect(() => {
    loadRepositories();
  }, []);

  const loadRepositories = async () => {
    try {
      setLoading(true);
      setError(null);
      const repos = await githubApi.listRepositories();
      setRepositories(repos);
    } catch (err: any) {
      setError(err.message || 'Failed to load repositories');
    } finally {
      setLoading(false);
    }
  };

  const loadFileTree = async () => {
    if (!selectedRepo) return;

    try {
      setLoading(true);
      setError(null);
      const tree = await githubApi.getFileTree(
        selectedRepo.full_name.split('/')[0],
        selectedRepo.full_name.split('/')[1],
        branch,
        ''
      );

      // Build tree structure
      const treeNodes = buildTreeStructure(tree);
      setFileTree(treeNodes);
    } catch (err: any) {
      setError(err.message || 'Failed to load file tree');
    } finally {
      setLoading(false);
    }
  };

  const buildTreeStructure = (items: any[]): GitHubTreeNode[] => {
    return items.map(item => ({
      path: item.path,
      type: item.type,
      size: item.size,
      sha: item.sha,
      expanded: false,
      selected: false,
      children: item.type === 'dir' ? [] : undefined,
    }));
  };

  const toggleFileSelection = (path: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelectedFiles(newSelected);
    updateContext(newSelected);
  };

  const updateContext = async (selected: Set<string>) => {
    if (selected.size === 0 || !selectedRepo) {
      onContextChange(null);
      setTotalTokens(0);
      return;
    }

    try {
      setLoading(true);
      const [owner, repo] = selectedRepo.full_name.split('/');
      const files = await githubApi.getMultipleFiles(
        owner,
        repo,
        Array.from(selected),
        branch
      );

      const filesWithMeta = files.map(file => ({
        path: file.path,
        content: file.content,
        size: file.size,
        tokens: estimateTokens(file.content),
        language: detectLanguage(file.path),
      }));

      const total = filesWithMeta.reduce((sum, f) => sum + f.tokens, 0);
      setTotalTokens(total);

      onContextChange({
        repository: selectedRepo,
        branch,
        selectedFiles: filesWithMeta,
        totalTokens: total,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load file contents');
    } finally {
      setLoading(false);
    }
  };

  const estimateTokens = (text: string): number => {
    return Math.ceil(text.length / 3.5);
  };

  const detectLanguage = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'rb': 'ruby',
      'php': 'php',
      'md': 'markdown',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'css': 'css',
      'html': 'html',
    };
    return languageMap[ext || ''] || 'plaintext';
  };

  const shouldExcludeFile = (path: string): boolean => {
    const secretPatterns = ['.env', 'credentials.json', 'private-key', '.pem', '.key'];
    const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.zip', '.exe', '.ico'];
    const lowerPath = path.toLowerCase();

    return secretPatterns.some(pattern => lowerPath.includes(pattern)) ||
           binaryExtensions.some(ext => lowerPath.endsWith(ext));
  };

  const toggleExpand = async (node: GitHubTreeNode) => {
    if (node.type !== 'dir') return;

    const updateTree = (nodes: GitHubTreeNode[]): GitHubTreeNode[] => {
      return nodes.map(n => {
        if (n.path === node.path) {
          return { ...n, expanded: !n.expanded };
        }
        if (n.children) {
          return { ...n, children: updateTree(n.children) };
        }
        return n;
      });
    };

    if (!node.expanded && (!node.children || node.children.length === 0)) {
      // Load children
      try {
        const [owner, repo] = selectedRepo!.full_name.split('/');
        const children = await githubApi.getFileTree(owner, repo, branch, node.path);
        const childNodes = buildTreeStructure(children);

        const updateTreeWithChildren = (nodes: GitHubTreeNode[]): GitHubTreeNode[] => {
          return nodes.map(n => {
            if (n.path === node.path) {
              return { ...n, expanded: true, children: childNodes };
            }
            if (n.children) {
              return { ...n, children: updateTreeWithChildren(n.children) };
            }
            return n;
          });
        };

        setFileTree(updateTreeWithChildren(fileTree));
      } catch (err: any) {
        setError(err.message || 'Failed to load directory');
      }
    } else {
      setFileTree(updateTree(fileTree));
    }
  };

  const renderTree = (nodes: GitHubTreeNode[], depth: number = 0): JSX.Element[] => {
    return nodes.map(node => {
      const isExcluded = node.type === 'file' && shouldExcludeFile(node.path);
      const isSelected = selectedFiles.has(node.path);

      return (
        <div key={node.path} style={{ marginLeft: depth * 16 }}>
          <div className="flex items-center gap-2 py-1 hover:bg-gray-50 rounded">
            {node.type === 'dir' && (
              <button
                onClick={() => toggleExpand(node)}
                className="p-0.5 hover:bg-gray-200 rounded"
              >
                {node.expanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            )}

            {node.type === 'file' && (
              <input
                type="checkbox"
                checked={isSelected}
                disabled={isExcluded}
                onChange={() => !isExcluded && toggleFileSelection(node.path)}
                className="ml-5"
              />
            )}

            {node.type === 'dir' ? (
              <Folder className="w-4 h-4 text-blue-500" />
            ) : (
              <File className="w-4 h-4 text-gray-500" />
            )}

            <span className={isExcluded ? 'text-gray-400' : ''}>
              {node.path.split('/').pop()}
            </span>

            {isExcluded && (
              <span className="text-xs text-gray-400">(excluded)</span>
            )}
          </div>

          {node.expanded && node.children && renderTree(node.children, depth + 1)}
        </div>
      );
    });
  };

  const getTokenWarningColor = (): string => {
    if (totalTokens > MAX_TOKENS) return 'text-red-600';
    if (totalTokens > WARNING_THRESHOLD) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getTokenWarningMessage = (): string | null => {
    if (totalTokens > MAX_TOKENS) {
      return `Token limit exceeded by ${totalTokens - MAX_TOKENS} tokens. Some files may be skipped.`;
    }
    if (totalTokens > WARNING_THRESHOLD) {
      return `Approaching token limit. ${MAX_TOKENS - totalTokens} tokens remaining.`;
    }
    return null;
  };

  const clearSelection = () => {
    setSelectedFiles(new Set());
    setTotalTokens(0);
    onContextChange(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>GitHub Repository Context (Optional)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Repository</Label>
            <Select
              value={selectedRepo?.full_name}
              onValueChange={(value) => {
                const repo = repositories.find(r => r.full_name === value);
                setSelectedRepo(repo || null);
                setFileTree([]);
                setSelectedFiles(new Set());
                setTotalTokens(0);
                if (repo) {
                  setBranch(repo.default_branch || 'main');
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select repository" />
              </SelectTrigger>
              <SelectContent>
                {repositories.map(repo => (
                  <SelectItem key={repo.id} value={repo.full_name}>
                    {repo.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Branch</Label>
            <Input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
            />
          </div>
        </div>

        {selectedRepo && (
          <Button onClick={loadFileTree} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load Files'
            )}
          </Button>
        )}

        {fileTree.length > 0 && (
          <>
            <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
              {renderTree(fileTree)}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-semibold ${getTokenWarningColor()}`}>
                  Selected: {selectedFiles.size} files (~{totalTokens} tokens / {MAX_TOKENS})
                </p>
                {getTokenWarningMessage() && (
                  <p className="text-xs text-gray-600">{getTokenWarningMessage()}</p>
                )}
              </div>

              {selectedFiles.size > 0 && (
                <Button onClick={clearSelection} variant="outline" size="sm">
                  <XCircle className="mr-2 h-4 w-4" />
                  Clear Selection
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  default_branch: string;
}

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

export interface ExportToGitHubDto {
  taskId: string;
  githubToken?: string; // Optional - uses stored token if not provided
  owner: string;
  repo: string;
  baseBranch?: string;
  branchName?: string;
  updateExisting?: boolean; // If true, update existing branch instead of creating new
  pullRequestUrl?: string; // PR URL to reference in export record
}

export interface ExportResult {
  pullRequestUrl: string;
  branchName: string;
}

export interface ExportPreviewFile {
  path: string;
  status: 'new' | 'modified' | 'unchanged';
  oldContent: string | null;
  newContent: string;
  language: string;
}

export interface ExportPreview {
  files: ExportPreviewFile[];
  totalFiles: number;
}

export interface Export {
  id: string;
  userId: string;
  taskId: string;
  repositoryUrl: string;
  branchName: string;
  pullRequestUrl: string | null;
  status: 'pending' | 'completed' | 'error';
  error: string | null;
  createdAt: string;
  task?: {
    title: string;
    description: string;
  };
}

export interface GitHubTokenInfo {
  id: string;
  githubUsername: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubTokenResponse {
  hasToken: boolean;
  token?: GitHubTokenInfo;
}

export interface SaveTokenDto {
  token: string;
}

export interface ValidateTokenResponse {
  isValid: boolean;
  username?: string;
}

// File selector types
export interface GitHubTreeNode {
  path: string;
  type: 'file' | 'dir';
  size?: number;
  sha: string;
  children?: GitHubTreeNode[];
  expanded?: boolean;
  selected?: boolean;
  tokens?: number;
}

export interface GitHubFileContent {
  path: string;
  content: string;
  sha: string;
  size: number;
  encoding: string;
}

export interface GitHubContextSelection {
  repository: GitHubRepository;
  branch: string;
  selectedFiles: Array<{
    path: string;
    content: string;
    size: number;
    tokens: number;
    language: string;
  }>;
  totalTokens: number;
}

export interface GitHubCheckRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
  started_at: string;
  completed_at: string | null;
  html_url: string;
  output: {
    title: string | null;
    summary: string | null;
    text: string | null;
  };
}

export interface GitHubChecksResponse {
  total_count: number;
  check_runs: GitHubCheckRun[];
}

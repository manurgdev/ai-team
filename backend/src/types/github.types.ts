export interface GitHubFileTreeItem {
  path: string;
  type: 'file' | 'dir';
  size?: number;
  sha: string;
}

export interface GitHubFileContent {
  path: string;
  content: string;
  sha: string;
  size: number;
  encoding: string;
}

export interface GitHubContextSelection {
  repository: {
    owner: string;
    repo: string;
    fullName: string;
  };
  branch: string;
  selectedFiles: Array<{
    path: string;
    content: string;
    size: number;
    tokens: number;
    language: string;
  }>;
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

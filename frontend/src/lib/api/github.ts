import apiClient from './client';
import {
  GitHubRepository,
  GitHubUser,
  ExportToGitHubDto,
  ExportResult,
  ExportPreview,
  Export,
  GitHubTokenInfo,
  GitHubTokenResponse,
  SaveTokenDto,
  ValidateTokenResponse,
  GitHubTreeNode,
  GitHubFileContent,
  GitHubChecksResponse,
} from '../types/github.types';

export const githubApi = {
  /**
   * List user's GitHub repositories
   * Optionally requires GitHub token in headers (uses stored token if not provided)
   */
  listRepositories: async (githubToken?: string): Promise<GitHubRepository[]> => {
    const response = await apiClient.get<GitHubRepository[]>('/github/repositories', {
      headers: githubToken ? {
        'x-github-token': githubToken,
      } : {},
    });
    return response.data;
  },

  /**
   * Get authenticated GitHub user info
   * Optionally requires GitHub token in headers (uses stored token if not provided)
   */
  getAuthenticatedUser: async (githubToken?: string): Promise<GitHubUser> => {
    const response = await apiClient.get<GitHubUser>('/github/user', {
      headers: githubToken ? {
        'x-github-token': githubToken,
      } : {},
    });
    return response.data;
  },

  /**
   * Get file tree from repository
   */
  getFileTree: async (
    owner: string,
    repo: string,
    branch: string = 'main',
    path: string = ''
  ): Promise<GitHubTreeNode[]> => {
    const response = await apiClient.get<GitHubTreeNode[]>('/github/tree', {
      params: { owner, repo, branch, path },
    });
    return response.data;
  },

  /**
   * Get multiple files content
   */
  getMultipleFiles: async (
    owner: string,
    repo: string,
    paths: string[],
    ref: string = 'main'
  ): Promise<GitHubFileContent[]> => {
    const response = await apiClient.post<GitHubFileContent[]>('/github/files', {
      owner,
      repo,
      paths,
      ref,
    });
    return response.data;
  },

  /**
   * Generate preview of export changes without committing
   */
  previewExport: async (
    taskId: string,
    owner: string,
    repo: string,
    branch?: string
  ): Promise<ExportPreview> => {
    const response = await apiClient.post<ExportPreview>('/github/export/preview', {
      taskId,
      owner,
      repo,
      branch,
    });
    return response.data;
  },

  /**
   * Export task results to GitHub as Pull Request
   */
  exportToGitHub: async (data: ExportToGitHubDto): Promise<ExportResult> => {
    const response = await apiClient.post<ExportResult>('/github/export', data);
    return response.data;
  },

  /**
   * Get export history for authenticated user
   */
  getExportHistory: async (limit?: number): Promise<Export[]> => {
    const response = await apiClient.get<Export[]>('/github/exports', {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Get exports for a specific task
   */
  getTaskExports: async (taskId: string): Promise<Export[]> => {
    const response = await apiClient.get<Export[]>(`/github/exports/task/${taskId}`);
    return response.data;
  },

  /**
   * Save GitHub token for authenticated user
   */
  saveToken: async (data: SaveTokenDto): Promise<{ message: string; token: GitHubTokenInfo }> => {
    const response = await apiClient.post<{ message: string; token: GitHubTokenInfo }>('/github/token', data);
    return response.data;
  },

  /**
   * Get GitHub token info for authenticated user
   */
  getTokenInfo: async (): Promise<GitHubTokenResponse> => {
    const response = await apiClient.get<GitHubTokenResponse>('/github/token');
    return response.data;
  },

  /**
   * Delete GitHub token for authenticated user
   */
  deleteToken: async (): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>('/github/token');
    return response.data;
  },

  /**
   * Validate GitHub token
   */
  validateToken: async (token: string): Promise<ValidateTokenResponse> => {
    const response = await apiClient.post<ValidateTokenResponse>('/github/token/validate', { token });
    return response.data;
  },

  /**
   * Get Pull Request checks/CI status
   */
  getPullRequestChecks: async (
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<GitHubChecksResponse> => {
    const response = await apiClient.get<GitHubChecksResponse>(
      `/github/pulls/${owner}/${repo}/${pullNumber}/checks`
    );
    return response.data;
  },
};

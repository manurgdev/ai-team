import { Octokit } from '@octokit/rest';

export interface GitHubToolContext {
  githubToken: string;
  owner: string;
  repo: string;
  branch: string;
}

export interface GitHubFileResult {
  path: string;
  content: string;
  size: number;
}

export interface GitHubDirectoryItem {
  path: string;
  type: 'file' | 'dir';
  size?: number;
}

export interface GitHubSearchResult {
  path: string;
  matches?: string[];
}

/**
 * Service that provides GitHub repository tools for AI agents
 * Agents can use these tools via function calling to explore and read files
 */
export class GitHubToolsService {
  private octokit: Octokit;
  private context: GitHubToolContext;
  private fileCache: Map<string, string> = new Map();

  constructor(context: GitHubToolContext) {
    this.context = context;
    this.octokit = new Octokit({ auth: context.githubToken });
  }

  /**
   * Get the content of a specific file from the repository
   */
  async getFile(path: string): Promise<GitHubFileResult> {
    console.log(`[GitHubTools] Getting file: ${path}`);

    // Check cache first
    const cacheKey = `${this.context.owner}/${this.context.repo}/${this.context.branch}/${path}`;
    if (this.fileCache.has(cacheKey)) {
      const cachedContent = this.fileCache.get(cacheKey)!;
      console.log(`[GitHubTools] Cache hit for: ${path}`);
      return {
        path,
        content: cachedContent,
        size: cachedContent.length,
      };
    }

    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.context.owner,
        repo: this.context.repo,
        path,
        ref: this.context.branch,
      });

      if (Array.isArray(data) || data.type !== 'file') {
        throw new Error(`Path ${path} is not a file`);
      }

      const content = Buffer.from(data.content, 'base64').toString('utf-8');

      // Cache the content
      this.fileCache.set(cacheKey, content);

      return {
        path: data.path,
        content,
        size: data.size,
      };
    } catch (error: any) {
      console.error(`[GitHubTools] Error getting file ${path}:`, error.message);
      throw new Error(`Failed to get file ${path}: ${error.message}`);
    }
  }

  /**
   * List files and directories at a specific path
   */
  async listDirectory(path: string = ''): Promise<GitHubDirectoryItem[]> {
    console.log(`[GitHubTools] Listing directory: ${path || '/'}`);

    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.context.owner,
        repo: this.context.repo,
        path,
        ref: this.context.branch,
      });

      if (!Array.isArray(data)) {
        throw new Error(`Path ${path} is not a directory`);
      }

      return data.map(item => ({
        path: item.path,
        type: item.type === 'dir' ? 'dir' : 'file',
        size: item.size,
      }));
    } catch (error: any) {
      console.error(`[GitHubTools] Error listing directory ${path}:`, error.message);
      throw new Error(`Failed to list directory ${path}: ${error.message}`);
    }
  }

  /**
   * Search for files or content in the repository
   */
  async search(query: string, type: 'filename' | 'content' = 'filename'): Promise<GitHubSearchResult[]> {
    console.log(`[GitHubTools] Searching (${type}): ${query}`);

    try {
      if (type === 'filename') {
        const { data } = await this.octokit.search.code({
          q: `filename:${query} repo:${this.context.owner}/${this.context.repo}`,
        });

        return data.items.map(item => ({
          path: item.path,
        }));
      } else {
        const { data } = await this.octokit.search.code({
          q: `${query} repo:${this.context.owner}/${this.context.repo}`,
        });

        return data.items.map(item => ({
          path: item.path,
          matches: item.text_matches?.map(m => m.fragment) || [],
        }));
      }
    } catch (error: any) {
      console.error(`[GitHubTools] Error searching:`, error.message);
      throw new Error(`Failed to search: ${error.message}`);
    }
  }

  /**
   * Get common configuration files from the repository
   */
  async getConfigFiles(): Promise<GitHubFileResult[]> {
    console.log(`[GitHubTools] Getting config files`);

    const configPaths = [
      'package.json',
      'tsconfig.json',
      '.eslintrc',
      '.eslintrc.json',
      '.eslintrc.js',
      'eslint.config.js',
      '.prettierrc',
      '.prettierrc.json',
      'prettier.config.js',
      'vite.config.ts',
      'vite.config.js',
      'next.config.js',
      'tailwind.config.js',
      'tailwind.config.ts',
    ];

    const results: GitHubFileResult[] = [];

    for (const path of configPaths) {
      try {
        const file = await this.getFile(path);
        results.push(file);
      } catch (error) {
        // Config file doesn't exist, skip silently
        continue;
      }
    }

    console.log(`[GitHubTools] Found ${results.length} config files`);
    return results;
  }

  /**
   * Get multiple files at once
   */
  async getMultipleFiles(paths: string[]): Promise<GitHubFileResult[]> {
    console.log(`[GitHubTools] Getting ${paths.length} files`);

    const results: GitHubFileResult[] = [];

    for (const path of paths) {
      try {
        const file = await this.getFile(path);
        results.push(file);
      } catch (error: any) {
        console.warn(`[GitHubTools] Failed to get file ${path}:`, error.message);
        // Continue with other files
      }
    }

    return results;
  }

  /**
   * Clear the file cache
   */
  clearCache() {
    this.fileCache.clear();
    console.log(`[GitHubTools] Cache cleared`);
  }
}

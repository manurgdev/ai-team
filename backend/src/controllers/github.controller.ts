import { Request, Response } from 'express';
import { GitHubService } from '../services/github.service';
import { GitHubTokenService } from '../services/github-token.service';

export class GitHubController {
  private githubTokenService: GitHubTokenService;

  constructor() {
    this.githubTokenService = new GitHubTokenService();
  }
  /**
   * List user's GitHub repositories
   * GET /api/github/repositories
   */
  async listRepositories(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;

      // Try header first (for backwards compatibility), then stored token
      let githubToken = req.headers['x-github-token'] as string;

      if (!githubToken) {
        // Try to get stored token
        const storedToken = await this.githubTokenService.getDecryptedToken(userId);

        if (!storedToken) {
          res.status(400).json({ error: 'GitHub token is required. Please configure your GitHub token.' });
          return;
        }

        githubToken = storedToken;
      }

      const githubService = new GitHubService();
      const repositories = await githubService.listRepositories(githubToken);

      res.json(repositories);
    } catch (error: any) {
      console.error('List repositories error:', error);
      res.status(500).json({ error: error.message || 'Failed to list repositories' });
    }
  }

  /**
   * Get authenticated GitHub user
   * GET /api/github/user
   */
  async getAuthenticatedUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;

      // Try header first (for backwards compatibility), then stored token
      let githubToken = req.headers['x-github-token'] as string;

      if (!githubToken) {
        // Try to get stored token
        const storedToken = await this.githubTokenService.getDecryptedToken(userId);

        if (!storedToken) {
          res.status(400).json({ error: 'GitHub token is required. Please configure your GitHub token.' });
          return;
        }

        githubToken = storedToken;
      }

      const githubService = new GitHubService();
      const user = await githubService.getAuthenticatedUser(githubToken);

      res.json(user);
    } catch (error: any) {
      console.error('Get GitHub user error:', error);
      res.status(500).json({ error: error.message || 'Failed to get user info' });
    }
  }

  /**
   * Get file tree from repository
   * GET /api/github/tree?owner=x&repo=y&branch=main&path=src
   */
  async getFileTree(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const { owner, repo, branch = 'main', path = '' } = req.query;

      if (!owner || !repo) {
        res.status(400).json({ error: 'owner and repo are required' });
        return;
      }

      const githubToken = await this.githubTokenService.getDecryptedToken(userId);
      if (!githubToken) {
        res.status(400).json({ error: 'GitHub token is required' });
        return;
      }

      const githubService = new GitHubService();
      const tree = await githubService.getFileTree(
        githubToken,
        owner as string,
        repo as string,
        branch as string,
        path as string
      );

      res.json(tree);
    } catch (error: any) {
      console.error('Get file tree error:', error);
      res.status(500).json({ error: error.message || 'Failed to get file tree' });
    }
  }

  /**
   * Get multiple files content
   * POST /api/github/files
   * Body: { owner, repo, paths: string[], ref? }
   */
  async getMultipleFiles(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const { owner, repo, paths, ref = 'main' } = req.body;

      if (!owner || !repo || !paths || !Array.isArray(paths)) {
        res.status(400).json({ error: 'owner, repo, and paths array are required' });
        return;
      }

      const githubToken = await this.githubTokenService.getDecryptedToken(userId);
      if (!githubToken) {
        res.status(400).json({ error: 'GitHub token is required' });
        return;
      }

      const githubService = new GitHubService();
      const files = await githubService.getMultipleFiles(
        githubToken,
        owner,
        repo,
        paths,
        ref
      );

      res.json(files);
    } catch (error: any) {
      console.error('Get multiple files error:', error);
      res.status(500).json({ error: error.message || 'Failed to get files' });
    }
  }

  /**
   * Get Pull Request checks/CI status
   * GET /api/github/pulls/:owner/:repo/:pullNumber/checks
   */
  async getPullRequestChecks(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const { owner, repo, pullNumber } = req.params;

      if (!owner || !repo || !pullNumber) {
        res.status(400).json({ error: 'owner, repo, and pullNumber are required' });
        return;
      }

      const githubToken = await this.githubTokenService.getDecryptedToken(userId);
      if (!githubToken) {
        res.status(400).json({ error: 'GitHub token is required' });
        return;
      }

      const githubService = new GitHubService();
      const checks = await githubService.getPullRequestChecks(
        githubToken,
        owner,
        repo,
        parseInt(pullNumber, 10)
      );

      res.json(checks);
    } catch (error: any) {
      console.error('Get PR checks error:', error);
      res.status(500).json({ error: error.message || 'Failed to get PR checks' });
    }
  }

  /**
   * Generate preview of export changes without committing
   * POST /api/github/export/preview
   */
  async previewExport(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      let { taskId, owner, repo, branch } = req.body;

      // Get stored GitHub token
      const githubToken = await this.githubTokenService.getDecryptedToken(userId);
      if (!githubToken) {
        res.status(400).json({
          error: 'GitHub token is required. Please configure your GitHub token.',
        });
        return;
      }

      if (!taskId || !owner || !repo) {
        res.status(400).json({
          error: 'Missing required fields: taskId, owner, repo',
        });
        return;
      }

      const githubService = new GitHubService();
      const preview = await githubService.generateExportPreview(
        userId,
        taskId,
        githubToken,
        owner,
        repo,
        branch || 'main'
      );

      res.json(preview);
    } catch (error: any) {
      console.error('Preview export error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate preview' });
    }
  }

  /**
   * Export task results to GitHub
   * POST /api/github/export
   */
  async exportToGitHub(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      let { taskId, githubToken, owner, repo, baseBranch, branchName, updateExisting, pullRequestUrl } = req.body;

      // If no token provided, try to get stored token
      if (!githubToken) {
        const storedToken = await this.githubTokenService.getDecryptedToken(userId);

        if (!storedToken) {
          res.status(400).json({
            error: 'GitHub token is required. Please configure your GitHub token.',
          });
          return;
        }

        githubToken = storedToken;
      }

      if (!taskId || !owner || !repo) {
        res.status(400).json({
          error: 'Missing required fields: taskId, owner, repo',
        });
        return;
      }

      const githubService = new GitHubService();
      const result = await githubService.exportToGitHub(userId, {
        taskId,
        githubToken,
        owner,
        repo,
        baseBranch,
        branchName,
        updateExisting,
        pullRequestUrl,
      });

      res.json(result);
    } catch (error: any) {
      console.error('Export to GitHub error:', error);
      res.status(500).json({ error: error.message || 'Failed to export to GitHub' });
    }
  }

  /**
   * Get export history for user
   * GET /api/github/exports
   */
  async getExportHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const limit = parseInt(req.query.limit as string) || 10;

      const githubService = new GitHubService();
      const exports = await githubService.getExportHistory(userId, limit);

      res.json(exports);
    } catch (error: any) {
      console.error('Get export history error:', error);
      res.status(500).json({ error: error.message || 'Failed to get export history' });
    }
  }

  /**
   * Get exports for a specific task
   * GET /api/github/exports/task/:taskId
   */
  async getTaskExports(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const { taskId } = req.params;

      if (!taskId) {
        res.status(400).json({ error: 'taskId is required' });
        return;
      }

      const githubService = new GitHubService();
      const exports = await githubService.getTaskExports(userId, taskId);

      res.json(exports);
    } catch (error: any) {
      console.error('Get task exports error:', error);
      res.status(500).json({ error: error.message || 'Failed to get task exports' });
    }
  }

  /**
   * Save GitHub token for user
   * POST /api/github/token
   */
  async saveToken(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;
      const { token } = req.body;

      if (!token) {
        res.status(400).json({ error: 'GitHub token is required' });
        return;
      }

      const tokenInfo = await this.githubTokenService.saveToken(userId, token);

      res.json({
        message: 'GitHub token saved successfully',
        token: tokenInfo,
      });
    } catch (error: any) {
      console.error('Save GitHub token error:', error);
      res.status(500).json({ error: error.message || 'Failed to save GitHub token' });
    }
  }

  /**
   * Get user's GitHub token info
   * GET /api/github/token
   */
  async getTokenInfo(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;

      const tokenInfo = await this.githubTokenService.getTokenInfo(userId);

      if (!tokenInfo) {
        res.json({ hasToken: false });
        return;
      }

      res.json({
        hasToken: true,
        token: tokenInfo,
      });
    } catch (error: any) {
      console.error('Get GitHub token info error:', error);
      res.status(500).json({ error: error.message || 'Failed to get token info' });
    }
  }

  /**
   * Delete GitHub token
   * DELETE /api/github/token
   */
  async deleteToken(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId;

      await this.githubTokenService.deleteToken(userId);

      res.json({ message: 'GitHub token deleted successfully' });
    } catch (error: any) {
      console.error('Delete GitHub token error:', error);
      res.status(500).json({ error: error.message || 'Failed to delete token' });
    }
  }

  /**
   * Validate GitHub token
   * POST /api/github/token/validate
   */
  async validateToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body;

      if (!token) {
        res.status(400).json({ error: 'GitHub token is required' });
        return;
      }

      const result = await this.githubTokenService.validateToken(token);

      res.json(result);
    } catch (error: any) {
      console.error('Validate GitHub token error:', error);
      res.status(500).json({ error: error.message || 'Failed to validate token' });
    }
  }
}

export const githubController = new GitHubController();

import { Router } from 'express';
import { githubController } from '../controllers/github.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// All GitHub routes require authentication
router.use(authMiddleware);

/**
 * GET /api/github/repositories
 * List user's GitHub repositories
 * Requires x-github-token header
 */
router.get('/repositories', (req, res) =>
  githubController.listRepositories(req, res)
);

/**
 * GET /api/github/user
 * Get authenticated GitHub user info
 * Requires x-github-token header
 */
router.get('/user', (req, res) =>
  githubController.getAuthenticatedUser(req, res)
);

/**
 * GET /api/github/tree
 * Get file tree from repository
 * Query: ?owner=x&repo=y&branch=main&path=src
 */
router.get('/tree', (req, res) => githubController.getFileTree(req, res));

/**
 * POST /api/github/files
 * Get multiple files content
 * Body: { owner, repo, paths: string[], ref? }
 */
router.post('/files', (req, res) => githubController.getMultipleFiles(req, res));

/**
 * GET /api/github/pulls/:owner/:repo/:pullNumber/checks
 * Get Pull Request checks/CI status
 */
router.get('/pulls/:owner/:repo/:pullNumber/checks', (req, res) =>
  githubController.getPullRequestChecks(req, res)
);

/**
 * POST /api/github/export/preview
 * Generate preview of export changes without committing
 * Body: { taskId, owner, repo, branch? }
 */
router.post('/export/preview', (req, res) =>
  githubController.previewExport(req, res)
);

/**
 * POST /api/github/export
 * Export task results to GitHub as Pull Request
 * Body: { taskId, githubToken, owner, repo, baseBranch?, branchName? }
 */
router.post('/export', (req, res) =>
  githubController.exportToGitHub(req, res)
);

/**
 * GET /api/github/exports
 * Get export history for authenticated user
 * Query: ?limit=10
 */
router.get('/exports', (req, res) =>
  githubController.getExportHistory(req, res)
);

/**
 * GET /api/github/exports/task/:taskId
 * Get exports for a specific task
 */
router.get('/exports/task/:taskId', (req, res) =>
  githubController.getTaskExports(req, res)
);

/**
 * POST /api/github/token
 * Save GitHub token for authenticated user
 * Body: { token }
 */
router.post('/token', (req, res) =>
  githubController.saveToken(req, res)
);

/**
 * GET /api/github/token
 * Get GitHub token info for authenticated user
 * Returns: { hasToken, token?: { id, githubUsername, isActive, createdAt, updatedAt } }
 */
router.get('/token', (req, res) =>
  githubController.getTokenInfo(req, res)
);

/**
 * DELETE /api/github/token
 * Delete GitHub token for authenticated user
 */
router.delete('/token', (req, res) =>
  githubController.deleteToken(req, res)
);

/**
 * POST /api/github/token/validate
 * Validate a GitHub token
 * Body: { token }
 */
router.post('/token/validate', (req, res) =>
  githubController.validateToken(req, res)
);

export default router;

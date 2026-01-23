import { Octokit } from '@octokit/rest';
import { prisma } from '../utils/prisma';
import { GitHubFileTreeItem, GitHubFileContent, GitHubChecksResponse } from '../types/github.types';

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  default_branch: string;
}

export interface ExportToGitHubDto {
  taskId: string;
  githubToken: string;
  owner: string;
  repo: string;
  baseBranch?: string;
  branchName?: string;
  updateExisting?: boolean; // If true, update existing branch instead of creating new one
  pullRequestUrl?: string; // PR URL to reference in export record
}

export class GitHubService {
  /**
   * List user's GitHub repositories
   */
  async listRepositories(githubToken: string): Promise<GitHubRepository[]> {
    const octokit = new Octokit({ auth: githubToken });

    try {
      const { data } = await octokit.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 100,
      });

      return data.map((repo) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
        html_url: repo.html_url,
        default_branch: repo.default_branch || 'main',
      }));
    } catch (error: any) {
      console.error('GitHub list repos error:', error.message);
      throw new Error('Failed to fetch GitHub repositories. Check your token.');
    }
  }

  /**
   * Get authenticated user info
   */
  async getAuthenticatedUser(githubToken: string) {
    const octokit = new Octokit({ auth: githubToken });

    try {
      const { data } = await octokit.users.getAuthenticated();
      return {
        login: data.login,
        name: data.name,
        avatar_url: data.avatar_url,
      };
    } catch (error: any) {
      console.error('GitHub get user error:', error.message);
      throw new Error('Failed to authenticate with GitHub. Check your token.');
    }
  }

  /**
   * Get file tree from repository
   */
  async getFileTree(
    githubToken: string,
    owner: string,
    repo: string,
    branch: string = 'main',
    path: string = ''
  ): Promise<GitHubFileTreeItem[]> {
    const octokit = new Octokit({ auth: githubToken });

    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });

      if (Array.isArray(data)) {
        return data.map(item => ({
          path: item.path,
          type: item.type === 'dir' ? 'dir' : 'file',
          size: item.size,
          sha: item.sha,
        }));
      }

      return [{
        path: data.path,
        type: 'file',
        size: data.size,
        sha: data.sha,
      }];
    } catch (error: any) {
      throw new Error(`Failed to get file tree: ${error.message}`);
    }
  }

  /**
   * Get file content from repository
   */
  async getFileContent(
    githubToken: string,
    owner: string,
    repo: string,
    path: string,
    ref: string = 'main'
  ): Promise<GitHubFileContent> {
    const octokit = new Octokit({ auth: githubToken });

    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      if (Array.isArray(data) || data.type !== 'file') {
        throw new Error('Path is not a file');
      }

      const content = Buffer.from(data.content, 'base64').toString('utf-8');

      return {
        path: data.path,
        content,
        sha: data.sha,
        size: data.size,
        encoding: data.encoding,
      };
    } catch (error: any) {
      throw new Error(`Failed to get file content: ${error.message}`);
    }
  }

  /**
   * Get multiple files content
   */
  async getMultipleFiles(
    githubToken: string,
    owner: string,
    repo: string,
    filePaths: string[],
    ref: string = 'main'
  ): Promise<GitHubFileContent[]> {
    const validFiles = filePaths.filter(path => !this.shouldExcludeFile(path));

    if (validFiles.length !== filePaths.length) {
      console.warn(`Excluded ${filePaths.length - validFiles.length} files (binaries or secrets)`);
    }

    const promises = validFiles.map(path =>
      this.getFileContent(githubToken, owner, repo, path, ref)
    );

    return Promise.all(promises);
  }

  /**
   * Check if file should be excluded (binaries, secrets)
   */
  private shouldExcludeFile(path: string): boolean {
    const secretPatterns = [
      '.env', '.env.local', 'credentials.json',
      'private-key', '.pem', '.key'
    ];

    const binaryExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.pdf',
      '.zip', '.tar', '.gz', '.exe', '.ico',
      '.woff', '.woff2', '.ttf', '.eot'
    ];

    const lowerPath = path.toLowerCase();

    return secretPatterns.some(pattern => lowerPath.includes(pattern)) ||
           binaryExtensions.some(ext => lowerPath.endsWith(ext));
  }

  /**
   * Get common configuration files from repository
   * Attempts to fetch standard config files (linters, formatters, build configs)
   * Returns only files that exist (fails silently for missing files)
   */
  async getConfigurationFiles(
    githubToken: string,
    owner: string,
    repo: string,
    ref: string = 'main'
  ): Promise<GitHubFileContent[]> {
    const configFiles = [
      // Documentation (helps identify project purpose and stack)
      'README.md',

      // JavaScript/TypeScript/Node.js
      'package.json',
      'package-lock.json',
      'tsconfig.json',
      '.eslintrc',
      '.eslintrc.js',
      '.eslintrc.json',

      // Framework-specific configs
      'vite.config.ts',
      'vite.config.js',
      'next.config.js',
      'next.config.mjs',
      'astro.config.mjs',
      'astro.config.ts',
      'nuxt.config.ts',
      'nuxt.config.js',
      'svelte.config.js',
      'remix.config.js',
      'gatsby-config.js',

      // Styling
      'tailwind.config.js',
      'tailwind.config.ts',

      // Python
      'requirements.txt',
      'pyproject.toml',
      'setup.py',
      'Pipfile',

      // Go
      'go.mod',

      // Rust
      'Cargo.toml',

      // Java/Kotlin
      'pom.xml',
      'build.gradle',
      'build.gradle.kts',

      // Ruby
      'Gemfile',

      // PHP
      'composer.json',

      // Docker
      'Dockerfile',
      'docker-compose.yml',

      // CI/CD
      '.gitlab-ci.yml',

      // Common
      '.gitignore',
      '.editorconfig',
    ];

    const results: GitHubFileContent[] = [];

    // Try to fetch each config file
    for (const configPath of configFiles) {
      try {
        const file = await this.getFileContent(githubToken, owner, repo, configPath, ref);
        results.push(file);
        console.log(`[GitHubService] Found config file: ${configPath}`);
      } catch (error) {
        // File doesn't exist or error fetching - skip silently
        // console.log(`[GitHubService] Config file not found: ${configPath}`);
      }
    }

    console.log(`[GitHubService] Loaded ${results.length} configuration files`);
    return results;
  }

  /**
   * Get GitHub Checks for a Pull Request
   */
  async getPullRequestChecks(
    githubToken: string,
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<GitHubChecksResponse> {
    const octokit = new Octokit({ auth: githubToken });

    try {
      // Get the PR to get the HEAD SHA
      const { data: pr } = await octokit.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
      });

      // Get check runs for the HEAD commit (GitHub Checks API)
      const { data: checks } = await octokit.checks.listForRef({
        owner,
        repo,
        ref: pr.head.sha,
      });

      // Get commit statuses for the HEAD commit (GitHub Status API - legacy)
      const { data: statuses } = await octokit.repos.listCommitStatusesForRef({
        owner,
        repo,
        ref: pr.head.sha,
      });

      // Convert check runs to our format
      const checkRuns = checks.check_runs.map(run => ({
        id: run.id,
        name: run.name,
        status: run.status as any,
        conclusion: run.conclusion as any,
        started_at: run.started_at,
        completed_at: run.completed_at,
        html_url: run.html_url,
        output: {
          title: run.output?.title || null,
          summary: run.output?.summary || null,
          text: run.output?.text || null,
        },
      }));

      // Convert commit statuses to check run format for consistency
      // Group statuses by context (status name) and take the latest one
      const statusMap = new Map<string, any>();
      for (const status of statuses) {
        if (!statusMap.has(status.context) ||
            new Date(status.created_at) > new Date(statusMap.get(status.context).created_at)) {
          statusMap.set(status.context, status);
        }
      }

      const statusChecks = Array.from(statusMap.values()).map(status => ({
        id: status.id,
        name: status.context,
        status: status.state === 'pending' ? 'in_progress' : 'completed',
        conclusion: status.state === 'success' ? 'success' :
                   status.state === 'failure' ? 'failure' :
                   status.state === 'error' ? 'failure' :
                   status.state === 'pending' ? null : 'neutral',
        started_at: status.created_at,
        completed_at: status.updated_at,
        html_url: status.target_url || `https://github.com/${owner}/${repo}/commit/${pr.head.sha}`,
        output: {
          title: null,
          summary: status.description || null,
          text: null,
        },
      }));

      // Combine both types of checks
      const allChecks = [...checkRuns, ...statusChecks];

      return {
        total_count: allChecks.length,
        check_runs: allChecks as any,
      };
    } catch (error: any) {
      throw new Error(`Failed to get PR checks: ${error.message}`);
    }
  }

  /**
   * Generate preview of changes without committing
   * Returns diff information for each file that will be changed
   */
  async generateExportPreview(
    userId: string,
    taskId: string,
    githubToken: string,
    owner: string,
    repo: string,
    branch: string = 'main'
  ): Promise<{
    files: Array<{
      path: string;
      status: 'new' | 'modified' | 'unchanged';
      oldContent: string | null;
      newContent: string;
      language: string;
    }>;
    totalFiles: number;
  }> {
    console.log('=== Generate Export Preview ===');

    // Get task with outputs
    const task = await prisma.task.findFirst({
      where: { id: taskId, userId },
      include: { agentOutputs: true },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    // Collect all files from artifacts
    const allFiles: Array<{ path: string; content: string; language: string }> = [];

    for (const output of task.agentOutputs) {
      if (output.artifacts && Array.isArray(output.artifacts)) {
        const artifacts = output.artifacts as Array<{
          type: string;
          filename: string;
          content: string;
          language?: string;
        }>;

        for (const artifact of artifacts) {
          // Include all artifact types (code, document, config, diagram)
          // Previously was checking for type === 'file' which was incorrect
          if (artifact.filename && artifact.content) {
            allFiles.push({
              path: artifact.filename,
              content: artifact.content,
              language: artifact.language || 'plaintext',
            });
          }
        }
      }
    }

    console.log(`Found ${allFiles.length} files to preview`);

    // For each file, try to get current content from repository
    const filesWithDiff = await Promise.all(
      allFiles.map(async (file) => {
        let oldContent: string | null = null;
        let status: 'new' | 'modified' | 'unchanged' = 'new';

        try {
          // Try to get existing file
          const existingFile = await this.getFileContent(githubToken, owner, repo, file.path, branch);
          oldContent = existingFile.content;

          // Normalize both contents before comparison
          const normalizedOld = this.normalizeContentForComparison(oldContent);
          const normalizedNew = this.normalizeContentForComparison(file.content);

          // Compare normalized contents
          if (normalizedOld === normalizedNew) {
            status = 'unchanged';
          } else {
            status = 'modified';
          }

          console.log(`[Preview] File: ${file.path}, Status: ${status}, Old lines: ${oldContent?.split('\n').length || 0}, New lines: ${file.content.split('\n').length}`);
        } catch (error) {
          // File doesn't exist - it's new
          status = 'new';
          console.log(`[Preview] File: ${file.path}, Status: ${status} (not found in repository)`);
        }

        return {
          path: file.path,
          status,
          oldContent,
          newContent: file.content,
          language: file.language,
        };
      })
    );

    return {
      files: filesWithDiff,
      totalFiles: filesWithDiff.length,
    };
  }

  /**
   * Export task results to GitHub as a Pull Request
   */
  async exportToGitHub(
    userId: string,
    dto: ExportToGitHubDto
  ): Promise<{ pullRequestUrl: string; branchName: string }> {
    console.log('=== GitHub Export Starting ===');
    console.log('Owner:', dto.owner);
    console.log('Repo:', dto.repo);
    console.log('Base Branch:', dto.baseBranch || 'main');
    console.log('Custom Branch:', dto.branchName || 'auto-generated');
    console.log('Update Existing:', dto.updateExisting);
    console.log('Pull Request URL:', dto.pullRequestUrl);

    const octokit = new Octokit({ auth: dto.githubToken });

    try {
      // 1. Get task with outputs
      const task = await prisma.task.findFirst({
        where: {
          id: dto.taskId,
          userId,
        },
        include: {
          agentOutputs: true,
        },
      });

      if (!task) {
        throw new Error('Task not found');
      }

      console.log('Task found:', task.id, 'with', task.agentOutputs.length, 'outputs');

      // 2. Get base branch reference (handle empty repositories)
      const baseBranch = dto.baseBranch || 'main';
      console.log('Attempting to get ref for branch:', baseBranch);
      let ref;

      try {
        const refData = await octokit.git.getRef({
          owner: dto.owner,
          repo: dto.repo,
          ref: `heads/${baseBranch}`,
        });
        ref = refData.data;
        console.log('✓ Branch ref found:', ref.object.sha);
      } catch (error: any) {
        console.error('✗ Error getting branch ref:', error.status, error.message);

        // Repository is empty or branch doesn't exist
        if (error.status === 404 || error.message?.includes('empty')) {
          console.log(`Repository ${dto.owner}/${dto.repo} is empty or branch doesn't exist. Initializing...`);

          // Initialize repository with a README
          await this.initializeEmptyRepository({
            octokit,
            owner: dto.owner,
            repo: dto.repo,
            baseBranch,
          });

          console.log(`Repository ${dto.owner}/${dto.repo} initialized with first commit`);

          // Now get the reference
          const refData = await octokit.git.getRef({
            owner: dto.owner,
            repo: dto.repo,
            ref: `heads/${baseBranch}`,
          });
          ref = refData.data;
        } else {
          throw error;
        }
      }

      // 3. Create new branch or use existing
      const branchName =
        dto.branchName || `ai-team-${task.id.slice(0, 8)}-${Date.now()}`;

      if (dto.updateExisting) {
        console.log('Update mode: Using existing branch:', branchName);
        // Verify branch exists
        try {
          const branchRef = await octokit.git.getRef({
            owner: dto.owner,
            repo: dto.repo,
            ref: `heads/${branchName}`,
          });
          console.log('✓ Existing branch found with SHA:', branchRef.data.object.sha);
        } catch (error: any) {
          console.log('Existing branch not found, creating it from base branch');
          try {
            await octokit.git.createRef({
              owner: dto.owner,
              repo: dto.repo,
              ref: `refs/heads/${branchName}`,
              sha: ref.object.sha,
            });
            console.log('✓ Branch created successfully');
          } catch (createError: any) {
            // If it fails because reference already exists, just log and continue
            if (createError.status === 422 && createError.message?.includes('Reference already exists')) {
              console.log('⚠ Branch already exists (race condition), continuing...');
            } else {
              throw createError;
            }
          }
        }
      } else {
        console.log('Creating new branch:', branchName, 'from SHA:', ref.object.sha);

        try {
          await octokit.git.createRef({
            owner: dto.owner,
            repo: dto.repo,
            ref: `refs/heads/${branchName}`,
            sha: ref.object.sha,
          });
          console.log('✓ Branch created successfully');
        } catch (createError: any) {
          // If branch already exists, throw a clear error
          if (createError.status === 422 && createError.message?.includes('Reference already exists')) {
            throw new Error(`Branch '${branchName}' already exists. Please use a different branch name or enable updateExisting mode.`);
          }
          throw createError;
        }
      }

      // 4. Collect all artifacts from ALL agents (respecting their paths)
      console.log('Collecting artifacts from', task.agentOutputs.length, 'agents...');

      const allFiles: Array<{ path: string; content: string }> = [];

      // Create summary document with all agent outputs
      let summaryContent = `# AI Team Task Results\n\n`;
      summaryContent += `## Task: ${task.title}\n\n`;
      summaryContent += `${task.description}\n\n`;
      summaryContent += `## Team Composition\n\n`;
      summaryContent += task.selectedAgents.map(a => `- ${a}`).join('\n');
      summaryContent += `\n\n## Execution Summary\n\n`;

      for (const output of task.agentOutputs) {
        summaryContent += `### ${output.agentRole}\n\n`;
        summaryContent += output.content.substring(0, 500) + '...\n\n';

        // Collect artifacts - use their EXACT paths (don't add agent folder prefix!)
        if (output.artifacts && Array.isArray(output.artifacts)) {
          const artifacts = output.artifacts as any[];
          console.log(`Agent ${output.agentRole} created ${artifacts.length} artifacts`);

          for (const artifact of artifacts) {
            // Use artifact.filename directly - it already has the correct path
            allFiles.push({
              path: artifact.filename, // e.g., "src/components/Button.tsx"
              content: artifact.content,
            });
            console.log(`  - ${artifact.filename}`);
          }
        }
      }

      // Add summary document
      allFiles.push({
        path: 'AI_TEAM_SUMMARY.md',
        content: summaryContent,
      });

      console.log(`Total files to create: ${allFiles.length}`);

      // 5. Create all files in a SINGLE commit using Git Trees API
      console.log('Creating single commit with all files...');

      await this.createCommitWithFiles({
        octokit,
        owner: dto.owner,
        repo: dto.repo,
        branch: branchName,
        files: allFiles,
        message: `AI Team: ${task.title}\n\nGenerated ${allFiles.length} files`,
      });

      console.log('✓ All files created in single commit');

      // 5. Create or update Pull Request
      let pullRequestUrl: string;

      if (dto.updateExisting && dto.pullRequestUrl) {
        // Use existing PR URL
        pullRequestUrl = dto.pullRequestUrl;
        console.log('✓ Using existing PR:', pullRequestUrl);
      } else {
        // Create new PR
        const prTitle = `AI Team Results: ${task.title}`;
        const prBody = this.generatePRDescription(task);

        try {
          const { data: pr } = await octokit.pulls.create({
            owner: dto.owner,
            repo: dto.repo,
            title: prTitle,
            head: branchName,
            base: baseBranch,
            body: prBody,
          });
          pullRequestUrl = pr.html_url;
          console.log('✓ PR created:', pullRequestUrl);
        } catch (error: any) {
          // If PR already exists, find it
          if (error.message?.includes('pull request already exists')) {
            console.log('PR already exists, finding it...');
            const { data: prs } = await octokit.pulls.list({
              owner: dto.owner,
              repo: dto.repo,
              head: `${dto.owner}:${branchName}`,
              base: baseBranch,
              state: 'open',
            });
            if (prs.length > 0) {
              pullRequestUrl = prs[0].html_url;
              console.log('✓ Found existing PR:', pullRequestUrl);
            } else {
              throw error;
            }
          } else {
            throw error;
          }
        }
      }

      // 6. Save export record
      await prisma.export.create({
        data: {
          userId,
          taskId: task.id,
          repositoryUrl: `https://github.com/${dto.owner}/${dto.repo}`,
          branchName,
          pullRequestUrl,
          status: 'completed',
        },
      });

      return {
        pullRequestUrl,
        branchName,
      };
    } catch (error: any) {
      console.error('GitHub export error:', error.message);

      // Save failed export
      await prisma.export.create({
        data: {
          userId,
          taskId: dto.taskId,
          repositoryUrl: `https://github.com/${dto.owner}/${dto.repo}`,
          branchName: dto.branchName || 'unknown',
          status: 'error',
          error: error.message,
        },
      });

      throw new Error(`GitHub export failed: ${error.message}`);
    }
  }

  /**
   * Normalize content for accurate comparison
   * Removes differences that don't affect actual content
   */
  private normalizeContentForComparison(content: string): string {
    return content
      .replace(/\r\n/g, '\n')  // Normalize line endings to LF
      .replace(/\r/g, '\n')     // Handle old Mac line endings
      .trim();                   // Remove leading/trailing whitespace
  }

  /**
   * Create a single commit with multiple files using Git Trees API
   * This is much more efficient than creating one commit per file
   */
  private async createCommitWithFiles({
    octokit,
    owner,
    repo,
    branch,
    files,
    message,
  }: {
    octokit: Octokit;
    owner: string;
    repo: string;
    branch: string;
    files: Array<{ path: string; content: string }>;
    message: string;
  }): Promise<void> {
    console.log(`[createCommitWithFiles] Creating commit with ${files.length} files on branch ${branch}`);

    // 1. Get the current commit SHA of the branch
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    const currentCommitSha = refData.object.sha;
    console.log(`Current commit SHA: ${currentCommitSha}`);

    // 2. Get the tree SHA of the current commit
    const { data: currentCommit } = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: currentCommitSha,
    });
    const baseTreeSha = currentCommit.tree.sha;
    console.log(`Base tree SHA: ${baseTreeSha}`);

    // 3. Create blobs for all files
    console.log('Creating blobs for all files...');
    const tree: Array<{
      path: string;
      mode: '100644'; // regular file
      type: 'blob';
      sha: string;
    }> = [];

    for (const file of files) {
      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
        content: Buffer.from(file.content).toString('base64'),
        encoding: 'base64',
      });
      tree.push({
        path: file.path,
        mode: '100644',
        type: 'blob',
        sha: blob.sha,
      });
      console.log(`  Created blob for ${file.path}: ${blob.sha}`);
    }

    // 4. Create a new tree with all files
    // base_tree: includes existing files from the repository
    // tree: our files will be added/updated (if path matches, it overwrites)
    console.log('Creating new tree...');
    const { data: newTree } = await octokit.git.createTree({
      owner,
      repo,
      base_tree: baseTreeSha, // Inherit existing files
      tree: tree as any, // Add/modify files (same path = overwrite)
    });
    console.log(`New tree SHA: ${newTree.sha}`);

    // 5. Create a new commit pointing to the new tree
    console.log('Creating commit...');
    const { data: newCommit } = await octokit.git.createCommit({
      owner,
      repo,
      message,
      tree: newTree.sha,
      parents: [currentCommitSha],
    });
    console.log(`New commit SHA: ${newCommit.sha}`);

    // 6. Update the branch reference to point to the new commit
    console.log('Updating branch reference...');
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
    });
    console.log('✓ Branch updated successfully');
  }

  /**
   * Initialize an empty repository with a README
   */
  private async initializeEmptyRepository({
    octokit,
    owner,
    repo,
    baseBranch,
  }: {
    octokit: Octokit;
    owner: string;
    repo: string;
    baseBranch: string;
  }): Promise<void> {
    try {
      const readmeContent = `# ${repo}\n\nInitialized by AI Team Collaboration Platform\n`;
      const contentBase64 = Buffer.from(readmeContent).toString('base64');

      // For empty repos, we need to create the first file without specifying a branch
      // This will create the default branch automatically
      const { data } = await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: 'README.md',
        message: 'Initial commit',
        content: contentBase64,
      });

      console.log('Initial commit created:', data.commit.sha);

      // If the created branch doesn't match our desired baseBranch, rename it
      if (data.content && 'sha' in data.content) {
        // Get the repository to check default branch
        const { data: repoData } = await octokit.repos.get({ owner, repo });

        if (repoData.default_branch !== baseBranch) {
          console.log(`Default branch is ${repoData.default_branch}, but we need ${baseBranch}`);

          // Create a new branch with the desired name pointing to the same commit
          try {
            if (data.commit?.sha) {
              await octokit.git.createRef({
                owner,
                repo,
                ref: `refs/heads/${baseBranch}`,
                sha: data.commit.sha,
              });

              // Update default branch
              await octokit.repos.update({
                owner,
                repo,
                default_branch: baseBranch,
              });
            }
          } catch (err) {
            console.log('Branch already exists or cannot be created:', err);
          }
        }
      }
    } catch (error: any) {
      console.error('Error initializing repository:', error.message);
      throw new Error(`Failed to initialize repository: ${error.message}`);
    }
  }

  // /**
  //  * Create or update a file in a repository
  //  * Note: Currently unused but kept for future use
  //  */
  // private async _createOrUpdateFile({
  //   octokit,
  //   owner,
  //   repo,
  //   branch,
  //   path,
  //   content,
  //   message,
  // }: {
  //   octokit: Octokit;
  //   owner: string;
  //   repo: string;
  //   branch: string;
  //   path: string;
  //   content: string;
  //   message: string;
  // }): Promise<void> {
  //   try {
  //     // Try to get existing file (to update)
  //     const { data: existingFile } = await octokit.repos.getContent({
  //       owner,
  //       repo,
  //       path,
  //       ref: branch,
  //     });

  //     // File exists, update it
  //     if ('sha' in existingFile) {
  //       await octokit.repos.createOrUpdateFileContents({
  //         owner,
  //         repo,
  //         path,
  //         message,
  //         content: Buffer.from(content).toString('base64'),
  //         branch,
  //         sha: existingFile.sha,
  //       });
  //     }
  //   } catch {
  //     // File doesn't exist, create it
  //     await octokit.repos.createOrUpdateFileContents({
  //       owner,
  //       repo,
  //       path,
  //       message,
  //       content: Buffer.from(content).toString('base64'),
  //       branch,
  //     });
  //   }
  // }

  // /**
  //  * Format agent output for README
  //  * Note: Currently unused but kept for future use
  //  */
  // private _formatAgentOutput(output: any): string {
  //   let content = `# ${this.getAgentName(output.agentRole)}\n\n`;

  //   content += `**Status:** ${output.status}\n`;
  //   content += `**Execution Time:** ${(output.executionTime / 1000).toFixed(2)}s\n`;
  //   content += `**Created:** ${new Date(output.createdAt).toISOString()}\n\n`;

  //   content += `---\n\n`;

  //   content += output.content;

  //   if (output.artifacts && Array.isArray(output.artifacts) && output.artifacts.length > 0) {
  //     content += `\n\n## Artifacts\n\n`;
  //     output.artifacts.forEach((artifact: any) => {
  //       content += `- [${artifact.filename}](./${artifact.filename})\n`;
  //     });
  //   }

  //   return content;
  // }

  /**
   * Generate Pull Request description
   */
  private generatePRDescription(task: any): string {
    let description = `# AI Team Collaboration Results\n\n`;

    description += `**Task:** ${task.title}\n\n`;
    description += `**Description:**\n${task.description}\n\n`;

    description += `## Configuration\n\n`;
    description += `- **Execution Mode:** ${task.executionMode}\n`;
    description += `- **AI Provider:** ${task.provider}\n`;
    description += `- **Agents:** ${task.selectedAgents.length}\n`;
    description += `- **Status:** ${task.status}\n`;

    if (task.completedAt) {
      description += `- **Completed:** ${new Date(task.completedAt).toLocaleString()}\n`;
    }

    description += `\n## Team Members\n\n`;
    task.agentOutputs.forEach((output: any) => {
      const icon = this.getAgentIcon(output.agentRole);
      description += `- ${icon} **${this.getAgentName(output.agentRole)}** - ${output.status}\n`;
    });

    description += `\n## Structure\n\n`;
    description += `Each agent's work is organized in its own folder:\n\n`;
    task.agentOutputs.forEach((output: any) => {
      description += `- \`${output.agentRole}/\` - ${this.getAgentName(output.agentRole)}\n`;
    });

    description += `\n---\n\n`;
    description += `🤖 Generated by [AI Team Collaboration Platform](https://github.com/yourusername/ai-team)\n`;

    return description;
  }

  /**
   * Get agent icon
   */
  private getAgentIcon(role: string): string {
    const icons: Record<string, string> = {
      'tech-lead': '🏗️',
      'product-owner': '📋',
      frontend: '💻',
      backend: '⚙️',
      devops: '🚀',
      qa: '🧪',
    };
    return icons[role] || '👤';
  }

  /**
   * Get agent friendly name
   */
  private getAgentName(role: string): string {
    const names: Record<string, string> = {
      'tech-lead': 'Technical Lead',
      'product-owner': 'Product Owner',
      frontend: 'Frontend Developer',
      backend: 'Backend Developer',
      devops: 'DevOps Engineer',
      qa: 'QA Engineer',
    };
    return names[role] || role;
  }

  /**
   * Get export history for user
   */
  async getExportHistory(userId: string, limit: number = 10) {
    const exports = await prisma.export.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        task: {
          select: {
            title: true,
            description: true,
          },
        },
      },
    });

    return exports;
  }

  /**
   * Get exports for a specific task
   */
  async getTaskExports(userId: string, taskId: string) {
    const exports = await prisma.export.findMany({
      where: {
        userId,
        taskId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return exports;
  }
}

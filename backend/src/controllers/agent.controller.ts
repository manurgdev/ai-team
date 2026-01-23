import { Response } from 'express';
import { AuthRequest } from '../types/api.types';
import { OrchestratorService, ProgressCallback } from '../services/agents/orchestrator.service';
import { getAllAgentDefinitions } from '../services/agents/agent-definitions';
import { ConfigService } from '../services/config.service';

const orchestratorService = new OrchestratorService();
const configService = new ConfigService();

export class AgentController {
  /**
   * Get all available agent definitions
   */
  async getDefinitions(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const definitions = getAllAgentDefinitions();
      res.status(200).json(definitions);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch agent definitions' });
    }
  }

  /**
   * Execute a task with selected agents (with real-time Server-Sent Events)
   * POST /api/agents/execute/stream
   */
  async executeTaskStream(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { taskDescription, selectedAgents, executionMode, provider, model, githubContext } = req.body;

      // Validate inputs
      if (!taskDescription || !selectedAgents || !executionMode || !provider) {
        res.status(400).json({
          error: 'Missing required fields: taskDescription, selectedAgents, executionMode, provider',
        });
        return;
      }

      if (selectedAgents.length === 0) {
        res.status(400).json({ error: 'At least one agent must be selected' });
        return;
      }

      if (!['sequential', 'parallel'].includes(executionMode)) {
        res.status(400).json({ error: 'executionMode must be sequential or parallel' });
        return;
      }

      // Get user's API key for the provider
      const apiKey = await configService.getDecryptedApiKey(req.userId, provider);
      if (!apiKey) {
        res.status(400).json({
          error: `No API key found for provider: ${provider}. Please add one in settings.`,
        });
        return;
      }

      // Set up Server-Sent Events
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
      res.flushHeaders();

      // Progress callback to send SSE events
      const progressCallback: ProgressCallback = (event) => {
        const data = {
          taskId: event.taskId,
          agentRole: event.agentRole,
          ...event.data,
        };
        res.write(`event: ${event.type}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Execute task in background
      orchestratorService.executeTask(
        {
          taskDescription,
          selectedAgents,
          executionMode,
          provider,
          model,
          apiKey,
          userId: req.userId,
          githubContext,
        },
        progressCallback
      ).then((result) => {
        // Send final completion event
        res.write(`event: complete\n`);
        res.write(`data: ${JSON.stringify({ taskId: result.taskId })}\n\n`);
        res.end();
      }).catch((error) => {
        // Send error event
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      });

    } catch (error: any) {
      console.error('Execute task stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || 'Failed to execute task' });
      }
    }
  }

  /**
   * Execute a task with selected agents (original non-streaming endpoint)
   * POST /api/agents/execute
   */
  async executeTask(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { taskDescription, selectedAgents, executionMode, provider, model } = req.body;

      // Validate inputs
      if (!taskDescription || !selectedAgents || !executionMode || !provider) {
        res.status(400).json({
          error: 'Missing required fields: taskDescription, selectedAgents, executionMode, provider',
        });
        return;
      }

      if (selectedAgents.length === 0) {
        res.status(400).json({ error: 'At least one agent must be selected' });
        return;
      }

      if (!['sequential', 'parallel'].includes(executionMode)) {
        res.status(400).json({ error: 'executionMode must be sequential or parallel' });
        return;
      }

      // Get user's API key for the provider
      const apiKey = await configService.getDecryptedApiKey(req.userId, provider);
      if (!apiKey) {
        res.status(400).json({
          error: `No API key found for provider: ${provider}. Please add one in settings.`,
        });
        return;
      }

      // Execute the task
      const result = await orchestratorService.executeTask({
        taskDescription,
        selectedAgents,
        executionMode,
        provider,
        model,
        apiKey,
        userId: req.userId,
      });

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Execute task error:', error);
      res.status(500).json({ error: error.message || 'Failed to execute task' });
    }
  }

  /**
   * Get task by ID
   */
  async getTask(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const taskId = Array.isArray(id) ? id[0] : id;

      const task = await orchestratorService.getTask(taskId, req.userId!);
      res.status(200).json(task);
    } catch (error: any) {
      if (error.message === 'Task not found') {
        res.status(404).json({ error: 'Task not found' });
      } else {
        res.status(500).json({ error: 'Failed to fetch task' });
      }
    }
  }

  /**
   * Get user's task history
   */
  async getTasks(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

      const tasks = await orchestratorService.getUserTasks(req.userId, limit);
      res.status(200).json(tasks);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  }

  /**
   * Review and fix a task based on errors (with streaming)
   * POST /api/agents/review-task/stream
   */
  async reviewTaskStream(req: AuthRequest, res: Response): Promise<void> {
    try {
      console.log('=== Review Task Stream Started ===');
      console.log('User ID:', req.userId);

      if (!req.userId) {
        console.error('No userId in request');
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { originalTaskId, errors, provider, model, selectedAgents, exportInfo } = req.body;
      console.log('Request body:', { originalTaskId, provider, model, selectedAgents: selectedAgents?.length });

      // Validate inputs
      if (!originalTaskId || !errors) {
        console.error('Missing required fields:', { hasTaskId: !!originalTaskId, hasErrors: !!errors });
        res.status(400).json({
          error: 'Missing required fields: originalTaskId, errors',
        });
        return;
      }

      if (!provider) {
        res.status(400).json({ error: 'Provider is required' });
        return;
      }

      // Get user's API key for the provider
      const apiKey = await configService.getDecryptedApiKey(req.userId, provider);
      if (!apiKey) {
        res.status(400).json({
          error: `No API key found for provider: ${provider}. Please add one in settings.`,
        });
        return;
      }

      // Get original task
      let originalTask;
      try {
        originalTask = await orchestratorService.getTask(originalTaskId, req.userId);
      } catch (error: any) {
        console.error('Error fetching original task:', error);
        res.status(404).json({ error: 'Original task not found: ' + error.message });
        return;
      }

      if (!originalTask) {
        res.status(404).json({ error: 'Original task not found' });
        return;
      }

      console.log('Original task found:', originalTask.id);
      console.log('Agent outputs count:', originalTask.agentOutputs?.length || 0);

      // Set up Server-Sent Events
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
      res.flushHeaders();

      // Build review context description with strict focus on errors
      const reviewDescription = `# 🔧 Review and Fix CI/CD Errors

## 🚨 CRITICAL RULES - ABSOLUTE REQUIREMENTS

**YOU MUST ONLY FIX THE SPECIFIC ERRORS LISTED BELOW:**

❌ DO NOT add new features or functionality
❌ DO NOT refactor working code
❌ DO NOT change file structure or architecture
❌ DO NOT modify files not related to the errors
❌ DO NOT add comments, documentation, or formatting to working files
❌ DO NOT change dependencies unless explicitly required by the error
❌ DO NOT create new files unless absolutely necessary to fix the error

---

## 📋 VALIDATION FRAMEWORK

### Phase 1: Error Analysis (BEFORE making changes)
You MUST complete this analysis for each error:

1. **Read the error carefully**
   - Identify exact file path and line number
   - Determine error type (syntax, type, import, runtime, etc.)

2. **Use GitHub tools to read current file state**
   - CRITICAL: Read the actual current content from the repository
   - DO NOT assume what the file contains
   - Check branch: ${(originalTask.githubContext as any)?.branch || 'main'}

3. **Root Cause Analysis**
   - What is the EXACT cause of this error?
   - Is it isolated or does it affect other files?
   - What is the MINIMAL change needed?

4. **Impact Assessment**
   - What will this fix change?
   - Could this break anything else?
   - Do I need to update imports/exports?

### Phase 2: Pre-Flight Checklist (BEFORE creating artifacts)

Verify EACH item before proceeding:
- [ ] I have read the current file from GitHub
- [ ] I understand why the error occurs
- [ ] My fix is the MINIMAL change possible
- [ ] I checked project config files (tsconfig.json, .eslintrc, etc.)
- [ ] I verified imports match actual file locations
- [ ] I'm not adding new functionality
- [ ] I'm not refactoring unrelated code
- [ ] The fix preserves all existing behavior

### Phase 3: Implementation Rules

When creating the fix:

1. **Preserve Everything Not Related to Error**
   - Keep exact same imports (unless causing the error)
   - Keep exact same function signatures
   - Keep exact same file structure
   - Keep exact same variable names

2. **Follow Project Conventions** (from config files)
   - Use project's TypeScript settings
   - Follow ESLint rules
   - Use Prettier formatting
   - Match existing code style

3. **Verify Types and Imports**
   - All imports point to files that exist
   - All types are defined
   - No circular dependencies
   - No unused imports

### Phase 4: Change Documentation (REQUIRED)

At the top of EACH modified file, add:
\`\`\`typescript
// REVIEW FIX: [One-line explanation of what was changed]
// Fixes error: [Error message summary]
\`\`\`

---

## 🎯 Your Task

### Original Task Context
${originalTask.description}

### CI/CD Errors to Fix

The following errors occurred during automated checks. Fix ONLY these:

\`\`\`
${errors}
\`\`\`

### Repository Information
- **Repository**: ${(originalTask.githubContext as any)?.repository?.fullName || 'N/A'}
- **Branch**: ${(originalTask.githubContext as any)?.branch || 'main'}
- **YOU HAVE GITHUB TOOLS**: Use them to read current file state

### Error Analysis Template (Use This)

For EACH error, provide this analysis in your response:

\`\`\`markdown
### Error #[N]: [Error Name]

**Location**: [file]:[line]
**Type**: [syntax/type/import/runtime/etc.]
**Root Cause**: [Why this error occurs]
**Current State**: [What the code does now - read from GitHub]
**Required Fix**: [Minimal change needed]
**Risk Level**: [Low/Medium/High]
**Side Effects**: [None / List affected files]
**Verification**: [How to verify the fix works]
\`\`\`

---

## ✅ Success Criteria

1. All listed errors are fixed
2. No new errors are introduced
3. All working functionality is preserved
4. Build succeeds
5. Tests pass (if they existed before)
6. Code follows project conventions

---

## 📁 Your Previous Work

You will see all previously created files below. Review them carefully:
- DO NOT recreate files that are already correct
- ONLY modify files that have errors
- Build on your previous work, don't start from scratch`;

      // Use original agents if not specified
      const agentsToUse = selectedAgents || originalTask.selectedAgents;
      console.log('Using agents:', agentsToUse);

      // Progress callback to send SSE events
      const progressCallback: ProgressCallback = (event) => {
        const data = {
          taskId: event.taskId,
          agentRole: event.agentRole,
          ...event.data,
        };
        res.write(`event: ${event.type}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Execute the review on the SAME task (adds new outputs to original task)
      orchestratorService.executeTask({
        taskDescription: reviewDescription,
        selectedAgents: agentsToUse,
        executionMode: originalTask.executionMode as any,
        provider,
        model,
        apiKey,
        userId: req.userId,
        githubContext: originalTask.githubContext as any,
        previousOutputs: originalTask.agentOutputs as any, // Pass artifacts from original task!
        originalTaskId: originalTaskId, // Continue the same task!
      }, progressCallback).then(() => {
        // Send completion - taskId should be the original task
        res.write(`event: review-complete\n`);
        res.write(`data: ${JSON.stringify({
          taskId: originalTaskId, // Return original task ID
          exportInfo
        })}\n\n`);
        res.end();
      }).catch((error) => {
        // Send error event
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      });

    } catch (error: any) {
      console.error('Review task stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || 'Failed to review task' });
      }
    }
  }

  /**
   * Review and fix a task based on errors (e.g., from CI/CD checks)
   * POST /api/agents/review-task
   */
  async reviewTask(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { originalTaskId, errors, provider, model, selectedAgents, exportInfo } = req.body;

      // Validate inputs
      if (!originalTaskId || !errors) {
        res.status(400).json({
          error: 'Missing required fields: originalTaskId, errors',
        });
        return;
      }

      if (!provider) {
        res.status(400).json({ error: 'Provider is required' });
        return;
      }

      // Get user's API key for the provider
      const apiKey = await configService.getDecryptedApiKey(req.userId, provider);
      if (!apiKey) {
        res.status(400).json({
          error: `No API key found for provider: ${provider}. Please add one in settings.`,
        });
        return;
      }

      // Get original task
      const originalTask = await orchestratorService.getTask(originalTaskId, req.userId);
      if (!originalTask) {
        res.status(404).json({ error: 'Original task not found' });
        return;
      }

      // Build review context description
      const reviewDescription = `# Review and Fix Task

## Original Task
${originalTask.description}

## Previous Implementation Issues

The previous implementation encountered the following errors during deployment/CI checks:

${errors}

## Your Task

Review the previous implementation and fix the issues mentioned above. Ensure that:
1. All deployment/CI errors are addressed
2. The code follows best practices
3. Tests pass successfully
4. The implementation meets the original requirements

## Previous Agent Outputs

${originalTask.agentOutputs?.map((output: any) => `
### ${output.agentRole}
Status: ${output.status}
${output.content}
${output.artifacts?.length ? `\nArtifacts: ${output.artifacts.length} file(s)` : ''}
`).join('\n')}`;

      // Use original agents if not specified
      const agentsToUse = selectedAgents || originalTask.selectedAgents;

      // Execute the review task
      const result = await orchestratorService.executeTask({
        taskDescription: reviewDescription,
        selectedAgents: agentsToUse,
        executionMode: originalTask.executionMode as any,
        provider,
        model,
        apiKey,
        userId: req.userId,
        githubContext: originalTask.githubContext as any,
      });

      res.status(200).json({
        ...result,
        originalTaskId,
        exportInfo, // Pass through for frontend to update PR
      });
    } catch (error: any) {
      console.error('Review task error:', error);
      res.status(500).json({ error: error.message || 'Failed to review task' });
    }
  }

  /**
   * Run manual completion round for a task (with streaming)
   * POST /api/agents/manual-completion/stream
   */
  async manualCompletionStream(req: AuthRequest, res: Response): Promise<void> {
    try {
      console.log('=== Manual Completion Stream Started ===');

      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { taskId } = req.body;

      if (!taskId) {
        res.status(400).json({ error: 'Missing required field: taskId' });
        return;
      }

      // Get task
      const task = await orchestratorService.getTask(taskId, req.userId);
      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      if (!task.githubContext) {
        res.status(400).json({ error: 'Task does not have GitHub context' });
        return;
      }

      // Get user's API key for the provider
      const apiKey = await configService.getDecryptedApiKey(req.userId, task.provider);
      if (!apiKey) {
        res.status(400).json({
          error: `No API key found for provider: ${task.provider}. Please add one in settings.`,
        });
        return;
      }

      // Set up Server-Sent Events
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      // SSE progress callback
      const progressCallback: ProgressCallback = (event) => {
        res.write(`event: ${event.type}\n`);
        res.write(`data: ${JSON.stringify(event.data || {})}\n\n`);
      };

      // Execute manual completion round
      orchestratorService.executeManualCompletionRound(
        taskId,
        task.provider,
        task.model || undefined,
        apiKey,
        req.userId,
        progressCallback
      ).then(() => {
        // Send completion
        res.write(`event: completion-complete\n`);
        res.write(`data: ${JSON.stringify({ taskId, success: true })}\n\n`);
        res.end();
      }).catch((error) => {
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      });

    } catch (error: any) {
      console.error('Manual completion stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || 'Failed to run manual completion' });
      }
    }
  }
}

import { AIProvider, ProviderMessage, ToolResult } from '../providers/provider.interface';
import { ProviderFactory } from '../providers/provider.factory';
import {
  AgentContext,
  AgentDefinition,
  AgentOutput,
  AgentRole,
  ExecutionMode,
  ExecutionResult,
} from '../../types/agent.types';
import { getAgentDefinition, getAgentsByDependencies } from './agent-definitions';
import { ContextBuilder } from './context-builder';
import { prisma } from '../../utils/prisma';
import { PricingService } from '../pricing.service';
import { GitHubToolsService, GitHubToolContext } from './github-tools.service';
import { getOpenAITools, getAnthropicTools } from './tool-definitions';

export interface ExecuteTaskDto {
  taskDescription: string;
  selectedAgents: AgentRole[];
  executionMode: ExecutionMode;
  provider: string;
  model?: string;
  apiKey: string;
  userId: string;
  githubContext?: {
    repository: { owner: string; repo: string; fullName: string };
    branch: string;
    selectedFiles: Array<{
      path: string;
      content: string;
      size: number;
      tokens: number;
      language: string;
    }>;
  };
  previousOutputs?: AgentOutput[]; // For review/continuation tasks
  originalTaskId?: string; // Link to original task if this is a review
}

export type ProgressCallback = (event: {
  type: 'task_created' | 'agent_start' | 'agent_progress' | 'agent_complete' | 'agent_error' | 'task_complete' | 'task_error' | 'tool_call';
  taskId: string;
  agentRole?: AgentRole;
  data?: any;
}) => void;

export class OrchestratorService {
  /**
   * Execute a task with a team of agents
   */
  async executeTask(dto: ExecuteTaskDto, progressCallback?: ProgressCallback): Promise<ExecutionResult> {
    const startTime = Date.now();

    let task;

    // If originalTaskId is provided, continue that task instead of creating new one
    if (dto.originalTaskId) {
      console.log(`[Orchestrator] Continuing task ${dto.originalTaskId}`);

      // Get and update existing task
      task = await prisma.task.update({
        where: { id: dto.originalTaskId },
        data: {
          status: 'running', // Set back to running for the iteration
        },
      });

      console.log(`[Orchestrator] Task ${task.id} set to running for review iteration`);
    } else {
      // Create new task in database
      task = await prisma.task.create({
        data: {
          userId: dto.userId,
          title: this.generateTaskTitle(dto.taskDescription),
          description: dto.taskDescription,
          selectedAgents: dto.selectedAgents,
          executionMode: dto.executionMode,
          status: 'running',
          provider: dto.provider,
          model: dto.model,
          githubContext: dto.githubContext as any,
        },
      });

      // Emit task created event (only for new tasks)
      progressCallback?.({
        type: 'task_created',
        taskId: task.id,
        data: {
          title: task.title,
          description: task.description,
          selectedAgents: task.selectedAgents,
          executionMode: task.executionMode,
        },
      });
    }

    try {
      // Get agent definitions
      const agents = dto.selectedAgents
        .map((role) => getAgentDefinition(role))
        .filter((agent): agent is AgentDefinition => agent !== undefined);

      if (agents.length === 0) {
        throw new Error('No valid agents selected');
      }

      // Create AI provider
      const provider = ProviderFactory.createProvider(dto.provider, dto.apiKey);

      // Auto-load configuration files if githubContext exists and no previousOutputs (first run)
      let enhancedGithubContext = dto.githubContext;
      if (dto.githubContext && !dto.previousOutputs) {
        console.log('[Orchestrator] Auto-loading configuration files...');
        try {
          const githubTokenService = await import('../github-token.service');
          const tokenService = new githubTokenService.GitHubTokenService();
          const githubToken = await tokenService.getDecryptedToken(dto.userId);

          if (githubToken) {
            const { GitHubService } = await import('../github.service');
            const githubService = new GitHubService();

            const configFiles = await githubService.getConfigurationFiles(
              githubToken,
              dto.githubContext.repository.owner,
              dto.githubContext.repository.repo,
              dto.githubContext.branch
            );

            if (configFiles.length > 0) {
              // Estimate tokens for config files
              const { TokenEstimationService } = await import('../token-estimation.service');
              const configFilesWithTokens = configFiles.map(file => ({
                path: file.path,
                content: file.content,
                size: file.size,
                tokens: TokenEstimationService.estimateTokens(file.content),
                language: TokenEstimationService.detectLanguage(file.path),
              }));

              // Merge with existing selected files
              enhancedGithubContext = {
                ...dto.githubContext,
                selectedFiles: [
                  ...configFilesWithTokens,
                  ...(dto.githubContext.selectedFiles || []),
                ],
              };

              console.log(`[Orchestrator] Added ${configFiles.length} configuration files to context`);
            }
          }
        } catch (error) {
          console.error('[Orchestrator] Error loading configuration files:', error);
          // Continue without config files - not critical
        }
      }

      // Execute based on mode
      let outputs: AgentOutput[];
      const isReviewTask = !!dto.originalTaskId;
      if (dto.executionMode === 'sequential') {
        outputs = await this.executeSequential(task.id, agents, dto.taskDescription, provider, dto.provider, dto.model, progressCallback, enhancedGithubContext, dto.previousOutputs, isReviewTask);
      } else {
        outputs = await this.executeParallel(task.id, agents, dto.taskDescription, provider, dto.provider, dto.model, progressCallback, enhancedGithubContext, dto.previousOutputs, isReviewTask);
      }

      // Run Task Completion Validator if githubContext exists
      if (enhancedGithubContext) {
        console.log('[Orchestrator] Running Task Completion Validator...');
        const completionResult = await this.validateAndCompleteTask(
          task.id,
          agents,
          outputs,
          dto.taskDescription,
          provider,
          dto.provider,
          enhancedGithubContext,
          dto.model,
          progressCallback
        );

        // Add completion round outputs if any
        if (completionResult.additionalOutputs.length > 0) {
          outputs = [...outputs, ...completionResult.additionalOutputs];
        }
      }

      // Run post-processing file validation
      console.log('[Orchestrator] Running post-processing file validation...');
      const validationErrors = this.validateGeneratedFiles(outputs);
      if (validationErrors.length > 0) {
        console.error('[Orchestrator] File validation errors detected:');
        validationErrors.forEach(error => console.error(`  ${error}`));
        // Note: We log errors but don't fail the task - user can see issues in the output
      }

      // Detect if Product Owner defined multiple phases
      console.log('[Orchestrator] Checking for phase planning...');
      const phaseInfo = this.detectPhases(outputs);

      // Update task as completed with phase info
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          hasNextPhase: phaseInfo.hasNextPhase,
          nextPhaseDescription: phaseInfo.nextPhaseDescription,
          currentPhase: phaseInfo.currentPhase,
        },
      });

      if (phaseInfo.hasNextPhase) {
        console.log(`[Orchestrator] ✅ Phase tracking detected: ${phaseInfo.currentPhase} completed, ${phaseInfo.nextPhaseDescription ? 'next phase available' : 'more phases pending'}`);
      }

      const totalExecutionTime = Date.now() - startTime;

      // Emit task complete event
      progressCallback?.({
        type: 'task_complete',
        taskId: task.id,
        data: {
          totalExecutionTime,
          outputs: outputs.length,
        },
      });

      return {
        taskId: task.id,
        status: 'completed',
        outputs,
        totalExecutionTime,
        completedAt: new Date(),
      };
    } catch (error: any) {
      // Update task as error
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'error',
        },
      });

      // Emit error event
      progressCallback?.({
        type: 'task_error',
        taskId: task.id,
        data: {
          error: error.message,
        },
      });

      throw error;
    }
  }

  /**
   * Execute agents sequentially (respecting dependencies)
   */
  private async executeSequential(
    taskId: string,
    agents: AgentDefinition[],
    taskDescription: string,
    provider: AIProvider,
    providerName: string,
    model?: string,
    progressCallback?: ProgressCallback,
    githubContext?: ExecuteTaskDto['githubContext'],
    existingOutputs?: AgentOutput[], // For review/continuation tasks
    isReviewTask: boolean = false
  ): Promise<AgentOutput[]> {
    // Pre-populate context with existing outputs if this is a review/continuation
    const previousOutputsMap = new Map<string, AgentOutput>();
    if (existingOutputs && existingOutputs.length > 0) {
      console.log(`[Orchestrator] Pre-populating context with ${existingOutputs.length} existing outputs`);
      // Only take the LAST output for each agent role for previousOutputs map
      existingOutputs.forEach(output => {
        previousOutputsMap.set(output.agentRole, output);
      });
    }

    const context: AgentContext = {
      taskDescription,
      previousOutputs: previousOutputsMap,
      teamComposition: agents.map((a) => a.role),
      githubFiles: githubContext?.selectedFiles.map(f => ({
        path: f.path,
        content: f.content,
        language: f.language,
        size: f.size,
        tokens: f.tokens,
      })),
      allPreviousOutputs: existingOutputs || [], // Pass ALL outputs for agents to see their history
      isReviewTask,
    };

    const outputs: AgentOutput[] = [];

    // Sort agents by dependencies (topological sort)
    const sortedAgents = this.topologicalSort(agents);

    for (const agent of sortedAgents) {
      console.log(`Executing agent: ${agent.role}`);

      // Emit agent start event
      progressCallback?.({
        type: 'agent_start',
        taskId,
        agentRole: agent.role,
        data: {
          agentName: agent.name,
          agentDescription: agent.description,
        },
      });

      // Choose execution method based on githubContext availability
      let output: AgentOutput;
      if (githubContext && provider.executeWithTools) {
        const toolContext: GitHubToolContext = {
          githubToken: '', // Will be set from stored token
          owner: githubContext.repository.owner,
          repo: githubContext.repository.repo,
          branch: githubContext.branch,
        };

        // Get stored GitHub token
        const githubTokenService = await import('../github-token.service');
        const tokenService = new githubTokenService.GitHubTokenService();

        try {
          // Try to get stored token
          const storedToken = await tokenService.getDecryptedToken((await prisma.task.findUnique({ where: { id: taskId } }))?.userId || '');
          if (storedToken) {
            toolContext.githubToken = storedToken;
            output = await this.executeAgentWithTools(agent, context, provider, providerName, toolContext, model, taskId, progressCallback);
          } else {
            console.log('[Orchestrator] No GitHub token found, falling back to normal execution');
            output = await this.executeAgent(agent, context, provider, providerName, model, taskId, progressCallback);
          }
        } catch (error) {
          console.error('[Orchestrator] Error getting GitHub token, falling back:', error);
          output = await this.executeAgent(agent, context, provider, providerName, model, taskId, progressCallback);
        }
      } else {
        output = await this.executeAgent(agent, context, provider, providerName, model, taskId, progressCallback);
      }

      // Save to database
      await this.saveAgentOutput(taskId, output);

      // Emit agent complete event
      progressCallback?.({
        type: output.status === 'success' ? 'agent_complete' : 'agent_error',
        taskId,
        agentRole: agent.role,
        data: {
          status: output.status,
          executionTime: output.executionTime,
          hasArtifacts: !!output.artifacts && output.artifacts.length > 0,
          error: output.error,
          inputTokens: output.inputTokens,
          outputTokens: output.outputTokens,
          totalTokens: output.totalTokens,
          estimatedCost: output.estimatedCost,
        },
      });

      // Add to context for next agents
      context.previousOutputs.set(agent.role, output);
      outputs.push(output);
    }

    return outputs;
  }

  /**
   * Execute agents in parallel (grouped by dependency level)
   */
  private async executeParallel(
    taskId: string,
    agents: AgentDefinition[],
    taskDescription: string,
    provider: AIProvider,
    providerName: string,
    model?: string,
    progressCallback?: ProgressCallback,
    githubContext?: ExecuteTaskDto['githubContext'],
    existingOutputs?: AgentOutput[], // For review/continuation tasks
    isReviewTask: boolean = false
  ): Promise<AgentOutput[]> {
    // Pre-populate context with existing outputs if this is a review/continuation
    const previousOutputsMap = new Map<string, AgentOutput>();
    if (existingOutputs && existingOutputs.length > 0) {
      console.log(`[Orchestrator] Pre-populating context with ${existingOutputs.length} existing outputs`);
      // Only take the LAST output for each agent role for previousOutputs map
      existingOutputs.forEach(output => {
        previousOutputsMap.set(output.agentRole, output);
      });
    }

    const context: AgentContext = {
      taskDescription,
      previousOutputs: previousOutputsMap,
      teamComposition: agents.map((a) => a.role),
      githubFiles: githubContext?.selectedFiles.map(f => ({
        path: f.path,
        content: f.content,
        language: f.language,
        size: f.size,
        tokens: f.tokens,
      })),
      allPreviousOutputs: existingOutputs || [], // Pass ALL outputs for agents to see their history
      isReviewTask,
    };

    const allOutputs: AgentOutput[] = [];

    // Group agents by dependency level
    const levels = getAgentsByDependencies(agents);

    for (const levelAgents of levels) {
      console.log(`Executing level with ${levelAgents.length} agent(s) in parallel`);

      // Emit agent start events for all agents in this level
      for (const agent of levelAgents) {
        progressCallback?.({
          type: 'agent_start',
          taskId,
          agentRole: agent.role,
          data: {
            agentName: agent.name,
            agentDescription: agent.description,
          },
        });
      }

      // Execute all agents in this level in parallel
      const promises = levelAgents.map(async (agent) => {
        // Choose execution method based on githubContext availability
        if (githubContext && provider.executeWithTools) {
          const toolContext: GitHubToolContext = {
            githubToken: '',
            owner: githubContext.repository.owner,
            repo: githubContext.repository.repo,
            branch: githubContext.branch,
          };

          // Get stored GitHub token
          const githubTokenService = await import('../github-token.service');
          const tokenService = new githubTokenService.GitHubTokenService();

          try {
            const storedToken = await tokenService.getDecryptedToken((await prisma.task.findUnique({ where: { id: taskId } }))?.userId || '');
            if (storedToken) {
              toolContext.githubToken = storedToken;
              return this.executeAgentWithTools(agent, context, provider, providerName, toolContext, model, taskId, progressCallback);
            } else {
              console.log('[Orchestrator] No GitHub token found, falling back to normal execution');
              return this.executeAgent(agent, context, provider, providerName, model, taskId, progressCallback);
            }
          } catch (error) {
            console.error('[Orchestrator] Error getting GitHub token, falling back:', error);
            return this.executeAgent(agent, context, provider, providerName, model, taskId, progressCallback);
          }
        } else {
          return this.executeAgent(agent, context, provider, providerName, model, taskId, progressCallback);
        }
      });

      const levelOutputs = await Promise.all(promises);

      // Save all outputs to database
      await Promise.all(
        levelOutputs.map((output) => this.saveAgentOutput(taskId, output))
      );

      // Emit agent complete events
      for (const output of levelOutputs) {
        progressCallback?.({
          type: output.status === 'success' ? 'agent_complete' : 'agent_error',
          taskId,
          agentRole: output.agentRole,
          data: {
            status: output.status,
            executionTime: output.executionTime,
            hasArtifacts: !!output.artifacts && output.artifacts.length > 0,
            error: output.error,
            inputTokens: output.inputTokens,
            outputTokens: output.outputTokens,
            totalTokens: output.totalTokens,
            estimatedCost: output.estimatedCost,
          },
        });
      }

      // Update context with outputs from this level
      for (const output of levelOutputs) {
        context.previousOutputs.set(output.agentRole, output);
        allOutputs.push(output);
      }
    }

    return allOutputs;
  }

  /**
   * Execute a single agent
   */
  private async executeAgent(
    agent: AgentDefinition,
    context: AgentContext,
    provider: AIProvider,
    providerName: string,
    model?: string,
    taskId?: string,
    progressCallback?: ProgressCallback
  ): Promise<AgentOutput> {
    const startTime = Date.now();

    try {
      // Build prompt with context
      const prompt = ContextBuilder.buildPrompt(agent, context);

      // Emit progress event
      if (taskId) {
        progressCallback?.({
          type: 'agent_progress',
          taskId,
          agentRole: agent.role,
          data: { message: 'Analyzing and generating response...' },
        });
      }

      // Execute with AI provider - with continuation support
      // Use high token limit to allow complete outputs (16384 is max for most models)
      let fullContent = '';
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let continuationCount = 0;
      const MAX_CONTINUATIONS = 5; // Prevent infinite loops

      let currentPrompt = prompt;
      let finishReason: string | undefined;

      do {
        if (continuationCount > 0) {
          console.log(`[Orchestrator] Agent ${agent.role} reached token limit, continuing (${continuationCount}/${MAX_CONTINUATIONS})...`);

          // For continuation, ask to continue from where it left off
          currentPrompt = `Continue your previous response from where you left off. Do not repeat what you already wrote, just continue:\n\n${fullContent}\n\n[CONTINUE FROM HERE]`;

          if (taskId) {
            progressCallback?.({
              type: 'agent_progress',
              taskId,
              agentRole: agent.role,
              data: { message: `Continuing response (part ${continuationCount + 1})...` },
            });
          }
        }

        const response = await provider.execute(currentPrompt, agent.systemPrompt, {
          model,
          temperature: 0.7,
          maxTokens: 16384,
        });

        fullContent += response.content;
        totalInputTokens += response.usage.inputTokens;
        totalOutputTokens += response.usage.outputTokens;
        finishReason = response.finishReason;

        continuationCount++;

        // Continue if we hit the token limit and haven't exceeded max continuations
      } while (finishReason === 'length' && continuationCount < MAX_CONTINUATIONS);

      if (finishReason === 'length') {
        console.warn(`[Orchestrator] Agent ${agent.role} still truncated after ${MAX_CONTINUATIONS} continuations`);
      }

      if (continuationCount > 1) {
        console.log(`[Orchestrator] Agent ${agent.role} completed after ${continuationCount} continuation(s)`);
      }

      // Parse artifacts from full output
      const parsedArtifacts = ContextBuilder.parseArtifacts(fullContent);

      // Validate artifact paths against repository structure
      const { validArtifacts: pathValidatedArtifacts, warnings: pathWarnings } = ContextBuilder.validateArtifactPaths(
        parsedArtifacts,
        context.githubFiles
      );

      if (pathWarnings.length > 0) {
        console.error(`[Orchestrator] Agent ${agent.role} created artifacts with INVALID paths:`);
        pathWarnings.forEach(warning => console.error(`  ${warning}`));
        console.error(`[Orchestrator] ${parsedArtifacts.length - pathValidatedArtifacts.length} artifacts were REJECTED due to invalid paths`);
      }

      // Validate artifact completeness (detect content loss)
      const { validArtifacts: artifacts, warnings: completenessWarnings } = ContextBuilder.validateArtifactCompleteness(
        pathValidatedArtifacts,
        context.githubFiles
      );

      if (completenessWarnings.length > 0) {
        console.error(`[Orchestrator] Agent ${agent.role} created artifacts with CONTENT LOSS:`);
        completenessWarnings.forEach(warning => console.error(`  ${warning}`));
        console.error(`[Orchestrator] ${pathValidatedArtifacts.length - artifacts.length} artifacts were REJECTED due to content loss`);
      }

      console.log(`[Orchestrator] Agent ${agent.role} created ${artifacts.length} valid artifacts:`, artifacts.map(a => a.filename));

      const executionTime = Date.now() - startTime;

      // Calculate cost
      const actualModel = model || this.getDefaultModel(providerName);
      const estimatedCost = PricingService.calculateCost(
        providerName,
        actualModel,
        totalInputTokens,
        totalOutputTokens
      );

      return {
        agentRole: agent.role,
        content: fullContent,
        artifacts: artifacts.length > 0 ? artifacts : undefined,
        status: 'success',
        executionTime,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        estimatedCost,
        createdAt: new Date(),
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      console.error(`Agent ${agent.role} execution error:`, error.message);

      return {
        agentRole: agent.role,
        content: '',
        status: 'error',
        error: error.message,
        executionTime,
        createdAt: new Date(),
      };
    }
  }

  /**
   * Execute agent with GitHub tools support (function calling)
   */
  private async executeAgentWithTools(
    agent: AgentDefinition,
    context: AgentContext,
    provider: AIProvider,
    providerName: string,
    githubContext: GitHubToolContext,
    model?: string,
    taskId?: string,
    progressCallback?: ProgressCallback
  ): Promise<AgentOutput> {
    const startTime = Date.now();
    const startTimeISO = new Date().toISOString();
    const MAX_ITERATIONS = 10;

    try {
      // Initialize GitHub tools service
      const githubTools = new GitHubToolsService(githubContext);

      // Get tools based on provider
      const tools = providerName.toLowerCase() === 'anthropic'
        ? getAnthropicTools()
        : getOpenAITools();

      // Check if provider supports tools
      if (!provider.executeWithTools) {
        console.log(`[Orchestrator] Provider ${providerName} doesn't support tools, falling back to normal execution`);
        return this.executeAgent(agent, context, provider, providerName, model, taskId, progressCallback);
      }

      // Build initial prompt
      const prompt = ContextBuilder.buildPrompt(agent, context);

      // Initialize conversation messages
      const messages: ProviderMessage[] = [
        { role: 'user', content: prompt },
      ];

      let iteration = 0;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let finalContent = '';

      // Initialize execution log
      const executionSteps: any[] = [];
      executionSteps.push({
        timestamp: new Date().toISOString(),
        type: 'message',
        content: `Agent ${agent.role} started execution with tools`
      });

      // Function calling loop
      while (iteration < MAX_ITERATIONS) {
        iteration++;
        console.log(`[Orchestrator] Tool calling iteration ${iteration}/${MAX_ITERATIONS}`);

        // Execute with tools
        // Use high token limit to allow complete outputs
        const response = await provider.executeWithTools(
          messages,
          agent.systemPrompt,
          tools,
          { model, temperature: 0.7, maxTokens: 16384 }
        );

        totalInputTokens += response.usage.inputTokens;
        totalOutputTokens += response.usage.outputTokens;

        // Accumulate content
        if (response.content) {
          finalContent += response.content;

          // Log thinking/content generation
          executionSteps.push({
            timestamp: new Date().toISOString(),
            type: 'thinking',
            content: response.content.length > 500 ? response.content.substring(0, 500) + '...[truncated]' : response.content
          });
        }

        // Check if there are tool calls
        if (!response.toolCalls || response.toolCalls.length === 0) {
          // No more tool calls
          // But check if we hit token limit - if so, continue the response
          if (response.finishReason === 'length') {
            console.log(`[Orchestrator] Agent ${agent.role} hit token limit without tool calls, requesting continuation...`);

            // Add a continuation message
            messages.push({
              role: 'assistant',
              content: response.content,
            });
            messages.push({
              role: 'user',
              content: 'Continue your previous response from where you left off. Do not repeat what you already wrote, just continue.',
            });

            if (taskId) {
              progressCallback?.({
                type: 'agent_progress',
                taskId,
                agentRole: agent.role,
                data: { message: `Continuing response (iteration ${iteration})...` },
              });
            }

            // Continue to next iteration to get more content
            continue;
          }

          // Finished naturally
          console.log(`[Orchestrator] No tool calls, finishing`);
          break;
        }

        // Execute tool calls
        console.log(`[Orchestrator] Executing ${response.toolCalls.length} tool calls`);
        const toolResults: ToolResult[] = [];

        for (const toolCall of response.toolCalls) {
          console.log(`[Orchestrator] Calling tool: ${toolCall.name} with args:`, toolCall.arguments);

          // Log tool call
          executionSteps.push({
            timestamp: new Date().toISOString(),
            type: 'tool_call',
            content: `Calling ${toolCall.name}`,
            toolName: toolCall.name,
            toolInput: toolCall.arguments
          });

          // Emit tool call event
          if (taskId) {
            progressCallback?.({
              type: 'tool_call',
              taskId,
              agentRole: agent.role,
              data: {
                toolName: toolCall.name,
                arguments: toolCall.arguments,
              },
            });
          }

          try {
            let result: any;

            switch (toolCall.name) {
              case 'get_github_file':
                result = await githubTools.getFile(toolCall.arguments.path);
                break;

              case 'list_github_directory':
                result = await githubTools.listDirectory(toolCall.arguments.path);
                break;

              case 'search_github_repo':
                result = await githubTools.search(
                  toolCall.arguments.query,
                  toolCall.arguments.type
                );
                break;

              case 'get_config_files':
                result = await githubTools.getConfigFiles();
                break;

              default:
                result = { error: `Unknown tool: ${toolCall.name}` };
                console.error(`[Orchestrator] Unknown tool: ${toolCall.name}`);
            }

            toolResults.push({
              toolCallId: toolCall.id,
              result,
              isError: false,
            });

            // Log tool result (truncate large results)
            const resultString = JSON.stringify(result);
            executionSteps.push({
              timestamp: new Date().toISOString(),
              type: 'tool_result',
              content: `Result from ${toolCall.name}`,
              toolName: toolCall.name,
              toolOutput: resultString.length > 500 ? resultString.substring(0, 500) + '...[truncated]' : result
            });

            console.log(`[Orchestrator] Tool ${toolCall.name} executed successfully`);
          } catch (error: any) {
            console.error(`[Orchestrator] Tool ${toolCall.name} error:`, error.message);

            // Log tool error
            executionSteps.push({
              timestamp: new Date().toISOString(),
              type: 'tool_result',
              content: `Error from ${toolCall.name}`,
              toolName: toolCall.name,
              error: error.message
            });

            toolResults.push({
              toolCallId: toolCall.id,
              result: { error: error.message },
              isError: true,
            });
          }
        }

        // Add assistant message with tool calls to conversation
        messages.push({
          role: 'assistant',
          content: response.content,
          toolCalls: response.toolCalls,
        });

        // Add tool results to conversation
        for (const toolResult of toolResults) {
          messages.push({
            role: 'tool',
            content: JSON.stringify(toolResult.result),
            toolCallId: toolResult.toolCallId,
          });
        }

        // Emit progress
        if (taskId) {
          progressCallback?.({
            type: 'agent_progress',
            taskId,
            agentRole: agent.role,
            data: { message: `Processing tool results (iteration ${iteration})...` },
          });
        }
      }

      if (iteration >= MAX_ITERATIONS) {
        console.warn(`[Orchestrator] Max iterations reached (${MAX_ITERATIONS})`);
      }

      // Parse artifacts from final content
      const parsedArtifacts = ContextBuilder.parseArtifacts(finalContent);

      // Validate artifact paths against repository structure
      const { validArtifacts: pathValidatedArtifacts, warnings: pathWarnings } = ContextBuilder.validateArtifactPaths(
        parsedArtifacts,
        context.githubFiles
      );

      if (pathWarnings.length > 0) {
        console.error(`[Orchestrator] Agent ${agent.role} (with tools) created artifacts with INVALID paths:`);
        pathWarnings.forEach(warning => console.error(`  ${warning}`));
        console.error(`[Orchestrator] ${parsedArtifacts.length - pathValidatedArtifacts.length} artifacts were REJECTED due to invalid paths`);
      }

      // Validate artifact completeness (detect content loss)
      const { validArtifacts: artifacts, warnings: completenessWarnings } = ContextBuilder.validateArtifactCompleteness(
        pathValidatedArtifacts,
        context.githubFiles
      );

      if (completenessWarnings.length > 0) {
        console.error(`[Orchestrator] Agent ${agent.role} (with tools) created artifacts with CONTENT LOSS:`);
        completenessWarnings.forEach(warning => console.error(`  ${warning}`));
        console.error(`[Orchestrator] ${pathValidatedArtifacts.length - artifacts.length} artifacts were REJECTED due to content loss`);
      }

      console.log(`[Orchestrator] Agent ${agent.role} (with tools) created ${artifacts.length} valid artifacts:`, artifacts.map(a => a.filename));

      const executionTime = Date.now() - startTime;

      // Calculate cost
      const actualModel = model || this.getDefaultModel(providerName);
      const estimatedCost = PricingService.calculateCost(
        providerName,
        actualModel,
        totalInputTokens,
        totalOutputTokens
      );

      // Build execution log summary
      const executionLog = {
        steps: executionSteps,
        summary: {
          totalSteps: executionSteps.length,
          totalToolCalls: executionSteps.filter((s: any) => s.type === 'tool_call').length,
          startTime: startTimeISO,
          endTime: new Date().toISOString()
        }
      };

      return {
        agentRole: agent.role,
        content: finalContent,
        artifacts: artifacts.length > 0 ? artifacts : undefined,
        status: 'success',
        executionTime,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        estimatedCost,
        executionLog,
        createdAt: new Date(),
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      console.error(`Agent ${agent.role} execution with tools error:`, error.message);

      return {
        agentRole: agent.role,
        content: '',
        status: 'error',
        error: error.message,
        executionTime,
        createdAt: new Date(),
      };
    }
  }

  /**
   * Validate task completion and execute completion round if needed
   */
  private async validateAndCompleteTask(
    taskId: string,
    originalAgents: AgentDefinition[],
    outputs: AgentOutput[],
    taskDescription: string,
    provider: AIProvider,
    providerName: string,
    githubContext: ExecuteTaskDto['githubContext'],
    model?: string,
    progressCallback?: ProgressCallback
  ): Promise<{ validationOutput: AgentOutput; additionalOutputs: AgentOutput[] }> {
    // Get the validator agent
    const validatorAgent = getAgentDefinition('task-completion-validator');
    if (!validatorAgent) {
      console.error('[Orchestrator] Task Completion Validator not found');
      return { validationOutput: null as any, additionalOutputs: [] };
    }

    // Build context with all previous outputs
    const context: AgentContext = {
      taskDescription,
      previousOutputs: new Map(outputs.map(o => [o.agentRole, o])),
      teamComposition: originalAgents.map(a => a.role),
      githubFiles: githubContext?.selectedFiles.map(f => ({
        path: f.path,
        content: f.content,
        language: f.language,
        size: f.size,
        tokens: f.tokens,
      })),
    };

    // Emit validation start event
    progressCallback?.({
      type: 'agent_start',
      taskId,
      agentRole: validatorAgent.role,
      data: {
        agentName: validatorAgent.name,
        agentDescription: 'Validating task completeness...',
      },
    });

    // Execute validator with GitHub tools
    const toolContext: GitHubToolContext = {
      githubToken: '',
      owner: githubContext!.repository.owner,
      repo: githubContext!.repository.repo,
      branch: githubContext!.branch,
    };

    // Get stored GitHub token
    const githubTokenService = await import('../github-token.service');
    const tokenService = new githubTokenService.GitHubTokenService();

    try {
      const storedToken = await tokenService.getDecryptedToken((await prisma.task.findUnique({ where: { id: taskId } }))?.userId || '');
      if (storedToken) {
        toolContext.githubToken = storedToken;
      }
    } catch (error) {
      console.error('[Orchestrator] Error getting GitHub token for validator:', error);
    }

    // Run validator
    const validationOutput = await this.executeAgentWithTools(
      validatorAgent,
      context,
      provider,
      providerName,
      toolContext,
      model,
      taskId,
      progressCallback
    );

    // Save validation output
    await this.saveAgentOutput(taskId, validationOutput);

    // Emit validation complete event
    progressCallback?.({
      type: 'agent_complete',
      taskId,
      agentRole: validatorAgent.role,
      data: {
        agentName: validatorAgent.name,
        status: validationOutput.status,
        executionTime: validationOutput.executionTime,
        hasArtifacts: !!validationOutput.artifacts,
        inputTokens: validationOutput.inputTokens,
        outputTokens: validationOutput.outputTokens,
        totalTokens: validationOutput.totalTokens,
        estimatedCost: validationOutput.estimatedCost,
      },
    });

    // Parse validation result
    let validationResult: any;
    try {
      // Extract JSON from markdown code block if present
      const jsonMatch = validationOutput.content.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonContent = jsonMatch ? jsonMatch[1] : validationOutput.content;
      validationResult = JSON.parse(jsonContent);
      console.log('[Orchestrator] Validation result:', validationResult);
    } catch (error) {
      console.error('[Orchestrator] Failed to parse validation result:', error);
      return { validationOutput, additionalOutputs: [] };
    }

    // Check if task is incomplete
    if (validationResult.status === 'complete' || validationResult.completionPercentage === 100) {
      console.log('[Orchestrator] ✅ Task 100% complete, no completion round needed');
      return { validationOutput, additionalOutputs: [] };
    }

    console.log(`[Orchestrator] ⚠️ Task ${validationResult.completionPercentage}% complete, running completion round...`);

    // Execute completion round
    const additionalOutputs = await this.executeCompletionRound(
      taskId,
      originalAgents,
      outputs,
      validationResult,
      taskDescription,
      provider,
      providerName,
      githubContext,
      model,
      progressCallback
    );

    // Run validator again after completion round to verify everything is now complete
    if (additionalOutputs.length > 0) {
      console.log('[Orchestrator] Running final validation after completion round...');

      // Combine all outputs (original + completion)
      const allOutputs = [...outputs, ...additionalOutputs];

      // Build updated context with all outputs
      const finalContext: AgentContext = {
        taskDescription,
        previousOutputs: new Map(allOutputs.map(o => [o.agentRole, o])),
        teamComposition: originalAgents.map(a => a.role),
        githubFiles: githubContext?.selectedFiles.map(f => ({
          path: f.path,
          content: f.content,
          language: f.language,
          size: f.size,
          tokens: f.tokens,
        })),
      };

      // Emit final validation start
      progressCallback?.({
        type: 'agent_start',
        taskId,
        agentRole: validatorAgent.role,
        data: {
          agentName: `${validatorAgent.name} (Final Check)`,
          agentDescription: 'Final validation after completion round...',
        },
      });

      // Execute final validation
      const finalValidationOutput = await this.executeAgentWithTools(
        validatorAgent,
        finalContext,
        provider,
        providerName,
        toolContext,
        model,
        taskId,
        progressCallback
      );

      // Save final validation output
      await this.saveAgentOutput(taskId, finalValidationOutput);

      // Emit final validation complete
      progressCallback?.({
        type: 'agent_complete',
        taskId,
        agentRole: validatorAgent.role,
        data: {
          agentName: `${validatorAgent.name} (Final Check)`,
          status: finalValidationOutput.status,
          executionTime: finalValidationOutput.executionTime,
          hasArtifacts: !!finalValidationOutput.artifacts,
          inputTokens: finalValidationOutput.inputTokens,
          outputTokens: finalValidationOutput.outputTokens,
          totalTokens: finalValidationOutput.totalTokens,
          estimatedCost: finalValidationOutput.estimatedCost,
        },
      });

      console.log('[Orchestrator] ✅ Final validation completed');

      // Return both validation outputs
      return { validationOutput: finalValidationOutput, additionalOutputs };
    }

    return { validationOutput, additionalOutputs };
  }

  /**
   * Execute completion round to create missing files
   */
  private async executeCompletionRound(
    taskId: string,
    originalAgents: AgentDefinition[],
    existingOutputs: AgentOutput[],
    validationResult: any,
    taskDescription: string,
    provider: AIProvider,
    providerName: string,
    githubContext: ExecuteTaskDto['githubContext'],
    model?: string,
    progressCallback?: ProgressCallback
  ): Promise<AgentOutput[]> {
    console.log('[Orchestrator] Starting completion round...');

    if (!validationResult.recommendations || validationResult.recommendations.length === 0) {
      console.log('[Orchestrator] No specific recommendations, skipping completion round');
      return [];
    }

    console.log('[Orchestrator] Recommendations:', JSON.stringify(validationResult.recommendations));

    // Build completion tasks from recommendations
    const completionTasks = this.parseCompletionTasks(validationResult.recommendations, originalAgents);

    if (completionTasks.length === 0) {
      console.log('[Orchestrator] No actionable completion tasks found');
      return [];
    }

    const completionOutputs: AgentOutput[] = [];

    // Execute completion tasks
    for (const task of completionTasks) {
      console.log(`[Orchestrator] Completion task: ${task.agent.name} - ${task.description}`);

      // Emit agent start event
      progressCallback?.({
        type: 'agent_start',
        taskId,
        agentRole: task.agent.role,
        data: {
          agentName: `${task.agent.name} (Completion)`,
          agentDescription: task.description,
        },
      });

      // Build focused context for completion
      // Include ALL previous outputs so agent can see its own previous work
      const context: AgentContext = {
        taskDescription: `${taskDescription}\n\n## Completion Task\n${task.description}\n\n## Missing Files\n${task.missingFiles.join('\n')}`,
        previousOutputs: new Map(existingOutputs.map(o => [o.agentRole, o])),
        teamComposition: originalAgents.map(a => a.role),
        githubFiles: githubContext?.selectedFiles.map(f => ({
          path: f.path,
          content: f.content,
          language: f.language,
          size: f.size,
          tokens: f.tokens,
        })),
        allPreviousOutputs: existingOutputs, // Pass all outputs including multiple from same agent
      };

      // Execute with tools
      const toolContext: GitHubToolContext = {
        githubToken: '',
        owner: githubContext!.repository.owner,
        repo: githubContext!.repository.repo,
        branch: githubContext!.branch,
      };

      const githubTokenService = await import('../github-token.service');
      const tokenService = new githubTokenService.GitHubTokenService();

      try {
        const storedToken = await tokenService.getDecryptedToken((await prisma.task.findUnique({ where: { id: taskId } }))?.userId || '');
        if (storedToken) {
          toolContext.githubToken = storedToken;
        }
      } catch (error) {
        console.error('[Orchestrator] Error getting GitHub token:', error);
      }

      const output = await this.executeAgentWithTools(
        task.agent,
        context,
        provider,
        providerName,
        toolContext,
        model,
        taskId,
        progressCallback
      );

      // Save output
      await this.saveAgentOutput(taskId, output);

      // Emit completion
      progressCallback?.({
        type: 'agent_complete',
        taskId,
        agentRole: task.agent.role,
        data: {
          agentName: `${task.agent.name} (Completion)`,
          status: output.status,
          executionTime: output.executionTime,
          hasArtifacts: !!output.artifacts,
          inputTokens: output.inputTokens,
          outputTokens: output.outputTokens,
          totalTokens: output.totalTokens,
          estimatedCost: output.estimatedCost,
        },
      });

      completionOutputs.push(output);
    }

    console.log(`[Orchestrator] Completion round finished: ${completionOutputs.length} additional outputs`);
    return completionOutputs;
  }

  /**
   * Parse validation recommendations into actionable completion tasks
   */
  private parseCompletionTasks(
    recommendations: any[],
    originalAgents: AgentDefinition[]
  ): Array<{ agent: AgentDefinition; description: string; missingFiles: string[] }> {
    const tasks: Array<{ agent: AgentDefinition; description: string; missingFiles: string[] }> = [];

    console.log('[Orchestrator] Parsing recommendations:', recommendations);

    for (const recommendation of recommendations) {
      // Extract string from object if needed
      let recommendationStr: string;
      if (typeof recommendation === 'string') {
        recommendationStr = recommendation;
      } else if (typeof recommendation === 'object') {
        // Try to extract the action/recommendation text from object
        recommendationStr = recommendation.action || recommendation.recommendation || recommendation.details || JSON.stringify(recommendation);
      } else {
        console.warn('[Orchestrator] Invalid recommendation type:', typeof recommendation);
        continue;
      }

      console.log('[Orchestrator] Processing recommendation:', recommendationStr);

      // Try multiple parsing patterns
      let match = recommendationStr.match(/^(\w+[\s\w-]*?)\s+(?:should|needs to|must)\s+(.+)$/i);

      // Alternative pattern: "Create X in Y" or "Agent: description"
      if (!match) {
        match = recommendationStr.match(/^(\w+[\s\w-]*?):\s*(.+)$/i);
      }

      if (!match) {
        console.warn('[Orchestrator] Could not parse recommendation:', recommendationStr);
        continue;
      }

      const agentName = match[1].trim();
      const description = match[2].trim();

      console.log('[Orchestrator] Extracted agent name:', agentName, 'description:', description);

      // Find agent by name or role (case-insensitive, flexible matching)
      const agent = originalAgents.find(a => {
        const aNameLower = a.name.toLowerCase();
        const aRoleLower = a.role.toLowerCase();
        const searchLower = agentName.toLowerCase();

        // Try exact matches first
        if (aNameLower === searchLower || aRoleLower === searchLower) return true;

        // Try partial matches
        if (aNameLower.includes(searchLower) || searchLower.includes(aNameLower)) return true;
        if (aRoleLower.includes(searchLower) || searchLower.includes(aRoleLower)) return true;

        // Try without spaces/hyphens
        const aNameClean = aNameLower.replace(/[\s-]/g, '');
        const searchClean = searchLower.replace(/[\s-]/g, '');
        if (aNameClean.includes(searchClean) || searchClean.includes(aNameClean)) return true;

        return false;
      });

      if (!agent) {
        console.warn('[Orchestrator] Agent not found for recommendation:', agentName);
        console.warn('[Orchestrator] Available agents:', originalAgents.map(a => `${a.name} (${a.role})`));
        continue;
      }

      console.log('[Orchestrator] Matched agent:', agent.name, agent.role);

      // Extract file paths from description
      const fileMatch = description.match(/(?:create|implement|add|build)\s+([^\s,]+\.\w+)/gi);
      const missingFiles = fileMatch ? fileMatch.map(f => f.replace(/^(?:create|implement|add|build)\s+/i, '')) : [];

      console.log('[Orchestrator] Extracted files:', missingFiles);

      tasks.push({
        agent,
        description: `Complete missing implementation: ${description}`,
        missingFiles,
      });
    }

    console.log('[Orchestrator] Created', tasks.length, 'completion tasks');
    return tasks;
  }

  /**
   * Get default model for a provider
   */
  private getDefaultModel(provider: string): string {
    switch (provider.toLowerCase()) {
      case 'anthropic':
        return 'claude-sonnet-4-5-20250929';
      case 'openai':
        return 'gpt-4-turbo';
      case 'google':
        return 'gemini-pro';
      default:
        return '';
    }
  }

  /**
   * Detect if Product Owner has defined multiple phases
   */
  private detectPhases(outputs: AgentOutput[]): {
    hasNextPhase: boolean;
    nextPhaseDescription: string | null;
    currentPhase: string | null;
  } {
    // Look for Product Owner's output
    const productOwnerOutput = outputs.find(o => o.agentRole === 'product-owner');

    if (!productOwnerOutput || !productOwnerOutput.content) {
      return { hasNextPhase: false, nextPhaseDescription: null, currentPhase: null };
    }

    const content = productOwnerOutput.content;

    // Detect phase markers
    const phaseRegex = /##\s*[🚀📋🎯]?\s*PHASE\s+(\d+)/gi;
    const phases: number[] = [];
    let match;

    while ((match = phaseRegex.exec(content)) !== null) {
      const phaseNum = parseInt(match[1]);
      if (!phases.includes(phaseNum)) {
        phases.push(phaseNum);
      }
    }

    if (phases.length === 0) {
      // No phases detected
      return { hasNextPhase: false, nextPhaseDescription: null, currentPhase: null };
    }

    // Sort phases
    phases.sort((a, b) => a - b);

    // Current phase is the first one (lowest number)
    const currentPhase = `Phase ${phases[0]}`;

    // Check if there are more phases
    const hasNextPhase = phases.length > 1 || content.includes('PHASE 2') || content.includes('Phase 2');

    // Extract next phase description if available
    let nextPhaseDescription: string | null = null;

    if (hasNextPhase) {
      // Try to extract Phase Summary section
      const summaryRegex = /##\s*📊\s*PHASE SUMMARY[\s\S]*?Future Phases.*?:\s*([\s\S]*?)(?=\n##|\*\*To continue|\`\`\`|$)/i;
      const summaryMatch = content.match(summaryRegex);

      if (summaryMatch) {
        nextPhaseDescription = summaryMatch[1].trim();
      } else {
        // Fallback: look for Phase 2 section
        const phase2Regex = /##\s*[📋🎯]?\s*PHASE\s+2[^\n]*\n([\s\S]*?)(?=\n##|$)/i;
        const phase2Match = content.match(phase2Regex);

        if (phase2Match) {
          // Extract first paragraph or first 500 chars
          const description = phase2Match[1].trim();
          nextPhaseDescription = description.length > 500
            ? description.substring(0, 500) + '...'
            : description;
        } else {
          nextPhaseDescription = 'Additional phases defined. Check Product Owner output for details.';
        }
      }
    }

    console.log('[Orchestrator] Phase detection:', {
      detectedPhases: phases,
      currentPhase,
      hasNextPhase,
      nextPhaseDescription: nextPhaseDescription?.substring(0, 100) + '...'
    });

    return {
      hasNextPhase,
      nextPhaseDescription,
      currentPhase
    };
  }

  /**
   * Validate generated files for syntax and structural errors
   */
  private validateGeneratedFiles(outputs: AgentOutput[]): string[] {
    const { ValidationToolsService } = require('./validation-tools.service');
    const errors: string[] = [];

    for (const output of outputs) {
      if (output.artifacts) {
        for (const artifact of output.artifacts) {
          const fileType = ValidationToolsService.detectFileType(artifact.filename);

          // Validate all file types (including html and generic for truncation check)
          const validation = ValidationToolsService.validateFileSyntax(
            artifact.filename,
            fileType,
            artifact.content
          );

          if (!validation.valid) {
            errors.push(
              `File ${artifact.filename} (${fileType}): ${validation.errors.join(', ')}`
            );
          }

          if (validation.warnings.length > 0) {
            console.warn(`[Validation] Warnings for ${artifact.filename}:`, validation.warnings);
          }
        }
      }
    }

    return errors;
  }

  /**
   * Save agent output to database
   */
  private async saveAgentOutput(taskId: string, output: AgentOutput): Promise<void> {
    await prisma.agentOutput.create({
      data: {
        taskId,
        agentRole: output.agentRole,
        content: output.content,
        artifacts: output.artifacts as any,
        status: output.status,
        error: output.error,
        executionTime: output.executionTime,
        inputTokens: output.inputTokens,
        outputTokens: output.outputTokens,
        totalTokens: output.totalTokens,
        estimatedCost: output.estimatedCost,
        executionLog: output.executionLog as any,
      },
    });
  }

  /**
   * Execute manual completion round (triggered by user)
   */
  async executeManualCompletionRound(
    taskId: string,
    providerName: string,
    model: string | undefined,
    apiKey: string,
    userId: string,
    progressCallback?: ProgressCallback
  ): Promise<void> {
    console.log('[Orchestrator] Starting manual completion round for task:', taskId);

    // Get task with all outputs
    const task = await this.getTask(taskId, userId);
    if (!task) {
      throw new Error('Task not found');
    }

    if (!task.githubContext) {
      throw new Error('Task does not have GitHub context');
    }

    // Get original agents
    const originalAgents = task.selectedAgents
      .map((role) => getAgentDefinition(role))
      .filter((agent): agent is AgentDefinition => agent !== undefined);

    // Create provider
    const provider = ProviderFactory.createProvider(providerName, apiKey);

    // Get all existing outputs
    const existingOutputs = task.agentOutputs.map(output => ({
      agentRole: output.agentRole,
      content: output.content,
      artifacts: output.artifacts as any,
      status: output.status as 'success' | 'error',
      error: output.error || undefined,
      executionTime: output.executionTime || 0,
      inputTokens: output.inputTokens || 0,
      outputTokens: output.outputTokens || 0,
      totalTokens: output.totalTokens || 0,
      estimatedCost: output.estimatedCost || 0,
      createdAt: new Date(output.createdAt),
    }));

    // Run validator to get current state
    await this.validateAndCompleteTask(
      taskId,
      originalAgents,
      existingOutputs as any,
      task.description,
      provider,
      providerName,
      task.githubContext as any,
      model,
      progressCallback
    );

    console.log('[Orchestrator] Manual completion round finished');
  }

  /**
   * Topological sort of agents by dependencies
   */
  private topologicalSort(agents: AgentDefinition[]): AgentDefinition[] {
    const sorted: AgentDefinition[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();

    const visit = (agent: AgentDefinition) => {
      if (temp.has(agent.role)) {
        throw new Error(`Circular dependency detected: ${agent.role}`);
      }
      if (visited.has(agent.role)) {
        return;
      }

      temp.add(agent.role);

      // Visit dependencies first
      for (const depRole of agent.dependencies) {
        const depAgent = agents.find((a) => a.role === depRole);
        if (depAgent) {
          visit(depAgent);
        }
      }

      temp.delete(agent.role);
      visited.add(agent.role);
      sorted.push(agent);
    };

    for (const agent of agents) {
      if (!visited.has(agent.role)) {
        visit(agent);
      }
    }

    return sorted;
  }

  /**
   * Generate a short title from task description
   */
  private generateTaskTitle(description: string): string {
    // Take first 50 characters or first line
    const firstLine = description.split('\n')[0];
    return firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine;
  }

  /**
   * Get task by ID with outputs
   */
  async getTask(taskId: string, userId: string) {
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        userId,
      },
      include: {
        agentOutputs: true,
      },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    return task;
  }

  /**
   * Get user's task history
   */
  async getUserTasks(userId: string, limit: number = 20) {
    const tasks = await prisma.task.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        agentOutputs: {
          select: {
            id: true,
            agentRole: true,
            status: true,
            executionTime: true,
          },
        },
      },
    });

    return tasks;
  }
}

import { AgentContext, AgentDefinition, AgentOutput } from '../../types/agent.types';

export class ContextBuilder {
  /**
   * Build a prompt for an agent including context from previous agents
   */
  static buildPrompt(agent: AgentDefinition, context: AgentContext): string {
    let prompt = `# Task Description\n\n${context.taskDescription}\n\n`;

    // Add GitHub repository context if available
    if (context.githubFiles && context.githubFiles.length > 0) {
      // Extract folder structure FIRST
      const folders = new Set<string>();
      const rootFolders = new Set<string>();
      context.githubFiles.forEach(file => {
        const parts = file.path.split('/');
        // Get root folder (first part of path)
        if (parts.length > 1) {
          rootFolders.add(parts[0]);
        }
        // Get all parent folders
        for (let i = 1; i < parts.length; i++) {
          folders.add(parts.slice(0, i).join('/'));
        }
      });

      // CRITICAL: Show structure rules FIRST, before anything else
      prompt += `# 🚨 CRITICAL - REPOSITORY STRUCTURE RULES 🚨\n\n`;
      prompt += `**YOU MUST FOLLOW THESE RULES OR YOUR OUTPUT WILL BE REJECTED:**\n\n`;

      if (rootFolders.size > 0) {
        prompt += `## Existing Root Folders\n\n`;
        prompt += `The repository has these root folders:\n`;
        Array.from(rootFolders).sort().forEach(folder => {
          prompt += `- \`${folder}/\`\n`;
        });
        prompt += `\n`;
        prompt += `**RULE #1: You MUST place all new files inside these existing folders.**\n`;
        prompt += `**RULE #2: DO NOT create new root-level folders (like "frontend/", "backend/", "components/", etc.)**\n\n`;
      }

      if (folders.size > 0) {
        prompt += `## Complete Folder Structure\n\n`;
        prompt += `All existing folders in the repository:\n\n`;
        const sortedFolders = Array.from(folders).sort();
        sortedFolders.forEach(folder => {
          prompt += `- \`${folder}/\`\n`;
        });
        prompt += `\n`;
      }

      prompt += `## ❌ WRONG Examples (DO NOT DO THIS):\n\n`;
      prompt += `- \`frontend/src/components/Button.tsx\` ❌ (if "frontend" doesn't exist)\n`;
      prompt += `- \`backend/controllers/user.ts\` ❌ (if "backend" doesn't exist)\n`;
      prompt += `- \`my-components/Card.tsx\` ❌ (inventing new folders)\n`;
      prompt += `- \`new-pages/Home.tsx\` ❌ (inventing new folders)\n\n`;

      prompt += `## ✅ CORRECT Examples:\n\n`;
      if (rootFolders.has('src')) {
        prompt += `- \`src/components/Button.tsx\` ✅ (uses existing "src/" folder)\n`;
        prompt += `- \`src/pages/Home.tsx\` ✅ (uses existing "src/" folder)\n`;
      }
      prompt += `\n`;
      prompt += `**If you need to create a new file, analyze the existing structure and place it in the most appropriate existing folder.**\n\n`;
      prompt += `---\n\n`;

      prompt += `# GitHub Repository Context\n\n`;
      prompt += `## Repository Files\n\n`;
      prompt += `The following files from the repository have been provided for context:\n\n`;

      // Separate configuration files from regular files
      const configFiles = context.githubFiles.filter(f =>
        f.path.includes('config') ||
        f.path.startsWith('.eslint') ||
        f.path.startsWith('.prettier') ||
        f.path === 'package.json' ||
        f.path === 'tsconfig.json' ||
        f.path === '.gitignore'
      );
      const regularFiles = context.githubFiles.filter(f => !configFiles.includes(f));

      // Show configuration files first if any
      if (configFiles.length > 0) {
        prompt += `## 🔧 Project Configuration Files\n\n`;
        prompt += `**CRITICAL: These files define the project's conventions, linting rules, and build configuration.**\n`;
        prompt += `**You MUST follow the rules defined in these files:**\n\n`;

        for (const file of configFiles) {
          prompt += `### ${file.path}\n`;
          prompt += `\`\`\`${file.language}\n`;
          prompt += file.content;
          prompt += `\n\`\`\`\n\n`;
        }

        prompt += `**Instructions based on configuration:**\n`;
        prompt += `- Follow ESLint rules (if .eslintrc files are present)\n`;
        prompt += `- Follow Prettier formatting (if .prettierrc files are present)\n`;
        prompt += `- Follow TypeScript compiler options (if tsconfig.json is present)\n`;
        prompt += `- Use dependencies and scripts defined in package.json\n`;
        prompt += `- Do not commit files listed in .gitignore\n\n`;
      }

      // Show regular files
      if (regularFiles.length > 0) {
        prompt += `## 📄 Repository Files\n\n`;
        for (const file of regularFiles) {
          prompt += `### File: ${file.path}\n`;
          prompt += `Language: ${file.language}\n`;
          prompt += `Size: ${file.size} bytes (~${file.tokens} tokens)\n\n`;
          prompt += `\`\`\`${file.language}\n`;
          prompt += file.content;
          prompt += `\n\`\`\`\n\n`;
        }
      }

      prompt += `---\n\n`;
    }

    // Add team composition
    prompt += `# Team Composition\n\n`;
    prompt += `You are working as part of a team with the following roles:\n`;
    context.teamComposition.forEach((role) => {
      prompt += `- ${role}\n`;
    });
    prompt += `\n`;

    // Show agent's own previous work if this is a re-execution/completion round
    if (context.allPreviousOutputs) {
      const ownPreviousOutputs = context.allPreviousOutputs.filter(o => o.agentRole === agent.role);

      if (ownPreviousOutputs.length > 0) {
        prompt += `# ⚠️ IMPORTANT - Your Previous Work\n\n`;
        prompt += `You have already worked on this task ${ownPreviousOutputs.length} time(s) before. `;
        prompt += `Review your previous outputs carefully to CONTINUE from where you left off, NOT to start over.\n\n`;
        prompt += `**Critical Instructions:**\n`;
        prompt += `- DO NOT create duplicate files\n`;
        prompt += `- DO NOT recreate artifacts you already created\n`;
        prompt += `- BUILD UPON your previous work, don't replace it\n`;
        prompt += `- If you already created files, reference them or extend them\n`;
        prompt += `- Focus ONLY on what's still missing\n\n`;

        ownPreviousOutputs.forEach((output, idx) => {
          prompt += `## Previous Execution #${idx + 1}\n\n`;

          if (output.artifacts && output.artifacts.length > 0) {
            prompt += `**Files you already created (DO NOT recreate these):**\n\n`;

            output.artifacts.forEach((artifact) => {
              prompt += `### \`${artifact.filename}\` (${artifact.type})\n\n`;

              // Show full artifact content so agent knows exactly what was created
              const lang = artifact.language || this.detectLanguage(artifact.filename);
              prompt += `\`\`\`${lang}\n`;
              prompt += artifact.content;
              prompt += `\n\`\`\`\n\n`;
            });
          }

          // Show a brief summary of the previous output
          const contentSummary = output.content.length > 500
            ? output.content.substring(0, 500) + '...[truncated]'
            : output.content;

          prompt += `**Summary of your previous response:**\n${contentSummary}\n\n`;
        });

        prompt += `---\n\n`;

        // Add detailed execution history if available
        prompt += `# 📜 DETAILED EXECUTION HISTORY\n\n`;
        prompt += `Previous agents have executed with detailed logs. Review their steps to understand their reasoning:\n\n`;

        for (const output of ownPreviousOutputs) {
          if (output.executionLog) {
            const log = output.executionLog as any;
            prompt += `\n## ${this.getRoleName(output.agentRole)} - Execution Log\n`;
            prompt += `- Total Steps: ${log.summary.totalSteps}\n`;
            prompt += `- Tool Calls: ${log.summary.totalToolCalls}\n`;
            prompt += `- Duration: ${log.summary.startTime} to ${log.summary.endTime}\n\n`;

            // Include key steps (limit to avoid token overflow)
            const keySteps = log.steps.filter((s: any) => s.type === 'tool_call' || s.type === 'thinking').slice(0, 10);
            if (keySteps.length > 0) {
              prompt += `**Key Steps:**\n`;
              keySteps.forEach((step: any, i: number) => {
                prompt += `${i + 1}. [${step.type}] ${step.content}\n`;
                if (step.toolName) {
                  prompt += `   Tool: ${step.toolName}\n`;
                }
              });
              prompt += `\n`;
            }
          }
        }

        prompt += `---\n\n`;
      }
    }

    // For task-completion-validator, show all created artifacts prominently
    if (agent.role === 'task-completion-validator' && context.previousOutputs.size > 0) {
      prompt += `# Created Artifacts\n\n`;
      prompt += `The following files were created by the team as artifacts (not yet in GitHub repository):\n\n`;

      const allArtifacts: Array<{ agentName: string; filename: string; type: string }> = [];

      for (const [role, output] of context.previousOutputs.entries()) {
        if (output.status === 'success' && output.artifacts && output.artifacts.length > 0) {
          output.artifacts.forEach((artifact) => {
            allArtifacts.push({
              agentName: this.getRoleName(role),
              filename: artifact.filename,
              type: artifact.type,
            });
          });
        }
      }

      if (allArtifacts.length > 0) {
        allArtifacts.forEach((artifact) => {
          prompt += `- **${artifact.filename}** (${artifact.type}) - created by ${artifact.agentName}\n`;
        });
        prompt += `\n`;
        prompt += `**Total artifacts created: ${allArtifacts.length}**\n\n`;
      } else {
        prompt += `⚠️ **No artifacts were created by any agent.**\n\n`;
      }

      prompt += `---\n\n`;

      // Also include full agent outputs for context
      prompt += `# Team Member Outputs\n\n`;
      prompt += `Review what each team member planned and implemented:\n\n`;

      for (const [role, output] of context.previousOutputs.entries()) {
        if (output.status === 'success') {
          prompt += `## ${this.getRoleName(role)}\n\n`;
          prompt += `${output.content}\n\n`;
        }
      }
    }
    // Add context from dependent agents (for regular agents)
    else if (agent.dependencies.length > 0 && context.previousOutputs.size > 0) {
      prompt += `# Context from Team Members\n\n`;
      prompt += `Your team members have already completed their analysis. `;
      prompt += `Use their insights to inform your work:\n\n`;

      for (const depRole of agent.dependencies) {
        const output = context.previousOutputs.get(depRole);
        if (output && output.status === 'success') {
          prompt += `## ${this.getRoleName(depRole)}\n\n`;
          prompt += `${output.content}\n\n`;

          // Include artifacts if any
          if (output.artifacts && output.artifacts.length > 0) {
            prompt += `**Artifacts:**\n`;
            output.artifacts.forEach((artifact) => {
              prompt += `- ${artifact.filename} (${artifact.type})\n`;
            });
            prompt += `\n`;
          }

          // Include execution log summary if available
          if (output.executionLog) {
            const log = output.executionLog as any;
            prompt += `**Execution Summary:**\n`;
            prompt += `- ${log.summary.totalSteps} steps, ${log.summary.totalToolCalls} tool calls\n\n`;
          }
        }
      }
    }

    // Add role-specific instructions
    prompt += `# Your Task\n\n`;
    prompt += `As the ${agent.name}, analyze the task and provide your expertise. `;
    prompt += `Focus on your specific responsibilities:\n\n`;
    agent.capabilities.forEach((capability) => {
      prompt += `- ${capability}\n`;
    });
    prompt += `\n`;

    // Add output format reminder
    prompt += `# Output Requirements\n\n`;
    prompt += `Please provide a comprehensive response following your role's structure. `;
    prompt += `Include specific, actionable recommendations.\n\n`;

    // Add artifact instructions
    prompt += `# CRITICAL - Creating File Artifacts\n\n`;
    prompt += `When you create code files, you MUST use this EXACT format:\n\n`;
    prompt += `\`\`\`language:full/path/to/file.ext\n`;
    prompt += `// Complete file content here\n`;
    prompt += `\`\`\`\n\n`;
    prompt += `IMPORTANT:\n`;
    prompt += `- Use the actual programming language (typescript, javascript, css, python, etc.)\n`;
    prompt += `- Include the FULL file path relative to project root\n`;
    prompt += `- Include COMPLETE working code, not snippets\n`;
    prompt += `- Create ONE code block per file\n`;
    prompt += `- DO NOT include file content in plain text - only in code blocks\n\n`;
    prompt += `Example:\n`;
    prompt += `\`\`\`typescript:src/components/Button.tsx\n`;
    prompt += `import React from 'react';\n\n`;
    prompt += `export const Button = () => {\n`;
    prompt += `  return <button>Click me</button>;\n`;
    prompt += `};\n`;
    prompt += `\`\`\`\n\n`;

    // Add instructions for modifying existing files
    if (context.githubFiles && context.githubFiles.length > 0) {
      prompt += `# 🔄 CRITICAL - Modifying Existing Files\n\n`;
      prompt += `⚠️ **YOU MUST PRESERVE ALL EXISTING CONTENT** ⚠️\n\n`;
      prompt += `When you need to MODIFY an existing file from the repository:\n\n`;
      prompt += `1. Find the file in the "Repository Files" section above\n`;
      prompt += `2. Copy the ENTIRE file content as your starting point\n`;
      prompt += `3. Make ONLY the specific changes needed (add/modify specific lines)\n`;
      prompt += `4. KEEP ALL OTHER CONTENT UNCHANGED\n`;
      prompt += `5. Output the COMPLETE file with all original content + your changes\n\n`;
      prompt += `**Example - Adding a dependency to package.json:**\n`;
      prompt += `❌ WRONG: Output only {"dependencies": {"new-package": "1.0"}}\n`;
      prompt += `✅ CORRECT: Output the ENTIRE package.json with all existing dependencies PLUS the new one\n\n`;
      prompt += `**If you output an incomplete file, the entire application will break!**\n\n`;
      prompt += `**IMPORTANT: Use the same path as the original file to modify it**\n\n`;
      prompt += `Example - Modifying an existing file:\n`;
      prompt += `- Original file in repo: \`src/components/Button.tsx\`\n`;
      prompt += `- Your artifact: \`\`\`typescript:src/components/Button.tsx\n`;
      prompt += `- Content: Complete modified version of the file\n\n`;
      prompt += `❌ WRONG: Creating a new file with different name\n`;
      prompt += `❌ WRONG: Creating partial changes or diffs\n`;
      prompt += `✅ CORRECT: Full file with same path but modified content\n\n`;
    }

    // Add defensive programming section for review tasks
    if (context.isReviewTask) {
      prompt += `# 🛡️ DEFENSIVE PROGRAMMING FOR REVIEWS\n\n`;
      prompt += `You are fixing errors in EXISTING, WORKING code. Be EXTREMELY careful.\n\n`;

      prompt += `## Red Flags - DO NOT DO THESE:\n`;
      prompt += `❌ Creating new files when fixing existing ones\n`;
      prompt += `❌ Changing function/class names\n`;
      prompt += `❌ Changing function signatures\n`;
      prompt += `❌ Refactoring code not related to the error\n`;
      prompt += `❌ Adding console.logs or debug statements\n`;
      prompt += `❌ Removing error handling\n`;
      prompt += `❌ Changing export statements unless required\n`;
      prompt += `❌ Adding TODO/FIXME comments\n\n`;

      prompt += `## Green Flags - DO THESE:\n`;
      prompt += `✅ Read current file from GitHub first\n`;
      prompt += `✅ Make minimal, surgical changes\n`;
      prompt += `✅ Fix only the specific error\n`;
      prompt += `✅ Preserve existing structure\n`;
      prompt += `✅ Follow project conventions\n`;
      prompt += `✅ Verify imports are correct\n`;
      prompt += `✅ Test your understanding before changing\n\n`;
    }

    return prompt;
  }

  /**
   * Parse artifacts from agent output
   */
  static parseArtifacts(content: string): any[] {
    const artifacts: any[] = [];

    // Match code blocks with language and filename
    // Format: ```language:filename
    const codeBlockRegex = /```(\w+):([^\n]+)\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const [, language, filename, code] = match;

      artifacts.push({
        type: this.determineArtifactType(language, filename),
        filename: filename.trim(),
        content: code.trim(),
        language: language.trim(),
      });
    }

    return artifacts;
  }

  /**
   * Validate that artifact paths respect existing repository structure
   * Returns filtered artifacts with warnings for invalid ones
   */
  static validateArtifactPaths(
    artifacts: any[],
    githubFiles?: { path: string }[]
  ): { validArtifacts: any[]; warnings: string[] } {
    if (!githubFiles || githubFiles.length === 0) {
      // No structure to validate against, allow all
      return { validArtifacts: artifacts, warnings: [] };
    }

    // Extract existing root folders from github files
    const existingRootFolders = new Set<string>();
    githubFiles.forEach(file => {
      const parts = file.path.split('/');
      if (parts.length > 1) {
        existingRootFolders.add(parts[0]);
      }
    });

    const validArtifacts: any[] = [];
    const warnings: string[] = [];

    for (const artifact of artifacts) {
      const path = artifact.filename;
      const parts = path.split('/');

      // Check if artifact is trying to create a file at root (no folder)
      if (parts.length === 1) {
        // Root level file - could be valid (package.json, README.md, etc.)
        validArtifacts.push(artifact);
        continue;
      }

      const rootFolder = parts[0];

      // Check if the root folder matches existing structure
      if (existingRootFolders.size > 0 && !existingRootFolders.has(rootFolder)) {
        warnings.push(
          `⚠️ Artifact path "${path}" uses non-existent root folder "${rootFolder}". ` +
          `Existing root folders: ${Array.from(existingRootFolders).join(', ')}. ` +
          `This artifact will be REJECTED.`
        );
        // Skip this artifact - don't include it
        console.warn(`[ContextBuilder] Rejecting artifact with invalid path: ${path}`);
        continue;
      }

      // Path is valid
      validArtifacts.push(artifact);
    }

    return { validArtifacts, warnings };
  }

  /**
   * Validate artifacts for content loss when modifying existing files
   * Returns warnings if significant content appears to be missing
   */
  static validateArtifactCompleteness(
    artifacts: any[],
    githubFiles?: { path: string; content: string }[]
  ): { validArtifacts: any[]; warnings: string[] } {
    if (!githubFiles || githubFiles.length === 0) {
      return { validArtifacts: artifacts, warnings: [] };
    }

    const githubFileMap = new Map(githubFiles.map(f => [f.path, f.content]));
    const warnings: string[] = [];
    const validArtifacts: any[] = [];

    for (const artifact of artifacts) {
      const originalContent = githubFileMap.get(artifact.filename);

      if (originalContent) {
        // This is a modification of an existing file
        const originalLines = originalContent.split('\n').length;
        const newLines = artifact.content.split('\n').length;
        const reductionPercent = ((originalLines - newLines) / originalLines) * 100;

        // Detect significant content loss
        if (reductionPercent > 50) {
          warnings.push(
            `⚠️ CRITICAL: Artifact "${artifact.filename}" has ${Math.round(reductionPercent)}% content loss!\n` +
            `   Original: ${originalLines} lines → New: ${newLines} lines\n` +
            `   This suggests the agent may have output an INCOMPLETE file.\n` +
            `   THE FILE WILL BE REJECTED to prevent breaking the application.`
          );
          console.error(`[ContextBuilder] REJECTING artifact due to content loss: ${artifact.filename}`);
          continue; // Skip this artifact
        } else if (reductionPercent > 20) {
          warnings.push(
            `⚠️ Warning: Artifact "${artifact.filename}" has ${Math.round(reductionPercent)}% content reduction.\n` +
            `   Original: ${originalLines} lines → New: ${newLines} lines\n` +
            `   Please verify this is intentional (refactoring/cleanup).`
          );
        }
      }

      validArtifacts.push(artifact);
    }

    return { validArtifacts, warnings };
  }

  /**
   * Determine artifact type based on language and filename
   */
  private static determineArtifactType(
    language: string,
    filename: string
  ): 'code' | 'document' | 'diagram' | 'config' {
    const lower = filename.toLowerCase();

    // Config files
    if (
      lower.endsWith('.json') ||
      lower.endsWith('.yml') ||
      lower.endsWith('.yaml') ||
      lower.endsWith('.env') ||
      lower.includes('docker') ||
      lower.includes('config')
    ) {
      return 'config';
    }

    // Documentation
    if (
      lower.endsWith('.md') ||
      lower.endsWith('.txt') ||
      language === 'markdown' ||
      language === 'text'
    ) {
      return 'document';
    }

    // Diagrams
    if (
      language === 'mermaid' ||
      language === 'plantuml' ||
      lower.endsWith('.mmd')
    ) {
      return 'diagram';
    }

    // Default to code
    return 'code';
  }

  /**
   * Detect programming language from filename
   * Supports a wide range of languages and frameworks
   */
  private static detectLanguage(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();

    if (!ext) return 'plaintext';

    // Comprehensive language mapping
    const languageMap: Record<string, string> = {
      // JavaScript/TypeScript ecosystem
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'mjs': 'javascript',
      'cjs': 'javascript',
      'vue': 'vue',
      'svelte': 'svelte',
      'astro': 'astro',

      // Mobile
      'swift': 'swift',
      'kt': 'kotlin',
      'kts': 'kotlin',
      'dart': 'dart',

      // Backend languages
      'py': 'python',
      'pyw': 'python',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'rb': 'ruby',
      'php': 'php',
      'cs': 'csharp',
      'cpp': 'cpp',
      'c': 'c',
      'h': 'c',
      'hpp': 'cpp',
      'cc': 'cpp',

      // Web markup/styling
      'html': 'html',
      'htm': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'styl': 'stylus',

      // Data/Config formats
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'toml': 'toml',
      'xml': 'xml',
      'ini': 'ini',
      'env': 'bash',

      // Documentation
      'md': 'markdown',
      'mdx': 'mdx',
      'rst': 'restructuredtext',
      'txt': 'plaintext',

      // Shell scripts
      'sh': 'bash',
      'bash': 'bash',
      'zsh': 'zsh',
      'fish': 'fish',

      // Database
      'sql': 'sql',
      'prisma': 'prisma',

      // Other
      'graphql': 'graphql',
      'gql': 'graphql',
      'proto': 'protobuf',
      'tf': 'terraform',
      'dockerfile': 'dockerfile',
      'makefile': 'makefile',
    };

    // If we have a mapping, use it
    if (languageMap[ext]) {
      return languageMap[ext];
    }

    // Special case: Dockerfile, Makefile without extension
    const lowerFilename = filename.toLowerCase();
    if (lowerFilename === 'dockerfile' || lowerFilename.startsWith('dockerfile.')) {
      return 'dockerfile';
    }
    if (lowerFilename === 'makefile' || lowerFilename === 'gnumakefile') {
      return 'makefile';
    }

    // For unknown extensions, use the extension itself
    // This allows syntax highlighting to work for any language
    // even if we haven't explicitly mapped it
    return ext;
  }

  /**
   * Get friendly name for agent role
   */
  private static getRoleName(role: string): string {
    const roleNames: Record<string, string> = {
      'tech-lead': 'Technical Lead',
      'product-owner': 'Product Owner',
      frontend: 'Frontend Developer',
      backend: 'Backend Developer',
      devops: 'DevOps Engineer',
      qa: 'QA Engineer',
    };

    return roleNames[role] || role;
  }

  /**
   * Create execution summary from all outputs
   */
  static createExecutionSummary(outputs: AgentOutput[]): string {
    let summary = `# Execution Summary\n\n`;

    summary += `**Agents Executed:** ${outputs.length}\n`;
    summary += `**Status:** ${outputs.every((o) => o.status === 'success') ? 'Success' : 'Partial Success'}\n`;

    const totalTime = outputs.reduce((sum, o) => sum + (o.executionTime || 0), 0);
    summary += `**Total Execution Time:** ${(totalTime / 1000).toFixed(2)}s\n\n`;

    // Add agent-by-agent summary
    summary += `## Agent Outputs\n\n`;
    outputs.forEach((output) => {
      summary += `### ${this.getRoleName(output.agentRole)}\n`;
      summary += `- Status: ${output.status}\n`;
      if (output.executionTime) {
        summary += `- Execution Time: ${(output.executionTime / 1000).toFixed(2)}s\n`;
      }
      if (output.artifacts && output.artifacts.length > 0) {
        summary += `- Artifacts: ${output.artifacts.length} file(s)\n`;
      }
      if (output.error) {
        summary += `- Error: ${output.error}\n`;
      }
      summary += `\n`;
    });

    return summary;
  }
}

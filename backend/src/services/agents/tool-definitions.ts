/**
 * Tool definitions for AI agents to interact with GitHub repositories
 * These are provided to LLMs via function calling
 */

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

/**
 * OpenAI-compatible tool definitions
 */
export const getOpenAITools = (): any[] => [
  {
    type: 'function',
    function: {
      name: 'get_github_file',
      description: 'Get the content of a specific file from the GitHub repository. Use this when you need to read a file that is not in your current context.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path relative to repository root (e.g. "src/index.ts", "package.json")',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_github_directory',
      description: 'List all files and directories at a specific path in the repository. Use this to explore the project structure.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Directory path relative to repository root (e.g. "src/components", ""). Empty string for root directory.',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_github_repo',
      description: 'Search for files or content patterns in the repository. Use this to find specific files or code patterns.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query string (e.g. "Button.tsx", "useAuth", "export function")',
          },
          type: {
            type: 'string',
            enum: ['filename', 'content'],
            description: 'Search type: "filename" to search by file name, "content" to search within file contents',
          },
        },
        required: ['query', 'type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_config_files',
      description: 'Get all common configuration files from the repository (package.json, tsconfig.json, eslint, prettier, etc.). Use this to understand project setup and follow its conventions.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
];

/**
 * Anthropic-compatible tool definitions
 */
export const getAnthropicTools = (): any[] => [
  {
    name: 'get_github_file',
    description: 'Get the content of a specific file from the GitHub repository. Use this when you need to read a file that is not in your current context.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to repository root (e.g. "src/index.ts", "package.json")',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_github_directory',
    description: 'List all files and directories at a specific path in the repository. Use this to explore the project structure.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path relative to repository root (e.g. "src/components", ""). Empty string for root directory.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_github_repo',
    description: 'Search for files or content patterns in the repository. Use this to find specific files or code patterns.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query string (e.g. "Button.tsx", "useAuth", "export function")',
        },
        type: {
          type: 'string',
          enum: ['filename', 'content'],
          description: 'Search type: "filename" to search by file name, "content" to search within file contents',
        },
      },
      required: ['query', 'type'],
    },
  },
  {
    name: 'get_config_files',
    description: 'Get all common configuration files from the repository (package.json, tsconfig.json, eslint, prettier, etc.). Use this to understand project setup and follow its conventions.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

/**
 * Generic tool definitions
 */
export const getToolDefinitions = (): ToolDefinition[] => [
  {
    name: 'get_github_file',
    description: 'Get the content of a specific file from the GitHub repository',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to repository root',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_github_directory',
    description: 'List all files and directories at a specific path in the repository',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path relative to repository root',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_github_repo',
    description: 'Search for files or content patterns in the repository',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query string',
        },
        type: {
          type: 'string',
          description: 'Search type: filename or content',
        },
      },
      required: ['query', 'type'],
    },
  },
  {
    name: 'get_config_files',
    description: 'Get all common configuration files from the repository',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

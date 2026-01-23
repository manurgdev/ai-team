export interface AIConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  toolCalls?: ToolCall[];
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'content_filter';
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  toolCallId: string;
  result: any;
  isError?: boolean;
}

export interface AIProvider {
  name: string;

  /**
   * Validate an API key by making a test request
   */
  validate(apiKey: string): Promise<boolean>;

  /**
   * Execute a prompt with system instructions
   */
  execute(prompt: string, systemPrompt: string, config?: AIConfig): Promise<AIResponse>;

  /**
   * Execute with tool calling support
   * Returns response which may contain tool calls
   */
  executeWithTools?(
    messages: ProviderMessage[],
    systemPrompt: string,
    tools: any[],
    config?: AIConfig
  ): Promise<AIResponse>;

  /**
   * Continue execution after tool results
   */
  continueWithToolResults?(
    messages: ProviderMessage[],
    systemPrompt: string,
    tools: any[],
    toolResults: ToolResult[],
    config?: AIConfig
  ): Promise<AIResponse>;

  /**
   * Get available models for this provider
   */
  getAvailableModels(): string[];
}

export interface ProviderMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

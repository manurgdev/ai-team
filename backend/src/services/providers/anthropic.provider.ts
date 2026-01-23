import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, AIConfig, AIResponse, ProviderMessage, ToolCall, ToolResult } from './provider.interface';

export class AnthropicProvider implements AIProvider {
  name = 'Anthropic';
  private client: Anthropic;
  private availableModels = [
    'claude-opus-4-5-20251101',      // Claude Opus 4.5 - Most capable model
    'claude-sonnet-4-5-20250929',    // Claude Sonnet 4.5 - Balance of performance and cost
    'claude-sonnet-4-20250514',      // Claude Sonnet 4
    'claude-haiku-4-5-20251001',     // Claude Haiku 4.5 - Fast and cost-effective
  ];

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  getAvailableModels(): string[] {
    return this.availableModels;
  }

  async validate(apiKey: string): Promise<boolean> {
    try {
      const testClient = new Anthropic({ apiKey });

      // Make a minimal test request
      await testClient.messages.create({
        model: 'claude-haiku-4-5-20251001', // Use the cheapest model for validation
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      });

      return true;
    } catch (error: any) {
      console.error('Anthropic validation error:', error.message);
      return false;
    }
  }

  async execute(
    prompt: string,
    systemPrompt: string,
    config?: AIConfig
  ): Promise<AIResponse> {
    try {
      const response = await this.client.messages.create({
        model: config?.model || 'claude-sonnet-4-5-20250929', // Default to Sonnet 4.5
        max_tokens: config?.maxTokens || 4096,
        temperature: config?.temperature || 0.7,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });

      // Extract text content from the response
      const textContent = response.content.find((block) => block.type === 'text');
      const content = textContent && textContent.type === 'text' ? textContent.text : '';

      // Extract usage information
      const usage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      };

      // Map stop_reason to finishReason
      let finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter' = 'stop';
      if (response.stop_reason === 'max_tokens') {
        finishReason = 'length';
      } else if (response.stop_reason === 'tool_use') {
        finishReason = 'tool_calls';
      }

      return { content, usage, finishReason };
    } catch (error: any) {
      console.error('Anthropic execution error:', error.message);
      throw new Error(`Anthropic API error: ${error.message}`);
    }
  }

  async executeWithTools(
    messages: ProviderMessage[],
    systemPrompt: string,
    tools: any[],
    config?: AIConfig
  ): Promise<AIResponse> {
    try {
      // Convert messages to Anthropic format
      const anthropicMessages = messages
        .filter(m => m.role !== 'system')
        .map(m => {
          // Handle tool result messages
          if (m.toolCallId) {
            return {
              role: 'user' as const,
              content: [{
                type: 'tool_result' as const,
                tool_use_id: m.toolCallId,
                content: m.content,
              }]
            };
          }

          // Handle assistant messages with tool calls
          if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
            const contentBlocks: any[] = [];

            // Add text content if present
            if (m.content && m.content.trim()) {
              contentBlocks.push({
                type: 'text',
                text: m.content,
              });
            }

            // Add tool_use blocks
            for (const toolCall of m.toolCalls) {
              contentBlocks.push({
                type: 'tool_use',
                id: toolCall.id,
                name: toolCall.name,
                input: toolCall.arguments,
              });
            }

            return {
              role: 'assistant' as const,
              content: contentBlocks,
            };
          }

          // Regular messages
          return {
            role: m.role as 'user' | 'assistant',
            content: m.content,
          };
        });

      const response = await this.client.messages.create({
        model: config?.model || 'claude-sonnet-4-5-20250929',
        max_tokens: config?.maxTokens || 4096,
        temperature: config?.temperature || 0.7,
        system: systemPrompt,
        messages: anthropicMessages as any,
        tools: tools,
      });

      // Extract content and tool calls
      let content = '';
      const toolCalls: ToolCall[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          content += block.text;
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            name: block.name,
            arguments: block.input as Record<string, any>,
          });
        }
      }

      const usage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      };

      // Map stop_reason to finishReason
      let finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter' = 'stop';
      if (response.stop_reason === 'max_tokens') {
        finishReason = 'length';
      } else if (response.stop_reason === 'tool_use') {
        finishReason = 'tool_calls';
      }

      return {
        content,
        usage,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason,
      };
    } catch (error: any) {
      console.error('Anthropic executeWithTools error:', error.message);
      throw new Error(`Anthropic API error: ${error.message}`);
    }
  }

  async continueWithToolResults(
    messages: ProviderMessage[],
    systemPrompt: string,
    tools: any[],
    toolResults: ToolResult[],
    config?: AIConfig
  ): Promise<AIResponse> {
    // Add tool results to messages
    const updatedMessages: ProviderMessage[] = [
      ...messages,
      ...toolResults.map(result => ({
        role: 'tool' as const,
        content: JSON.stringify(result.result),
        toolCallId: result.toolCallId,
      })),
    ];

    return this.executeWithTools(updatedMessages, systemPrompt, tools, config);
  }
}

import OpenAI from 'openai';
import { AIProvider, AIConfig, AIResponse, ProviderMessage, ToolCall, ToolResult } from './provider.interface';

export class OpenAIProvider implements AIProvider {
  name = 'OpenAI';
  private client: OpenAI;
  private availableModels = [
    'gpt-4-turbo',
    'gpt-4-turbo-preview',
    'gpt-4',
    'gpt-4-0613',
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-16k',
  ];

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  getAvailableModels(): string[] {
    return this.availableModels;
  }

  async validate(apiKey: string): Promise<boolean> {
    try {
      const testClient = new OpenAI({ apiKey });

      // Make a minimal test request
      await testClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 10,
      });

      return true;
    } catch (error: any) {
      console.error('OpenAI validation error:', error.message);
      return false;
    }
  }

  async execute(
    prompt: string,
    systemPrompt: string,
    config?: AIConfig
  ): Promise<AIResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: config?.model || 'gpt-4-turbo',
        temperature: config?.temperature || 0.7,
        max_tokens: config?.maxTokens || 4096,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
      });

      const content = response.choices[0].message.content || '';

      // Extract usage information
      const usage = {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      };

      // Map finish_reason to finishReason
      let finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter' = 'stop';
      const finish_reason = response.choices[0].finish_reason;
      if (finish_reason === 'length') {
        finishReason = 'length';
      } else if (finish_reason === 'tool_calls') {
        finishReason = 'tool_calls';
      } else if (finish_reason === 'content_filter') {
        finishReason = 'content_filter';
      }

      return { content, usage, finishReason };
    } catch (error: any) {
      console.error('OpenAI execution error:', error.message);
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  async executeWithTools(
    messages: ProviderMessage[],
    systemPrompt: string,
    tools: any[],
    config?: AIConfig
  ): Promise<AIResponse> {
    try {
      // Convert messages to OpenAI format
      const openaiMessages: any[] = [
        { role: 'system', content: systemPrompt },
        ...messages
          .filter(m => m.role !== 'system')
          .map(m => {
            if (m.role === 'tool') {
              return {
                role: 'tool',
                content: m.content,
                tool_call_id: m.toolCallId,
              };
            } else if (m.toolCalls) {
              return {
                role: m.role,
                content: m.content,
                tool_calls: m.toolCalls.map(tc => ({
                  id: tc.id,
                  type: 'function',
                  function: {
                    name: tc.name,
                    arguments: JSON.stringify(tc.arguments),
                  },
                })),
              };
            } else {
              return {
                role: m.role,
                content: m.content,
              };
            }
          }),
      ];

      const response = await this.client.chat.completions.create({
        model: config?.model || 'gpt-4-turbo',
        temperature: config?.temperature || 0.7,
        max_tokens: config?.maxTokens || 4096,
        messages: openaiMessages,
        tools: tools,
      });

      const message = response.choices[0].message;
      const content = message.content || '';

      // Extract tool calls if any
      const toolCalls: ToolCall[] | undefined = message.tool_calls?.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }));

      const usage = {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      };

      // Map finish_reason to finishReason
      let finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter' = 'stop';
      const finish_reason = response.choices[0].finish_reason;
      if (finish_reason === 'length') {
        finishReason = 'length';
      } else if (finish_reason === 'tool_calls') {
        finishReason = 'tool_calls';
      } else if (finish_reason === 'content_filter') {
        finishReason = 'content_filter';
      }

      return {
        content,
        usage,
        toolCalls,
        finishReason,
      };
    } catch (error: any) {
      console.error('OpenAI executeWithTools error:', error.message);
      throw new Error(`OpenAI API error: ${error.message}`);
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

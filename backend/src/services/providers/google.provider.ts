import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, AIConfig, AIResponse } from './provider.interface';

export class GoogleProvider implements AIProvider {
  name = 'Google';
  private client: GoogleGenerativeAI;
  private availableModels = ['gemini-pro', 'gemini-pro-vision'];

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  getAvailableModels(): string[] {
    return this.availableModels;
  }

  async validate(apiKey: string): Promise<boolean> {
    try {
      const testClient = new GoogleGenerativeAI(apiKey);
      const model = testClient.getGenerativeModel({ model: 'gemini-pro' });

      // Make a minimal test request
      await model.generateContent('test');

      return true;
    } catch (error: any) {
      console.error('Google validation error:', error.message);
      return false;
    }
  }

  async execute(
    prompt: string,
    systemPrompt: string,
    config?: AIConfig
  ): Promise<AIResponse> {
    try {
      const model = this.client.getGenerativeModel({
        model: config?.model || 'gemini-pro',
      });

      // Google Gemini doesn't have a separate system prompt,
      // so we prepend it to the user prompt
      const fullPrompt = `${systemPrompt}\n\n---\n\n${prompt}`;

      // Note: Gemini doesn't support temperature and maxTokens in the same way
      // We'll use the default generation config
      const result = await model.generateContent(fullPrompt);
      const response = result.response;

      const content = response.text();

      // Extract usage information
      const usageMetadata = response.usageMetadata;
      const usage = {
        inputTokens: usageMetadata?.promptTokenCount || 0,
        outputTokens: usageMetadata?.candidatesTokenCount || 0,
        totalTokens: usageMetadata?.totalTokenCount || 0,
      };

      // Map Google's finishReason (if available)
      let finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter' = 'stop';
      const candidate = (response as any).candidates?.[0];
      if (candidate?.finishReason === 'MAX_TOKENS') {
        finishReason = 'length';
      } else if (candidate?.finishReason === 'SAFETY') {
        finishReason = 'content_filter';
      }

      return { content, usage, finishReason };
    } catch (error: any) {
      console.error('Google execution error:', error.message);
      throw new Error(`Google API error: ${error.message}`);
    }
  }
}

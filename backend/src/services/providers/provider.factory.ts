import { AIProvider } from './provider.interface';
import { AnthropicProvider } from './anthropic.provider';
import { OpenAIProvider } from './openai.provider';
import { GoogleProvider } from './google.provider';

export class ProviderFactory {
  static createProvider(provider: string, apiKey: string): AIProvider {
    switch (provider.toLowerCase()) {
      case 'anthropic':
        return new AnthropicProvider(apiKey);
      case 'openai':
        return new OpenAIProvider(apiKey);
      case 'google':
        return new GoogleProvider(apiKey);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  static async validateProvider(provider: string, apiKey: string): Promise<boolean> {
    try {
      const providerInstance = ProviderFactory.createProvider(provider, apiKey);
      return await providerInstance.validate(apiKey);
    } catch (error) {
      console.error(`Provider validation error for ${provider}:`, error);
      return false;
    }
  }

  static getSupportedProviders(): string[] {
    return ['anthropic', 'openai', 'google'];
  }
}

import { prisma } from '../utils/prisma';
import { encryptionService } from './encryption.service';
import { ProviderFactory } from './providers/provider.factory';

export interface ApiKeyDto {
  provider: string;
  apiKey: string;
}

export interface ApiKeyResponse {
  id: string;
  provider: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ConfigService {
  async saveApiKey(userId: string, data: ApiKeyDto): Promise<ApiKeyResponse> {
    const { provider, apiKey } = data;

    // Encrypt the API key
    const encryptedKey = encryptionService.encrypt(apiKey);

    // Upsert (update or create)
    const savedKey = await prisma.apiKey.upsert({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
      update: {
        encryptedKey,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        userId,
        provider,
        encryptedKey,
        isActive: true,
      },
    });

    return {
      id: savedKey.id,
      provider: savedKey.provider,
      isActive: savedKey.isActive,
      createdAt: savedKey.createdAt,
      updatedAt: savedKey.updatedAt,
    };
  }

  async getApiKeys(userId: string): Promise<ApiKeyResponse[]> {
    const keys = await prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return keys;
  }

  async getDecryptedApiKey(userId: string, provider: string): Promise<string | null> {
    const apiKey = await prisma.apiKey.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });

    if (!apiKey || !apiKey.isActive) {
      return null;
    }

    try {
      return encryptionService.decrypt(apiKey.encryptedKey);
    } catch {
      return null;
    }
  }

  async deleteApiKey(userId: string, provider: string): Promise<void> {
    await prisma.apiKey.delete({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });
  }

  async validateApiKey(provider: string, apiKey: string): Promise<boolean> {
    // Basic validation
    if (!apiKey || apiKey.length < 10) {
      return false;
    }

    // Check if provider is supported
    if (!ProviderFactory.getSupportedProviders().includes(provider.toLowerCase())) {
      return false;
    }

    // Actual provider validation by making a test API call
    try {
      return await ProviderFactory.validateProvider(provider, apiKey);
    } catch (error) {
      console.error(`Validation error for ${provider}:`, error);
      return false;
    }
  }

  getAvailableProviders() {
    // Get provider info dynamically from provider implementations
    const providers = [
      {
        id: 'anthropic',
        name: 'Anthropic',
        description: 'Claude 4.5 (Opus, Sonnet, Haiku)',
      },
      {
        id: 'openai',
        name: 'OpenAI',
        description: 'GPT-4 and GPT-3.5 Turbo',
      },
      {
        id: 'google',
        name: 'Google',
        description: 'Gemini Pro',
      },
    ];

    // Add models from each provider
    return providers.map((provider) => {
      try {
        // Create a temporary instance with a dummy key to get available models
        const providerInstance = ProviderFactory.createProvider(provider.id, 'dummy');
        return {
          ...provider,
          models: providerInstance.getAvailableModels(),
        };
      } catch {
        return {
          ...provider,
          models: [],
        };
      }
    });
  }
}

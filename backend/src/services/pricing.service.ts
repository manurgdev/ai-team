/**
 * Pricing information for AI models
 * Prices are per 1 million tokens (input/output)
 * Source: Provider pricing pages as of January 2026
 */

export interface ModelPricing {
  inputPricePerMillion: number;  // USD per 1M input tokens
  outputPricePerMillion: number; // USD per 1M output tokens
}

export interface UsageMetrics {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

// Anthropic pricing
const anthropicPricing: Record<string, ModelPricing> = {
  'claude-opus-4-5-20251101': {
    inputPricePerMillion: 15.0,
    outputPricePerMillion: 75.0,
  },
  'claude-sonnet-4-5-20250929': {
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
  },
  'claude-sonnet-4-20250514': {
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
  },
  'claude-haiku-4-5-20251001': {
    inputPricePerMillion: 0.8,
    outputPricePerMillion: 4.0,
  },
};

// OpenAI pricing
const openaiPricing: Record<string, ModelPricing> = {
  'gpt-4-turbo': {
    inputPricePerMillion: 10.0,
    outputPricePerMillion: 30.0,
  },
  'gpt-4-turbo-preview': {
    inputPricePerMillion: 10.0,
    outputPricePerMillion: 30.0,
  },
  'gpt-4': {
    inputPricePerMillion: 30.0,
    outputPricePerMillion: 60.0,
  },
  'gpt-4-0613': {
    inputPricePerMillion: 30.0,
    outputPricePerMillion: 60.0,
  },
  'gpt-3.5-turbo': {
    inputPricePerMillion: 0.5,
    outputPricePerMillion: 1.5,
  },
  'gpt-3.5-turbo-16k': {
    inputPricePerMillion: 1.0,
    outputPricePerMillion: 2.0,
  },
};

// Google pricing
const googlePricing: Record<string, ModelPricing> = {
  'gemini-pro': {
    inputPricePerMillion: 0.5,
    outputPricePerMillion: 1.5,
  },
  'gemini-pro-vision': {
    inputPricePerMillion: 0.5,
    outputPricePerMillion: 1.5,
  },
};

export class PricingService {
  /**
   * Get pricing for a specific model
   */
  static getModelPricing(provider: string, model: string): ModelPricing | null {
    const providerLower = provider.toLowerCase();

    switch (providerLower) {
      case 'anthropic':
        return anthropicPricing[model] || null;
      case 'openai':
        return openaiPricing[model] || null;
      case 'google':
        return googlePricing[model] || null;
      default:
        return null;
    }
  }

  /**
   * Calculate cost based on token usage
   */
  static calculateCost(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const pricing = this.getModelPricing(provider, model);

    if (!pricing) {
      return 0; // Unknown pricing
    }

    const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePerMillion;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePerMillion;

    return inputCost + outputCost;
  }

  /**
   * Create usage metrics object
   */
  static createUsageMetrics(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): UsageMetrics {
    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCost: this.calculateCost(provider, model, inputTokens, outputTokens),
    };
  }

  /**
   * Format cost as USD string
   */
  static formatCost(cost: number): string {
    if (cost < 0.01) {
      return `$${cost.toFixed(6)}`;
    }
    return `$${cost.toFixed(4)}`;
  }

  /**
   * Format tokens with thousands separator
   */
  static formatTokens(tokens: number): string {
    return tokens.toLocaleString();
  }
}

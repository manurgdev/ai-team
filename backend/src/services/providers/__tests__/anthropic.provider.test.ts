import { AnthropicProvider } from '../anthropic.provider';
import Anthropic from '@anthropic-ai/sdk';

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk');

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;
  const mockApiKey = 'sk-ant-test-key';
  let mockCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate = jest.fn();

    (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(
      () =>
        ({
          messages: {
            create: mockCreate,
          },
        } as any)
    );

    provider = new AnthropicProvider(mockApiKey);
  });

  describe('constructor', () => {
    it('should create an instance with the provided API key', () => {
      expect(Anthropic).toHaveBeenCalledWith({ apiKey: mockApiKey });
    });

    it('should have the correct name', () => {
      expect(provider.name).toBe('Anthropic');
    });
  });

  describe('validate', () => {
    it('should return true for a valid API key', async () => {
      mockCreate.mockResolvedValueOnce({
        id: 'test-id',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'test' }],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      } as any);

      const result = await provider.validate(mockApiKey);

      expect(result).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      });
    });

    it('should return false for an invalid API key', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Invalid API key'));

      const result = await provider.validate('invalid-key');

      expect(result).toBe(false);
    });

    it('should return false when API throws error', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Network error'));

      const result = await provider.validate(mockApiKey);

      expect(result).toBe(false);
    });
  });

  describe('execute', () => {
    const prompt = 'Explain quantum computing';
    const systemPrompt = 'You are a helpful assistant';

    it('should execute a request successfully', async () => {
      const mockResponse = {
        id: 'msg-123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Quantum computing is...' }],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 50 },
      } as any;

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await provider.execute(prompt, systemPrompt);

      expect(result).toBe('Quantum computing is...');
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });
    });

    it('should use custom config when provided', async () => {
      const mockResponse = {
        id: 'msg-123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Response' }],
        model: 'claude-3-opus-20240229',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 50 },
      } as any;

      mockCreate.mockResolvedValueOnce(mockResponse);

      const config = {
        model: 'claude-3-opus-20240229',
        temperature: 0.9,
        maxTokens: 2000,
      };

      await provider.execute(prompt, systemPrompt, config);

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-3-opus-20240229',
        max_tokens: 2000,
        temperature: 0.9,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });
    });

    it('should handle empty string response', async () => {
      const mockResponse = {
        id: 'msg-123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: '' }],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 0 },
      } as any;

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await provider.execute(prompt, systemPrompt);

      expect(result).toBe('');
    });

    it('should return empty string for non-text content', async () => {
      const mockResponse = {
        id: 'msg-123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'image', source: { type: 'base64', data: 'abc' } }],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 0 },
      } as any;

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await provider.execute(prompt, systemPrompt);

      expect(result).toBe('');
    });

    it('should throw error when API call fails', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API error'));

      await expect(provider.execute(prompt, systemPrompt)).rejects.toThrow('API error');
    });
  });

  describe('edge cases', () => {
    it('should handle very long prompts', async () => {
      const longPrompt = 'a'.repeat(10000);
      const mockResponse = {
        id: 'msg-123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Response' }],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 5000, output_tokens: 50 },
      } as any;

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await provider.execute(longPrompt, 'system');

      expect(result).toBe('Response');
    });

    it('should handle special characters in prompts', async () => {
      const specialPrompt = 'Test with émojis 🚀 and special chars: <>&"\'';
      const mockResponse = {
        id: 'msg-123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Response' }],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 50 },
      } as any;

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await provider.execute(specialPrompt, 'system');

      expect(result).toBe('Response');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: 'user', content: specialPrompt }],
        })
      );
    });
  });
});

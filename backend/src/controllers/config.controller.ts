import { Response } from 'express';
import { AuthRequest } from '../types/api.types';
import { ConfigService } from '../services/config.service';

const configService = new ConfigService();

export class ConfigController {
  async getProviders(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const providers = configService.getAvailableProviders();
      res.status(200).json(providers);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch providers' });
    }
  }

  async getApiKeys(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const apiKeys = await configService.getApiKeys(req.userId);
      res.status(200).json(apiKeys);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch API keys' });
    }
  }

  async saveApiKey(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { provider, apiKey } = req.body;

      if (!provider || !apiKey) {
        res.status(400).json({ error: 'Provider and API key are required' });
        return;
      }

      // Validate API key format
      const isValid = await configService.validateApiKey(provider, apiKey);
      if (!isValid) {
        res.status(400).json({ error: 'Invalid API key format' });
        return;
      }

      const savedKey = await configService.saveApiKey(req.userId, { provider, apiKey });
      res.status(200).json(savedKey);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to save API key' });
      }
    }
  }

  async deleteApiKey(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { provider } = req.params;

      if (!provider) {
        res.status(400).json({ error: 'Provider is required' });
        return;
      }

      const providerId = Array.isArray(provider) ? provider[0] : provider;
      await configService.deleteApiKey(req.userId!, providerId);
      res.status(200).json({ message: 'API key deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete API key' });
    }
  }

  async validateApiKey(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { provider, apiKey } = req.body;

      if (!provider || !apiKey) {
        res.status(400).json({ error: 'Provider and API key are required' });
        return;
      }

      const isValid = await configService.validateApiKey(provider, apiKey);
      res.status(200).json({ valid: isValid });
    } catch (error) {
      res.status(500).json({ error: 'Failed to validate API key' });
    }
  }
}

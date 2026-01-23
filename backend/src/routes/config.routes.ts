import { Router } from 'express';
import { ConfigController } from '../controllers/config.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const configController = new ConfigController();

// All config routes require authentication
router.use(authMiddleware);

router.get('/providers', (req, res) => configController.getProviders(req, res));
router.get('/api-keys', (req, res) => configController.getApiKeys(req, res));
router.post('/api-keys', (req, res) => configController.saveApiKey(req, res));
router.delete('/api-keys/:provider', (req, res) =>
  configController.deleteApiKey(req, res)
);
router.post('/api-keys/validate', (req, res) =>
  configController.validateApiKey(req, res)
);

export default router;

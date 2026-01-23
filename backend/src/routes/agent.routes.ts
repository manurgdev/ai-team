import { Router } from 'express';
import { AgentController } from '../controllers/agent.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const agentController = new AgentController();

// All agent routes require authentication
router.use(authMiddleware);

// Get available agent definitions
router.get('/definitions', (req, res) => agentController.getDefinitions(req, res));

// Execute a task with real-time streaming (SSE)
router.post('/execute/stream', (req, res) => agentController.executeTaskStream(req, res));

// Execute a task (original non-streaming)
router.post('/execute', (req, res) => agentController.executeTask(req, res));

// Review and fix a task with real-time streaming (SSE)
router.post('/review-task/stream', (req, res) => agentController.reviewTaskStream(req, res));

// Review and fix a task based on errors (original non-streaming)
router.post('/review-task', (req, res) => agentController.reviewTask(req, res));

// Run manual completion round with real-time streaming (SSE)
router.post('/manual-completion/stream', (req, res) => agentController.manualCompletionStream(req, res));

// Get task by ID
router.get('/tasks/:id', (req, res) => agentController.getTask(req, res));

// Get user's task history
router.get('/tasks', (req, res) => agentController.getTasks(req, res));

export default router;

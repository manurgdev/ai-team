# Real-Time Task Execution with Server-Sent Events (SSE)

## Overview

Implementation of real-time task execution tracking using **Server-Sent Events (SSE)**. Now users can see each agent's progress while working, with instant status updates.

## Problem Solved

**Before**:
- The `/execute` endpoint was synchronous and blocking
- User saw no progress until entire execution finished (can take minutes)
- Poor user experience with infinite loading
- No feedback about which agent was working

**After**:
- Real-time streaming via SSE
- User sees each agent starting, working, and completing
- Visual cards with instantly updated states
- Execution time per agent
- Real-time error indicators

## Architecture

### Backend: Server-Sent Events (SSE)

**New Endpoint**: `POST /api/agents/execute/stream`

```
Client                      Server
   |                            |
   |-- POST /execute/stream --->|
   |<--- SSE Connection --------|
   |                            |
   |<--- event: task_created ---|
   |<--- event: agent_start ----|
   |<--- event: agent_progress -|
   |<--- event: agent_complete -|
   |<--- event: agent_start ----|  (next agent)
   |<--- event: agent_complete -|
   |<--- event: task_complete --|
   |                            |
   |--- Connection closed ----->|
```

### SSE Event Types

1. **task_created** - Task created in DB
   ```json
   {
     "taskId": "uuid",
     "title": "Task title",
     "selectedAgents": ["tech-lead", "frontend"],
     "executionMode": "sequential"
   }
   ```

2. **agent_start** - Agent begins execution
   ```json
   {
     "taskId": "uuid",
     "agentRole": "tech-lead",
     "agentName": "Technical Lead",
     "agentDescription": "Designing architecture..."
   }
   ```

3. **agent_progress** - Agent sending progress
   ```json
   {
     "taskId": "uuid",
     "agentRole": "tech-lead",
     "message": "Thinking..."
   }
   ```

4. **agent_complete** - Agent finished successfully
   ```json
   {
     "taskId": "uuid",
     "agentRole": "tech-lead",
     "status": "success",
     "executionTime": 12500,
     "hasArtifacts": true
   }
   ```

5. **agent_error** - Agent failed
   ```json
   {
     "taskId": "uuid",
     "agentRole": "tech-lead",
     "status": "error",
     "executionTime": 5000,
     "error": "API rate limit exceeded"
   }
   ```

6. **task_complete** - Entire task finished
   ```json
   {
     "taskId": "uuid",
     "totalExecutionTime": 45000,
     "outputs": 3
   }
   ```

7. **task_error** - Global task error
   ```json
   {
     "error": "Failed to execute task"
   }
   ```

## Backend Implementation

### 1. Orchestrator Service

**Modified**: `backend/src/services/agents/orchestrator.service.ts`

Added `ProgressCallback`:
```typescript
export type ProgressCallback = (event: {
  type: 'task_created' | 'agent_start' | 'agent_progress' | 'agent_complete' | 'agent_error' | 'task_complete' | 'task_error';
  taskId: string;
  agentRole?: AgentRole;
  data?: any;
}) => void;
```

**Updated `executeTask` method**:
```typescript
async executeTask(dto: ExecuteTaskDto, progressCallback?: ProgressCallback): Promise<ExecutionResult>
```

**Events emitted**:
- `task_created` - When creating task in DB
- `agent_start` - Before executing each agent
- `agent_progress` - During execution (when calling AI provider)
- `agent_complete` / `agent_error` - When finishing each agent
- `task_complete` / `task_error` - When finishing entire task

### 2. Agent Controller

**New method**: `executeTaskStream`

```typescript
async executeTaskStream(req: AuthRequest, res: Response): Promise<void> {
  // Setup SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // For nginx
  res.flushHeaders();

  // Progress callback
  const progressCallback: ProgressCallback = (event) => {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify({...})}\n\n`);
  };

  // Execute task in background
  orchestratorService.executeTask(dto, progressCallback)
    .then(result => {
      res.write(`event: complete\n`);
      res.write(`data: ${JSON.stringify({taskId: result.taskId})}\n\n`);
      res.end();
    })
    .catch(error => {
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({error: error.message})}\n\n`);
      res.end();
    });
}
```

### 3. Routes

**Added**: `POST /api/agents/execute/stream`

```typescript
// Execute a task with real-time streaming (SSE)
router.post('/execute/stream', (req, res) => agentController.executeTaskStream(req, res));

// Execute a task (original non-streaming) - kept for compatibility
router.post('/execute', (req, res) => agentController.executeTask(req, res));
```

## Frontend Implementation

### 1. ExecutionViewer Component

**New component**: `frontend/src/components/execution/ExecutionViewer.tsx`

**Props**:
```typescript
interface ExecutionViewerProps {
  taskDescription: string;
  selectedAgents: string[];
  executionMode: 'sequential' | 'parallel';
  provider: string;
  authToken: string;
}
```

**State**:
```typescript
const [taskId, setTaskId] = useState<string | null>(null);
const [agents, setAgents] = useState<Agent[]>([]);
const [status, setStatus] = useState<'connecting' | 'running' | 'completed' | 'error'>('connecting');
const [error, setError] = useState<string | null>(null);
```

**Flow**:
1. Initialize agents with 'pending' state
2. POST to `/execute/stream` with fetch
3. Read stream using `response.body.getReader()`
4. Parse SSE events line by line
5. Update agents state according to events
6. Show "View Results" when complete

**Features**:
- 🔵 Agent cards in grid (1 col mobile, 2 cols desktop)
- 🎨 Visual states: pending (gray), running (blue pulse), completed (green), error (red)
- ⏱️ Execution time per agent
- ✓ Generated artifacts indicator
- 🔄 Smooth transition animations
- 📱 Responsive design

### 2. NewTask Page Update

**Modified**: `frontend/src/pages/NewTask.tsx`

**Changes**:
```typescript
const [isExecuting, setIsExecuting] = useState(false);

const handleExecute = () => {
  // Validation...
  setIsExecuting(true);  // Shows ExecutionViewer
};

// Conditional rendering
if (isExecuting) {
  return <ExecutionViewer {...props} />;
}

return <TeamBuilder />;  // Normal view
```

**Protection**:
- Confirmation if user tries to leave during execution
- Sticky header with "Back to Dashboard" button
- Full-screen ExecutionViewer view

## Benefits

### For the User

✅ **Total visibility** - See exactly what's happening at all times
✅ **Instant feedback** - Know the system is working
✅ **Transparent times** - See how long each agent takes
✅ **Error detection** - Quickly identify which agent failed
✅ **Better UX** - No more infinite "loading..." without information

### For the System

✅ **Non-blocking** - Server responds immediately with SSE
✅ **Scalable** - Multiple users can execute concurrently
✅ **Easy debug** - SSE events visible in DevTools
✅ **Backwards compatible** - Original `/execute` endpoint still works
✅ **Resilient** - If client disconnects, task continues executing in backend

## SSE Event Format

```
event: agent_start
data: {"taskId":"abc","agentRole":"tech-lead","agentName":"Technical Lead"}

event: agent_progress
data: {"taskId":"abc","agentRole":"tech-lead","message":"Thinking..."}

event: agent_complete
data: {"taskId":"abc","agentRole":"tech-lead","status":"success","executionTime":12500}

event: complete
data: {"taskId":"abc"}
```

## Optimization Implemented

### Prevention of Duplicate Executions

**Problem identified**: In React 18 with Strict Mode, effects execute twice in development, causing creation of 2 simultaneous tasks and doubling API costs.

**Solution implemented**:

1. **ExecutionViewer.tsx** - Use of `useRef` to prevent double execution:
```typescript
const hasStartedRef = useRef(false);

useEffect(() => {
  // Prevent double execution in React Strict Mode or re-renders
  if (hasStartedRef.current) {
    return;
  }
  hasStartedRef.current = true;

  // ... execution code
}, []); // Empty dependency array - execute ONLY ONCE on mount
```

2. **NewTask.tsx** - Prevention of double-clicks:
```typescript
const [isExecuteDisabled, setIsExecuteDisabled] = useState(false);

const handleExecute = () => {
  // Prevent double execution
  if (isExecuteDisabled || isExecuting) {
    return;
  }

  // Disable button immediately to prevent double-clicks
  setIsExecuteDisabled(true);
  setIsExecuting(true);
};
```

**Result**:
- ✅ Only 1 task created per execution
- ✅ 50% reduction in API costs
- ✅ Prevention of accidental double-clicks
- ✅ Consistent behavior in development and production

## Future Improvements

**Could add**:
1. Agent content streaming (text appearing char by char)
2. Progress bar per agent (0-100%)
3. Remaining time estimation
4. Detailed expandable logs per agent
5. Pause/Resume execution
6. Cancel in-progress execution
7. Retry failed agents
8. Save/Export execution logs
9. Audio notifications when complete
10. Desktop notifications

## Modified/Created Files

### Backend

**Modified**:
- `backend/src/services/agents/orchestrator.service.ts` - Added progressCallback
- `backend/src/controllers/agent.controller.ts` - Added executeTaskStream
- `backend/src/routes/agent.routes.ts` - Added /execute/stream route

**Unchanged**:
- DB Schema (no changes needed)
- Existing data models

### Frontend

**Created**:
- `frontend/src/components/execution/ExecutionViewer.tsx` - Main component

**Modified**:
- `frontend/src/pages/NewTask.tsx` - Integration with ExecutionViewer

## Summary

✅ **SSE Implementation** - Real-time streaming from backend
✅ **Progress Events** - 7 detailed event types
✅ **ExecutionViewer** - Professional UI with visual states
✅ **Agent Cards** - Animated cards with real-time states
✅ **Error Handling** - Robust handling of individual and global errors
✅ **Backwards Compatible** - Original endpoint still working
✅ **Mobile Friendly** - Responsive design
✅ **User Experience** - Constant feedback, no more blind loading
✅ **Cost Optimization** - Prevention of duplicate executions (50% cost reduction)

Task execution is now transparent, informative, professional, and optimized. Users see exactly what's happening at every moment, drastically improving the UX of the application while minimizing unnecessary costs.

**Status:** ✅ Real-Time Execution Complete & Optimized!

# AI Team Collaboration Platform

A full-stack web application that enables creating virtual teams of specialized AI agents to collaborate on technical tasks. Results can be visualized or exported directly to GitHub.

## Overview

This platform allows you to create teams of AI agents with different specializations:
- **Tech Lead**: Architecture design and technical decisions
- **Product Owner**: Requirements and user stories
- **Frontend Developer**: UI implementation
- **Backend Developer**: APIs and business logic
- **DevOps Engineer**: CI/CD and infrastructure
- **QA Engineer**: Testing strategies and test cases

## Tech Stack

### Frontend
- **Framework**: Vite + React 18 + TypeScript
- **State Management**: Zustand (global) + React Query (API calls)
- **UI**: Tailwind CSS + Shadcn/ui
- **Icons**: Lucide React
- **Editor**: Monaco Editor (planned)
- **Validation**: Zod

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Authentication**: JWT + bcrypt
- **AI Providers**: @anthropic-ai/sdk, openai, @google/generative-ai
- **GitHub Integration**: @octokit/rest

### Supported AI Providers
1. Anthropic (Claude 3.5 Sonnet)
2. OpenAI (GPT-4, GPT-4-turbo)
3. Google (Gemini Pro)

## Project Structure

```
ai-team/
├── backend/
│   ├── src/
│   │   ├── controllers/      # Request handlers
│   │   ├── middleware/       # Auth, validation, error handling
│   │   ├── services/         # Business logic
│   │   ├── routes/          # API routes
│   │   ├── types/           # TypeScript types
│   │   ├── utils/           # Helper functions
│   │   ├── config/          # Configuration
│   │   ├── prisma/          # Database schema
│   │   └── server.ts        # Express app
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── lib/            # API clients, types, utils
│   │   ├── store/          # Zustand stores
│   │   ├── hooks/          # Custom hooks
│   │   ├── pages/          # Page components
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
└── README.md
```

## Setup Instructions

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Update the `.env` file with your configuration:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/ai_team"
JWT_SECRET="your-super-secret-jwt-key"
ENCRYPTION_SECRET="your-super-secret-encryption-key"
PORT=3000
NODE_ENV="development"
ALLOWED_ORIGINS="http://localhost:5173"
```

5. Run Prisma migrations:
```bash
npm run prisma:generate
npm run prisma:migrate
```

6. Start the development server:
```bash
npm run dev
```

The backend will be running at `http://localhost:3000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Update the `.env` file:
```env
VITE_API_URL="http://localhost:3000/api"
```

5. Start the development server:
```bash
npm run dev
```

The frontend will be running at `http://localhost:5173`

## Features Implemented

### Phase 1: Project Setup ✅
- Backend: Node.js + TypeScript + Express
- Frontend: Vite + React + TypeScript
- Database: PostgreSQL + Prisma ORM
- UI: Tailwind CSS + Shadcn/ui components

### Phase 2: Authentication ✅
- User registration with password validation
- User login with JWT tokens
- Protected routes
- Token persistence and refresh
- Logout functionality

### Phase 3: API Key Management ✅
- Secure API key storage with AES-256-GCM encryption
- Support for multiple AI providers (Anthropic, OpenAI, Google)
- API key CRUD operations
- Provider selection UI
- API key validation

### Phase 4: AI Provider Integration ✅
- Provider interface with unified API
- Anthropic (Claude) provider implementation
  - Claude 3.5 Sonnet, Opus, Sonnet, Haiku
  - Full message API support
- OpenAI (GPT-4) provider implementation
  - GPT-4, GPT-4-turbo, GPT-3.5-turbo
  - Chat completions API
- Google (Gemini) provider implementation
  - Gemini Pro and Pro Vision
  - Content generation API
- Provider factory for dynamic instantiation
- Real API key validation with test requests
- "Test Connection" button in UI

### Phase 5: Agent System ✅
- 6 specialized agent roles with detailed system prompts
  - Technical Lead (architecture & tech decisions)
  - Product Owner (requirements & user stories)
  - Frontend Developer (React/TypeScript UI)
  - Backend Developer (Node.js APIs)
  - DevOps Engineer (CI/CD & infrastructure)
  - QA Engineer (testing strategies)
- Orchestration service with topological sorting
- Sequential execution (respecting dependencies)
- Parallel execution (grouped by dependency level)
- Context building (agents share insights)
- Artifact parsing (code blocks, configs, docs)

### Phase 6: Task Execution ✅
- Task creation and management in database
- Agent controller with execute endpoints
- Real-time execution tracking
- Agent output storage with artifacts
- Task history API
- Team builder UI with agent selection
- Task input form with execution modes
- Provider selection integrated
- NewTask page bringing it all together

### Phase 7: Results Visualization ✅
- TaskResults page with dynamic task loading
- ResultsViewer component displaying task summary
- AgentOutputCard with markdown rendering
- Code syntax highlighting with copy functionality
- ArtifactCard with expand/collapse and download
- Auto-refresh for running tasks (3-second polling)
- Execution time tracking and display
- Status indicators (completed, running, error)
- Recent tasks dashboard widget
- Beautiful responsive UI with Tailwind CSS

### Phase 8: GitHub Export ✅
- GitHub token validation with user info
- Repository listing and selection
- Branch configuration (base and custom names)
- Automatic file organization by agent role
- Pull Request creation with detailed descriptions
- Export history tracking with status
- GitHubExporter component with step-by-step wizard
- ExportHistory dashboard widget
- Direct links to created PRs
- Error handling and status tracking
- **Automatic empty repository initialization** (handles repos without initial commit)
- **Sequential file creation** (prevents SHA conflicts with multiple files)
- Comprehensive logging for debugging export issues

### Phase 9: UI/UX Polish ✅
- Fixed AI Provider selector bug (now loads configured API keys)
- Loading skeletons for better perceived performance
- Improved empty states with helpful guidance and CTAs
- Enhanced responsive design for mobile devices
- Smooth transitions and hover effects on cards
- Button state improvements with tooltips
- Alert component for important messages
- Mobile-optimized layouts and buttons
- Professional animations throughout
- Better user feedback at every step

### Real-Time Task Execution ✅
- Server-Sent Events (SSE) for live progress streaming
- ExecutionViewer component with real-time agent status
- Visual agent cards showing pending/running/completed/error states
- Execution time tracking per agent
- Progress events (task_created, agent_start, agent_progress, agent_complete, etc.)
- Smooth animations and state transitions
- Error handling with detailed feedback
- Sequential and parallel execution visualization
- "View Results" button when execution completes
- Backwards compatible with original /execute endpoint

## Features In Progress

### Phase 10: Testing & Deployment ✅
- Unit tests for encryption service (13 tests passing)
- Unit tests for AI providers (12 tests passing)
- Jest configuration with ts-jest
- Docker configuration (Dockerfiles for backend/frontend)
- Docker Compose setup with PostgreSQL
- CI/CD pipeline with GitHub Actions
- Comprehensive deployment documentation
- Production-ready configuration

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Configuration
- `GET /api/config/providers` - List available AI providers
- `GET /api/config/api-keys` - Get user's API keys
- `POST /api/config/api-keys` - Save API key
- `DELETE /api/config/api-keys/:provider` - Delete API key
- `POST /api/config/api-keys/validate` - Validate API key

### Agents
- `GET /api/agents/definitions` - List available agents
- `POST /api/agents/execute` - Execute agent team
- `GET /api/agents/tasks` - Get task history
- `GET /api/agents/tasks/:id` - Get task details

### GitHub
- `GET /api/github/repositories` - List user repos
- `GET /api/github/user` - Get authenticated GitHub user
- `POST /api/github/export` - Export task to GitHub as PR
- `GET /api/github/exports` - Get export history

## Security Features

- Password hashing with bcrypt (10 rounds)
- JWT token authentication
- API keys encrypted with AES-256-GCM
- CORS configuration
- Rate limiting
- Input validation with Zod
- SQL injection prevention (Prisma ORM)

## Development

### Running Tests
```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test
```

### Building for Production
```bash
# Backend
cd backend
npm run build

# Frontend
cd frontend
npm run build
```

## Contributing

This is a private project. Please contact the maintainer for contribution guidelines.

## License

MIT

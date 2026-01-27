# 🐳 Complete Docker Guide - AI Team

This guide covers everything needed to run the AI Team application using Docker, from local development to production preparation.

## 📋 Table of Contents

1. [Architecture](#architecture)
2. [Prerequisites](#prerequisites)
3. [Initial Configuration](#initial-configuration)
4. [Local Development](#local-development)
5. [Database Management](#database-management)
6. [Useful Commands](#useful-commands)
7. [Troubleshooting](#troubleshooting)

## 🏗️ Architecture

The AI Team application is fully dockerized with the following architecture:

```
┌─────────────────────────────────────────────────────┐
│                   Docker Host                        │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐   │
│  │   Frontend   │  │   Backend    │  │ PostgreSQL│   │
│  │              │  │              │  │           │   │
│  │ React + Vite │◄─┤ Node.js +    │◄─┤ Database  │   │
│  │ + Nginx      │  │ Express +    │  │ (Port     │   │
│  │ (Port 5173)  │  │ TypeScript   │  │  5432)    │   │
│  │              │  │ (Port 3000)  │  │           │   │
│  └──────────────┘  └──────────────┘  └───────────┘   │
│         │                 │                 │        │
│         └─────────────────┴─────────────────┘        │
│                 ai-team-network                      │
│                  (Bridge Network)                    │
│                                                      │
│  Volumes:                                            │
│  • postgres_data → /var/lib/postgresql/data          │
└──────────────────────────────────────────────────────┘
```

### Services

1. **PostgreSQL** (`postgres`)
   - Image: `postgres:15-alpine`
   - Port: 5432
   - Persistent volume for data
   - Health check every 10 seconds

2. **Backend** (`backend`)
   - Build: Multi-stage from `./backend/Dockerfile`
   - Port: 3000
   - Runs migrations automatically on startup
   - Depends on PostgreSQL (waits for health check)

3. **Frontend** (`frontend`)
   - Build: Multi-stage from `./frontend/Dockerfile`
   - Port: 80
   - Nginx serving React SPA
   - Proxy pass to backend for /api/*

### Network and Communication

- **Custom network**: `ai-team-network` (bridge type)
- Services communicate using DNS service names:
  - Frontend → Backend: `http://backend:3000`
  - Backend → PostgreSQL: `postgresql://postgres:5432`

## ✅ Prerequisites

Before you begin, make sure you have installed:

- **Docker Engine** 20.10 or higher
- **Docker Compose** 2.0 or higher
- **Git** (to clone the repository)
- **Minimum 2GB RAM** available for containers
- **4GB disk space** for images and volumes

### Verify Installation

```bash
# Verify Docker
docker --version
# Should show: Docker version 20.10.x or higher

# Verify Docker Compose
docker compose version
# Should show: Docker Compose version v2.x.x or higher

# Verify that Docker is running
docker ps
# Should not show connection error
```

## ⚙️ Initial Configuration

### 1. Clone the Repository

```bash
git clone git@github.com:manurgdev/ai-team.git
cd ai-team
```

### 2. Configure Environment Variables

Copy the example file and edit it:

```bash
cp .env.example .env
```

Edit the `.env` file with your values:

```bash
# You can use nano, vim, or any editor
nano .env
```

### 3. Environment Variables Explained

#### 🗄️ Database

```env
DB_USER=aiuser                    # PostgreSQL user
DB_PASSWORD=aipassword            # PostgreSQL password
DB_NAME=ai_team                   # Database name
DB_PORT=5432                      # Exposed port (host)
```

⚠️ **Important**: In production, use secure passwords, not the example values.

#### 🔐 Security (JWT and Encryption)

```env
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
ENCRYPTION_SECRET=your-super-secret-encryption-key-change-this-in-production-must-be-32-chars
```

⚠️ **CRITICAL**:
- `JWT_SECRET`: Must be a long random string (minimum 32 characters)
- `ENCRYPTION_SECRET`: Must be exactly 32 characters for AES-256
- **NEVER** use example values in production
- Generate secure secrets:
  ```bash
  # JWT_SECRET
  openssl rand -base64 48

  # ENCRYPTION_SECRET (exactly 32 characters)
  openssl rand -base64 32 | cut -c1-32
  ```

#### 🌐 Backend and CORS

```env
NODE_ENV=production               # production or development
BACKEND_PORT=3000                 # Exposed backend port
ALLOWED_ORIGINS=http://localhost:5173,http://localhost
```

`ALLOWED_ORIGINS`: Comma-separated list of allowed origins for CORS.
- **Local development**: `http://localhost:5173,http://localhost`
- **Production**: `https://yourdomain.com,https://www.yourdomain.com`

#### 🎨 Frontend

```env
FRONTEND_PORT=80                  # Exposed frontend port
VITE_API_URL=http://localhost:3000/api
```

`VITE_API_URL`: Backend URL that the frontend will use.
- **Local development**: `http://localhost:3000/api`
- **Production**: `https://api.yourdomain.com/api` or `https://yourdomain.com/api`

#### 🤖 AI API Keys (Optional)

These are optional. Users can configure them within the application:

```env
ANTHROPIC_API_KEY=               # Claude API key
OPENAI_API_KEY=                  # OpenAI API key
GOOGLE_API_KEY=                  # Google AI API key
```

#### 🐙 GitHub OAuth (Optional)

For future GitHub integrations:

```env
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

## 🚀 Local Development

### Start the Application

```bash
# Build images and start all services
docker compose up -d

# View logs in real-time
docker compose logs -f
```

The `-d` option runs containers in background (detached mode).

### Access the Services

Once started, access:

- **Frontend**: http://localhost (port 80)
- **Backend API**: http://localhost:3000
- **PostgreSQL**: localhost:5432

### Check Status

```bash
# View status of all services
docker compose ps

# Should show something like:
# NAME                  IMAGE                COMMAND             STATUS
# ai-team-backend       ai-team-backend      ...                 Up
# ai-team-frontend      ai-team-frontend     ...                 Up
# ai-team-postgres      postgres:15-alpine   ...                 Up (healthy)
```

### View Logs

```bash
# Logs from all services
docker compose logs -f

# Logs from a specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres

# View last 100 lines
docker compose logs --tail=100 backend
```

### Stop the Application

```bash
# Stop services (keeps volumes and network)
docker compose stop

# Stop and remove containers (keeps volumes)
docker compose down

# Stop, remove containers AND volumes (⚠️ deletes data)
docker compose down -v
```

### Rebuild After Code Changes

When you make code changes, you need to rebuild the images:

```bash
# Rebuild all images
docker compose build

# Rebuild without cache (clean build)
docker compose build --no-cache

# Rebuild and restart
docker compose up -d --build

# Rebuild only one service
docker compose build backend
docker compose up -d backend
```

### Hot-Reload in Development

By default, Docker runs production builds. For development with hot-reload:

1. Use `docker-compose.override.yml` (see next section)
2. Or run backend/frontend locally without Docker:

```bash
# Local backend
cd backend
npm install
npm run dev

# Local frontend (in another terminal)
cd frontend
npm install
npm run dev
```

And only run PostgreSQL with Docker:

```bash
docker compose up -d postgres
```

## 🗄️ Database Management

### Run Prisma Migrations

Migrations run automatically when starting the backend, but you can run them manually:

```bash
# Run pending migrations
docker compose exec backend npx prisma migrate deploy --schema=./src/prisma/schema.prisma

# View migration status
docker compose exec backend npx prisma migrate status --schema=./src/prisma/schema.prisma
```

### Generate Prisma Client

If you modify the Prisma schema:

```bash
docker compose exec backend npx prisma generate --schema=./src/prisma/schema.prisma
```

### Prisma Studio (Visual Interface)

Explore and edit data with Prisma Studio:

```bash
docker compose exec backend npx prisma studio --schema=./src/prisma/schema.prisma
```

Then open: http://localhost:5555

### Access PostgreSQL Directly

```bash
# Connect with psql
docker compose exec postgres psql -U aiuser -d ai_team

# Inside psql, you can run SQL queries:
# \dt          - List tables
# \d table     - Describe table
# SELECT * FROM "User";
# \q           - Exit
```

### Database Backup

```bash
# Create backup
docker compose exec postgres pg_dump -U aiuser ai_team > backup_$(date +%Y%m%d_%H%M%S).sql

# Or with compression
docker compose exec postgres pg_dump -U aiuser ai_team | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Restore from Backup

```bash
# Restore from SQL file
docker compose exec -T postgres psql -U aiuser ai_team < backup_20240123_120000.sql

# Restore from compressed file
gunzip -c backup_20240123_120000.sql.gz | docker compose exec -T postgres psql -U aiuser ai_team
```

### Reset Database (⚠️ Deletes All Data)

```bash
# Stop services
docker compose down

# Remove PostgreSQL volume
docker volume rm ai-team_postgres_data

# Restart (will create new empty database)
docker compose up -d
```

## 🛠️ Useful Commands

### Container Management

```bash
# Restart a specific service
docker compose restart backend

# Restart all services
docker compose restart

# View resource statistics (CPU, memory)
docker stats

# View only this app's containers
docker stats ai-team-backend ai-team-frontend ai-team-postgres

# Pause services (without stopping)
docker compose pause

# Resume paused services
docker compose unpause
```

### Execute Commands Inside Containers

```bash
# Open shell in a container
docker compose exec backend sh
docker compose exec frontend sh
docker compose exec postgres sh

# Execute command without opening shell
docker compose exec backend npm run test
docker compose exec backend node --version

# Execute as root (to install packages, etc.)
docker compose exec -u root backend sh
```

### Inspection and Debugging

```bash
# Inspect service configuration
docker compose config

# View container details
docker inspect ai-team-backend

# View logs with timestamps
docker compose logs -f -t backend

# Search in logs
docker compose logs backend | grep ERROR

# View processes inside a container
docker compose exec backend ps aux
```

### Cleanup and Maintenance

```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune

# Remove all unused (containers, networks, images)
docker system prune

# Aggressive cleanup (includes volumes)
docker system prune -a --volumes

# View space used by Docker
docker system df
```

### Network and Connectivity

```bash
# Inspect network
docker network inspect ai-team_ai-team-network

# View container IPs
docker compose exec backend ip addr
docker compose exec backend hostname -i

# Test connectivity between services
docker compose exec backend ping postgres
docker compose exec frontend ping backend

# Verify connectivity to PostgreSQL
docker compose exec backend nc -zv postgres 5432
```

### Environment Variables

```bash
# View environment variables of a container
docker compose exec backend env

# View only DATABASE_URL
docker compose exec backend sh -c 'echo $DATABASE_URL'
```

## 🔍 Troubleshooting

### Error: "Containers already exist"

**Problem**: `ERROR: service "backend" is already running`

**Solution**:
```bash
docker compose down
docker compose up -d
```

### Error: "Port already allocated"

**Problem**: `bind: address already in use` or port 80/3000/5432 in use

**Solution**:
```bash
# Find which process uses the port
lsof -i :80
lsof -i :3000
lsof -i :5432

# Stop that process or change port in .env
# For example:
FRONTEND_PORT=8080
BACKEND_PORT=3001
DB_PORT=5433
```

### Frontend Cannot Connect to Backend

**Problem**: CORS errors or "Failed to fetch"

**Solution**:
1. Check `ALLOWED_ORIGINS` in `.env`
2. Check `VITE_API_URL` in `.env`
3. Rebuild frontend:
   ```bash
   docker compose build frontend
   docker compose up -d frontend
   ```

### Database Does Not Start

**Problem**: PostgreSQL unhealthy or won't start

**Solution**:
```bash
# View detailed logs
docker compose logs postgres

# Check volume permissions
docker volume inspect ai-team_postgres_data

# If it's a permissions issue, recreate the volume
docker compose down -v
docker compose up -d
```

### Backend Fails to Run Migrations

**Problem**: `Error: P1001: Can't reach database server`

**Solution**:
1. Verify that PostgreSQL is healthy:
   ```bash
   docker compose ps
   ```
2. Check `DATABASE_URL` in backend logs:
   ```bash
   docker compose logs backend | grep DATABASE_URL
   ```
3. Restart services respecting dependencies:
   ```bash
   docker compose down
   docker compose up -d postgres
   # Wait until it's healthy (10-20 seconds)
   docker compose up -d backend frontend
   ```

### Container Restarts Continuously

**Problem**: `Restarting` status constantly

**Solution**:
```bash
# View logs to identify error
docker compose logs -f backend

# Check exit code
docker inspect ai-team-backend --format='{{.State.ExitCode}}'

# Common errors:
# - Missing environment variables
# - Port already in use
# - Dependency not available (database)
```

### Code Changes Not Reflected

**Problem**: You modified code but don't see changes

**Solution**:
```bash
# Rebuild image without cache
docker compose build --no-cache backend
docker compose up -d backend

# Or for everything
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Volume Out of Space

**Problem**: `no space left on device`

**Solution**:
```bash
# View space used
docker system df

# Clean unused images
docker image prune -a

# Clean everything
docker system prune -a --volumes

# View volume sizes
docker volume ls
docker system df -v
```

### Cannot Connect from Host

**Problem**: You can't access http://localhost from your browser

**Solution**:
1. Verify that containers are running:
   ```bash
   docker compose ps
   ```
2. Verify that ports are mapped:
   ```bash
   docker compose port frontend 80
   docker compose port backend 3000
   ```
3. Test with curl:
   ```bash
   curl http://localhost
   curl http://localhost:3000/api
   ```

## 📚 Additional Resources

- [Deployment Guide](./DEPLOYMENT.md) - Production deployment
- [Advanced Troubleshooting](./TROUBLESHOOTING-DOCKER.md) - Complex problem solving
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)

## 🆘 Get Help

If you encounter problems not covered in this guide:

1. Check detailed logs: `docker compose logs -f`
2. Consult [TROUBLESHOOTING-DOCKER.md](./TROUBLESHOOTING-DOCKER.md)
3. Search for the error in Docker/GitHub issues
4. Open an issue in the project repository

---

**Next step**: For production deployment, see [DEPLOYMENT.md](./DEPLOYMENT.md)

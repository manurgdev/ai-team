# Troubleshooting Guide

Guide for solving common problems when cloning and running the project.

## Problem: Database without tables

### Symptom
When running `./scripts/dev/start-dev.sh`, the backend starts but there are no tables in the database.

### Diagnosis
```bash
# Check database status
./scripts/dev/check-db.sh
```

### Solutions

#### Option 1: Run migrations manually
```bash
docker compose exec backend npx prisma migrate deploy --schema=./src/prisma/schema.prisma
```

#### Option 2: Restart the backend container
```bash
docker compose restart backend
docker compose logs -f backend
```

#### Option 3: Complete reset (⚠️ Deletes all data)
```bash
docker compose down -v
docker compose up -d
```

## Problem: Error "role does not exist"

### Symptom
Error when connecting to PostgreSQL: `FATAL: role "xxx" does not exist`

### Solution
1. Verify that the `.env` file in the project root has the correct credentials:
   ```env
   DB_USER=ai_team
   DB_PASSWORD=ai_team_secer
   DB_NAME=ai_team_db
   ```

2. If you changed the credentials, you need to recreate the containers:
   ```bash
   docker compose down -v
   docker compose up -d
   ```

## Problem: Backend not responding

### Symptom
The backend container is "Up" but doesn't respond at http://localhost:3000

### Diagnosis
```bash
# View backend logs
docker compose logs -f backend

# Check container status
docker compose ps
```

### Possible causes and solutions

#### 1. Migrations failing
```bash
# View specific migration logs
docker compose logs backend | grep -i "prisma\|migration"

# Run migrations manually
docker compose exec backend npx prisma migrate deploy --schema=./src/prisma/schema.prisma
```

#### 2. Error in environment variables
```bash
# Verify that .env exists
ls -la .env

# If it doesn't exist, copy from template
cp .env.example .env

# Edit .env and configure secrets
vim .env  # or your preferred editor

# Restart containers
docker compose restart
```

#### 3. Port occupied
```bash
# Check if port 3000 is occupied
lsof -i :3000

# Change port in .env if necessary
echo "BACKEND_PORT=3001" >> .env
docker compose restart backend
```

## Problem: Frontend not loading

### Symptom
Vite starts but shows errors when loading the application

### Diagnosis
```bash
# View frontend logs
docker compose logs -f frontend

# Verify that Vite is serving
curl http://localhost:5173
```

### Solutions

#### 1. Missing configuration files
The error may indicate that `tsconfig.node.json` or other config files are missing.

```bash
# Verify that all config files exist
ls -la frontend/tsconfig*.json frontend/vite.config.ts

# Restart frontend
docker compose restart frontend
```

#### 2. Corrupted node modules
```bash
# Rebuild frontend image
docker compose build frontend --no-cache
docker compose up -d frontend
```

## Problem: Code changes not reflected

### Symptom
You modify files but changes don't appear in the application

### Solution for Backend
```bash
# Verify that tsx watch is running
docker compose logs backend | grep "watch"

# If not using watch, restart
docker compose restart backend
```

### Solution for Frontend
```bash
# Verify that Vite HMR is active
docker compose logs frontend | grep "ready"

# Restart frontend
docker compose restart frontend
```

## Useful commands

### View logs in real-time
```bash
# All services
docker compose logs -f

# Backend only
docker compose logs -f backend

# Frontend only
docker compose logs -f frontend

# PostgreSQL only
docker compose logs -f postgres
```

### Access containers
```bash
# Shell in backend
docker compose exec backend sh

# Shell in frontend
docker compose exec frontend sh

# Shell in PostgreSQL
docker compose exec postgres psql -U ai_team -d ai_team_db
```

### Complete cleanup
```bash
# Stop and remove containers + volumes
docker compose down -v

# Remove images as well
docker compose down -v --rmi all

# Rebuild from scratch
docker compose build --no-cache
docker compose up -d
```

### Check general status
```bash
# Container status
docker compose ps

# Resource usage
docker stats

# Check networks
docker network ls | grep ai-team

# Check volumes
docker volume ls | grep ai-team
```

## Prerequisites

Make sure you have installed:
- Docker Desktop (or Docker Engine + Docker Compose)
- Git
- A text editor

Recommended versions:
- Docker: >= 24.0
- Docker Compose: >= 2.20

## Need more help?

If none of these solutions work:

1. Review the complete logs:
   ```bash
   docker compose logs > logs.txt
   ```

2. Verify your configuration:
   ```bash
   cat .env
   docker compose config
   ```

3. Open an issue on GitHub with:
   - Operating system and version
   - Docker version
   - Complete logs
   - Exact steps you followed

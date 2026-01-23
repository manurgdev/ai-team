# Deployment Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development](#local-development)
3. [Docker Deployment](#docker-deployment)
4. [Production Deployment](#production-deployment)
5. [Environment Variables](#environment-variables)
6. [Database Migrations](#database-migrations)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Node.js 20+ (for local development)
- PostgreSQL 14+ (for local development)
- Docker & Docker Compose (for containerized deployment)
- Git

---

## Local Development

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Update `.env` with your configuration:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/ai_team"
JWT_SECRET="your-super-secret-jwt-key"
ENCRYPTION_SECRET="your-super-secret-encryption-key-32-chars"
PORT=3000
NODE_ENV="development"
ALLOWED_ORIGINS="http://localhost:5173"
```

5. Generate Prisma Client and run migrations:
```bash
npm run prisma:generate
npm run prisma:migrate
```

6. Start the development server:
```bash
npm run dev
```

The backend will be running at `http://localhost:3000`.

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Update `.env`:
```env
VITE_API_URL="http://localhost:3000/api"
```

5. Start the development server:
```bash
npm run dev
```

The frontend will be running at `http://localhost:5173`.

---

## Docker Deployment

### Using Docker Compose (Recommended)

1. Clone the repository:
```bash
git clone <repository-url>
cd ai-team
```

2. Create `.env` file in the root directory:
```bash
cp .env.example .env
```

3. **IMPORTANT**: Update the following secrets in `.env`:
```env
JWT_SECRET=<generate-a-secure-random-string>
ENCRYPTION_SECRET=<generate-a-32-character-string>
DB_PASSWORD=<strong-database-password>
```

Generate secure secrets:
```bash
# Generate JWT Secret (32 characters)
openssl rand -base64 32

# Generate Encryption Secret (must be exactly 32 characters)
openssl rand -base64 24
```

4. Build and start all services:
```bash
docker-compose up -d
```

This will start:
- PostgreSQL database on port 5432
- Backend API on port 3000
- Frontend on port 80

5. Check service status:
```bash
docker-compose ps
```

6. View logs:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

7. Stop services:
```bash
docker-compose down
```

8. Stop and remove volumes (⚠️ deletes database data):
```bash
docker-compose down -v
```

### Manual Docker Build

If you want to build and run containers manually:

**Backend:**
```bash
cd backend
docker build -t ai-team-backend .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:password@host:5432/ai_team" \
  -e JWT_SECRET="your-secret" \
  -e ENCRYPTION_SECRET="your-32-char-secret" \
  ai-team-backend
```

**Frontend:**
```bash
cd frontend
docker build -t ai-team-frontend .
docker run -p 80:80 ai-team-frontend
```

---

## Production Deployment

### Deployment Checklist

Before deploying to production:

- [ ] Update all secrets in `.env` (JWT_SECRET, ENCRYPTION_SECRET, DB_PASSWORD)
- [ ] Set `NODE_ENV=production`
- [ ] Configure proper CORS origins in `ALLOWED_ORIGINS`
- [ ] Set up SSL/TLS certificates (use Let's Encrypt or cloud provider)
- [ ] Enable database backups
- [ ] Set up monitoring and logging
- [ ] Configure rate limiting
- [ ] Review security headers
- [ ] Test all API endpoints
- [ ] Test frontend builds

### Recommended Hosting Options

#### Option 1: Railway

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Login to Railway:
```bash
railway login
```

3. Create new project:
```bash
railway init
```

4. Add PostgreSQL:
```bash
railway add postgres
```

5. Deploy backend:
```bash
cd backend
railway up
```

6. Deploy frontend:
```bash
cd frontend
railway up
```

#### Option 2: Render

1. Create account at [render.com](https://render.com)

2. Create PostgreSQL database:
   - Click "New +" → "PostgreSQL"
   - Note the connection string

3. Deploy backend:
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Root directory: `backend`
   - Build command: `npm install && npm run build && npx prisma migrate deploy`
   - Start command: `npm start`
   - Add environment variables from `.env`

4. Deploy frontend:
   - Click "New +" → "Static Site"
   - Root directory: `frontend`
   - Build command: `npm install && npm run build`
   - Publish directory: `dist`

#### Option 3: VPS (DigitalOcean, AWS EC2, etc.)

1. Set up Ubuntu 22.04 server

2. Install Docker and Docker Compose:
```bash
sudo apt update
sudo apt install docker.io docker-compose -y
sudo systemctl enable docker
sudo systemctl start docker
```

3. Clone repository:
```bash
git clone <repository-url>
cd ai-team
```

4. Create and configure `.env` file

5. Run with Docker Compose:
```bash
docker-compose up -d
```

6. Set up Nginx reverse proxy (optional):
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        proxy_pass http://localhost:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

7. Enable SSL with Certbot:
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com
```

---

## Environment Variables

### Backend Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `JWT_SECRET` | Yes | - | Secret for signing JWT tokens |
| `JWT_EXPIRES_IN` | No | `7d` | JWT expiration time |
| `ENCRYPTION_SECRET` | Yes | - | 32-character secret for encrypting API keys |
| `PORT` | No | `3000` | Backend server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `ALLOWED_ORIGINS` | Yes | - | Comma-separated list of allowed CORS origins |
| `ANTHROPIC_API_KEY` | No | - | Default Anthropic API key (optional) |
| `OPENAI_API_KEY` | No | - | Default OpenAI API key (optional) |
| `GOOGLE_API_KEY` | No | - | Default Google API key (optional) |

### Frontend Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | Yes | - | Backend API URL |

### Docker Compose Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_USER` | No | `aiuser` | PostgreSQL username |
| `DB_PASSWORD` | Yes | - | PostgreSQL password |
| `DB_NAME` | No | `ai_team` | PostgreSQL database name |
| `DB_PORT` | No | `5432` | PostgreSQL port |
| `BACKEND_PORT` | No | `3000` | Backend exposed port |
| `FRONTEND_PORT` | No | `80` | Frontend exposed port |

---

## Database Migrations

### Running Migrations

**Development:**
```bash
cd backend
npm run prisma:migrate
```

**Production (Docker):**
Migrations run automatically on container startup.

**Manual migration in production:**
```bash
docker-compose exec backend npx prisma migrate deploy --schema=./src/prisma/schema.prisma
```

### Creating New Migrations

1. Modify `backend/src/prisma/schema.prisma`

2. Create migration:
```bash
cd backend
npm run prisma:migrate
```

3. Enter migration name when prompted

4. Commit both the schema and migration files

### Reset Database (⚠️ Deletes all data)

```bash
cd backend
npx prisma migrate reset --schema=./src/prisma/schema.prisma
```

---

## Troubleshooting

### Backend Issues

**Issue: "Database connection failed"**

Solution:
- Check `DATABASE_URL` in `.env`
- Verify PostgreSQL is running: `docker-compose ps` or `pg_isready`
- Test connection: `psql $DATABASE_URL`

**Issue: "JWT_SECRET not defined"**

Solution:
- Ensure `.env` file exists in backend directory
- Verify `JWT_SECRET` is set in `.env`

**Issue: "Prisma Client not generated"**

Solution:
```bash
cd backend
npm run prisma:generate
```

### Frontend Issues

**Issue: "Cannot connect to API"**

Solution:
- Check `VITE_API_URL` in frontend `.env`
- Verify backend is running: `curl http://localhost:3000/health`
- Check CORS configuration in backend

**Issue: "Build failed"**

Solution:
```bash
cd frontend
rm -rf node_modules
npm install
npm run build
```

### Docker Issues

**Issue: "Port already in use"**

Solution:
- Change ports in `.env`:
  ```env
  BACKEND_PORT=3001
  FRONTEND_PORT=8080
  DB_PORT=5433
  ```
- Or stop conflicting services

**Issue: "Container exits immediately"**

Solution:
```bash
# Check logs
docker-compose logs backend

# Check environment variables
docker-compose exec backend env

# Restart services
docker-compose restart
```

**Issue: "Database initialization failed"**

Solution:
```bash
# Remove volumes and restart
docker-compose down -v
docker-compose up -d
```

### General Issues

**Issue: "API returns 401 Unauthorized"**

Solution:
- Check if JWT token is valid
- Verify token is sent in Authorization header: `Bearer <token>`
- Check JWT_SECRET matches between sessions

**Issue: "Slow performance"**

Solution:
- Check database indexes
- Enable query logging
- Monitor container resources: `docker stats`
- Scale containers if needed

---

## Health Checks

### Backend Health Check
```bash
curl http://localhost:3000/health
# Expected: {"status":"ok","timestamp":"..."}
```

### Database Health Check
```bash
docker-compose exec postgres pg_isready -U aiuser
# Expected: postgres:5432 - accepting connections
```

### Frontend Health Check
```bash
curl http://localhost
# Expected: HTML content
```

---

## Backup and Restore

### Backup Database

```bash
# Using Docker
docker-compose exec postgres pg_dump -U aiuser ai_team > backup.sql

# Or with custom format (recommended)
docker-compose exec postgres pg_dump -U aiuser -Fc ai_team > backup.dump
```

### Restore Database

```bash
# From SQL file
docker-compose exec -T postgres psql -U aiuser ai_team < backup.sql

# From custom format
docker-compose exec -T postgres pg_restore -U aiuser -d ai_team backup.dump
```

### Automated Backups

Add to crontab:
```bash
# Daily backup at 2 AM
0 2 * * * cd /path/to/ai-team && docker-compose exec postgres pg_dump -U aiuser -Fc ai_team > backups/backup-$(date +\%Y\%m\%d).dump
```

---

## Monitoring

### Logs

**View all logs:**
```bash
docker-compose logs -f
```

**Filter by service:**
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

**Last N lines:**
```bash
docker-compose logs --tail=100 backend
```

### Metrics

**Container stats:**
```bash
docker stats ai-team-backend ai-team-frontend ai-team-postgres
```

**Database size:**
```bash
docker-compose exec postgres psql -U aiuser -d ai_team -c "SELECT pg_size_pretty(pg_database_size('ai_team'));"
```

---

## Security Best Practices

1. **Never commit `.env` files to version control**
2. **Use strong, unique secrets** for JWT and encryption
3. **Enable SSL/TLS** in production
4. **Regularly update dependencies**: `npm audit` and `npm update`
5. **Implement rate limiting** (already configured in backend)
6. **Use a reverse proxy** (Nginx/Caddy) in production
7. **Enable database encryption at rest**
8. **Set up automated backups**
9. **Monitor logs for suspicious activity**
10. **Keep Docker images updated**: `docker-compose pull && docker-compose up -d`

---

## Support

For issues and questions:
- Check [README.md](./README.md) for project overview
- Review [REAL_TIME_EXECUTION.md](./REAL_TIME_EXECUTION.md) for SSE feature details
- Open an issue on GitHub
- Contact the maintainer

---

**Last Updated:** 2026-01-16

# 🔧 Docker Troubleshooting - AI Team

Complete guide for solving common problems with Docker and the AI Team application.

## 📋 Table of Contents

1. [Startup Problems](#startup-problems)
2. [Network and Connectivity Problems](#network-and-connectivity-problems)
3. [Database Problems](#database-problems)
4. [Build Problems](#build-problems)
5. [Performance Problems](#performance-problems)
6. [Volume Problems](#volume-problems)
7. [Permission Problems](#permission-problems)
8. [Application-Specific Problems](#application-specific-problems)
9. [Diagnostic Tools](#diagnostic-tools)
10. [FAQ](#faq)

## 🚀 Startup Problems

### Error: "Cannot connect to Docker daemon"

**Symptom:**
```
Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?
```

**Cause:** Docker is not running

**Solution:**
```bash
# Linux
sudo systemctl start docker
sudo systemctl enable docker

# macOS
# Open Docker Desktop

# Verify
docker ps
```

### Error: "Service already running"

**Symptom:**
```
ERROR: service "backend" is already running
```

**Cause:** Containers are already running

**Solution:**
```bash
# View active containers
docker compose ps

# Stop all
docker compose down

# Start again
docker compose up -d
```

### Error: "Port is already allocated"

**Symptom:**
```
Error starting userland proxy: listen tcp4 0.0.0.0:80: bind: address already in use
```

**Cause:** Port is already in use by another process

**Solution:**
```bash
# Identify what's using the port
lsof -i :80
lsof -i :3000
lsof -i :5432

# Option 1: Stop the conflicting process
sudo kill -9 <PID>

# Option 2: Change ports in .env
nano .env
# Change:
FRONTEND_PORT=8080
BACKEND_PORT=3001
DB_PORT=5433

# Restart services
docker compose down
docker compose up -d
```

### Error: "Container exits immediately"

**Symptom:** Container starts and exits right away

**Diagnosis:**
```bash
# View logs
docker compose logs backend
docker compose logs -f backend

# View exit code
docker inspect ai-team-backend --format='{{.State.ExitCode}}'

# Common codes:
# 0 - Normal exit (unusual for services)
# 1 - Application error
# 137 - Killed by OOM (out of memory)
# 139 - Segmentation fault
# 143 - Terminated with SIGTERM
```

**Common solutions:**
```bash
# 1. Missing environment variable
docker compose config  # Verify configuration

# 2. Problem with startup command
docker compose exec backend sh
# Run command manually to see error

# 3. Missing dependency
docker compose build --no-cache backend
```

### Error: "Unhealthy" status

**Symptom:**
```bash
docker compose ps
# Shows: postgres (unhealthy)
```

**Solution:**
```bash
# View detailed logs
docker compose logs postgres

# View healthcheck details
docker inspect ai-team-postgres --format='{{json .State.Health}}' | jq

# Wait longer (may take 30-60 seconds)
watch -n 2 'docker compose ps'

# If it persists, recreate container
docker compose down
docker volume rm ai-team_postgres_data  # ⚠️ Deletes data
docker compose up -d
```

## 🌐 Network and Connectivity Problems

### Frontend cannot connect to Backend

**Symptom:** CORS errors or "Failed to fetch" in browser

**Diagnosis:**
```bash
# 1. Verify backend is running
curl http://localhost:3000/api/health

# 2. Verify environment variables
docker compose exec frontend env | grep VITE_API_URL
docker compose exec backend env | grep ALLOWED_ORIGINS

# 3. View backend logs
docker compose logs -f backend | grep CORS
```

**Solutions:**

**Problem 1: Incorrect VITE_API_URL**
```bash
# Check .env
cat .env | grep VITE_API_URL

# Should be:
VITE_API_URL=http://localhost:3000/api  # Local development
# or
VITE_API_URL=https://yourdomain.com/api  # Production

# Rebuild frontend if you change this
docker compose build frontend
docker compose up -d frontend
```

**Problem 2: CORS not allowing origin**
```bash
# Check ALLOWED_ORIGINS in .env
cat .env | grep ALLOWED_ORIGINS

# Should include frontend origin
ALLOWED_ORIGINS=http://localhost,http://localhost:5173

# Restart backend
docker compose restart backend
```

**Problem 3: Docker network isolated**
```bash
# Verify services are in same network
docker network inspect ai-team_ai-team-network

# Should show frontend, backend, postgres

# If not, recreate:
docker compose down
docker compose up -d
```

### Backend cannot connect to PostgreSQL

**Symptom:**
```
Error: P1001: Can't reach database server at postgres:5432
```

**Diagnosis:**
```bash
# 1. Verify postgres is healthy
docker compose ps

# 2. View postgres logs
docker compose logs postgres

# 3. Check DATABASE_URL
docker compose exec backend sh -c 'echo $DATABASE_URL'

# 4. Test connectivity
docker compose exec backend ping postgres
docker compose exec backend nc -zv postgres 5432
```

**Solutions:**

**Problem 1: PostgreSQL not ready**
```bash
# Wait until it's healthy (may take 20-30s)
watch -n 2 'docker compose ps'

# View healthcheck
docker compose logs postgres | grep "database system is ready"
```

**Problem 2: Incorrect DATABASE_URL**
```bash
# Must use service name "postgres", not "localhost"
# ❌ WRONG:
DATABASE_URL=postgresql://aiuser:pass@localhost:5432/ai_team

# ✅ CORRECT:
DATABASE_URL=postgresql://aiuser:pass@postgres:5432/ai_team

# Or use variables:
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
```

**Problem 3: Startup order**
```bash
# Backend must wait for postgres
# Check depends_on in docker-compose.yml

# Restart in correct order
docker compose down
docker compose up -d postgres
# Wait 20 seconds
docker compose up -d backend frontend
```

### DNS doesn't resolve service names

**Symptom:** `ping: postgres: Name or service not known`

**Solution:**
```bash
# Check network
docker network ls
docker network inspect ai-team_ai-team-network

# Recreate network
docker compose down
docker network prune
docker compose up -d
```

## 🗄️ Database Problems

### Error: "relation does not exist"

**Symptom:**
```
ERROR: relation "User" does not exist
```

**Cause:** Prisma migrations haven't been executed

**Solution:**
```bash
# Check migration status
docker compose exec backend npx prisma migrate status --schema=./src/prisma/schema.prisma

# Execute pending migrations
docker compose exec backend npx prisma migrate deploy --schema=./src/prisma/schema.prisma

# If it persists, complete reset (⚠️ deletes data)
docker compose down
docker volume rm ai-team_postgres_data
docker compose up -d
```

### Error: "password authentication failed"

**Symptom:**
```
FATAL: password authentication failed for user "aiuser"
```

**Cause:** Password in DATABASE_URL doesn't match DB_PASSWORD

**Solution:**
```bash
# Check variables
cat .env | grep DB_
cat .env | grep DATABASE_URL

# DB_PASSWORD and DATABASE_URL must match

# If you changed password, recreate postgres container
docker compose down
docker volume rm ai-team_postgres_data
docker compose up -d
```

### PostgreSQL runs out of memory

**Symptom:**
```
FATAL: out of memory
```

**Solution:**
```bash
# View memory usage
docker stats ai-team-postgres

# Increase limit in docker-compose.prod.yml
services:
  postgres:
    deploy:
      resources:
        limits:
          memory: 2G  # Increase

# Apply changes
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Database locks

**Symptom:** Very slow queries, timeouts

**Diagnosis:**
```sql
-- Connect to DB
docker compose exec postgres psql -U aiuser ai_team

-- View active locks
SELECT pid, usename, query, state
FROM pg_stat_activity
WHERE state != 'idle';

-- View blocking locks
SELECT
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query AS blocked_statement,
  blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
  AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
  AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
  AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
  AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
  AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
  AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

**Solution:**
```sql
-- Terminate blocking process (careful!)
SELECT pg_terminate_backend(<blocking_pid>);

-- Or restart postgres
-- docker compose restart postgres
```

## 🔨 Build Problems

### Error: "COPY failed"

**Symptom:**
```
COPY failed: file not found in build context
```

**Cause:** File referenced in Dockerfile doesn't exist or is in .dockerignore

**Solution:**
```bash
# Verify files exist
ls -la backend/package.json
ls -la frontend/package.json

# Check .dockerignore
cat .dockerignore

# Rebuild without cache
docker compose build --no-cache
```

### Error: "npm install failed"

**Symptom:**
```
npm ERR! code ENOTFOUND
npm ERR! errno ENOTFOUND
```

**Cause:** No internet connection or misconfigured proxy

**Solution:**
```bash
# Check connection
ping registry.npmjs.org

# If using corporate proxy
docker build --build-arg HTTP_PROXY=http://proxy:8080 \
             --build-arg HTTPS_PROXY=http://proxy:8080 \
             backend/

# Clean npm cache
docker compose build --no-cache --build-arg NPM_CONFIG_CACHE=/tmp/npm-cache
```

### "Layer does not exist" or "No space left on device"

**Symptom:** Error when building images

**Solution:**
```bash
# View space used
docker system df

# Clean unused images
docker image prune -a

# Clean everything (⚠️ careful)
docker system prune -a --volumes

# Increase Docker Desktop space (macOS/Windows)
# Settings → Resources → Disk image size
```

## ⚡ Performance Problems

### Very slow containers

**Diagnosis:**
```bash
# View resource usage
docker stats

# View processes inside container
docker compose exec backend top

# View I/O
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.BlockIO}}"
```

**Solutions:**

**1. Increase resources:**
```yaml
# docker-compose.prod.yml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
```

**2. Optimize DB queries:**
```bash
# View slow queries
docker compose exec postgres psql -U aiuser ai_team -c "
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;"

# Analyze specific query
docker compose exec postgres psql -U aiuser ai_team -c "
EXPLAIN ANALYZE SELECT * FROM \"User\";"
```

**3. Docker cache:**
```bash
# On macOS, use VirtioFS instead of gRPC FUSE
# Docker Desktop → Settings → Experimental Features → VirtioFS
```

### Very slow build

**Solution:**
```bash
# Use BuildKit (faster)
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Build
docker compose build

# Use layer cache
docker compose build --build-arg BUILDKIT_INLINE_CACHE=1
```

### High CPU/memory usage

**Diagnosis:**
```bash
# View top processes
docker compose exec backend ps aux --sort=-%cpu | head

# View memory usage
docker compose exec backend free -h
```

**Solution:**
```bash
# Limit resources
# See previous section on resource limits

# Restart container
docker compose restart backend

# Check for memory leaks in application
docker compose exec backend node --max-old-space-size=512 dist/server.js
```

## 💾 Volume Problems

### Data doesn't persist

**Symptom:** Data is lost on restart

**Cause:** Volume not configured or deleted

**Solution:**
```bash
# Check volumes
docker volume ls
docker volume inspect ai-team_postgres_data

# DO NOT use -v when stopping (removes volumes)
docker compose down       # ✅ Keeps data
docker compose down -v    # ❌ Deletes data

# Recreate volume only if necessary
docker volume create ai-team_postgres_data
```

### Volume full

**Symptom:**
```
ERROR: No space left on device
```

**Solution:**
```bash
# View volume size
docker system df -v

# Clean old data in DB
docker compose exec postgres psql -U aiuser ai_team -c "VACUUM FULL;"

# Delete old logs
docker compose exec backend find /app/logs -mtime +7 -delete

# Increase host disk space
```

### Incorrect permissions on volume

**Symptom:** Permission denied when writing

**Solution:**
```bash
# View permissions
docker compose exec backend ls -la /app

# Change owner (as root)
docker compose exec -u root backend chown -R nodejs:nodejs /app

# Or recreate volume with correct permissions
docker compose down
docker volume rm <volume>
docker compose up -d
```

## 🔐 Permission Problems

### "Permission denied" when executing commands

**Solution:**
```bash
# Execute as root
docker compose exec -u root backend sh

# Add user to docker group (Linux)
sudo usermod -aG docker $USER
# Logout and login to apply

# Change socket permissions (Linux)
sudo chmod 666 /var/run/docker.sock
```

### "Operation not permitted" in container

**Solution:**
```bash
# Add necessary capabilities
# docker-compose.yml
services:
  backend:
    cap_add:
      - SYS_ADMIN  # Only if you really need it
```

## 🐛 Application-Specific Problems

### Invalid JWT Token

**Symptom:** 401 Unauthorized on all requests

**Cause:** JWT_SECRET changed or expired tokens

**Solution:**
```bash
# Verify JWT_SECRET didn't change
docker compose exec backend sh -c 'echo $JWT_SECRET'

# If it changed, users must re-login
# If it persists, check validation code

# View logs
docker compose logs backend | grep JWT
```

### Encryption/Decryption errors

**Symptom:** "Decryption failed" when getting API keys

**Cause:** ENCRYPTION_SECRET changed or doesn't have 32 characters

**Solution:**
```bash
# Check length (must be exactly 32)
docker compose exec backend sh -c 'echo -n $ENCRYPTION_SECRET | wc -c'

# If it changed, old API keys CANNOT be recovered
# Users must re-configure API keys
```

### AI Provider APIs failing

**Symptom:** Errors when executing tasks with agents

**Diagnosis:**
```bash
# View logs
docker compose logs backend | grep -i anthropic
docker compose logs backend | grep -i openai

# Test connectivity
docker compose exec backend curl https://api.anthropic.com
docker compose exec backend curl https://api.openai.com

# Check API keys (don't reveal value!)
docker compose exec backend sh -c 'test -n "$ANTHROPIC_API_KEY" && echo "Set" || echo "Not set"'
```

**Solution:**
- Verify API key is valid
- Check API quota/limits
- Verify firewall doesn't block outgoing requests

### Server-Sent Events (SSE) not working

**Symptom:** No real-time updates visible

**Cause:** Nginx or proxy buffering SSE

**Solution:**

**Nginx:**
```nginx
location /api/agents/execute-stream {
    proxy_pass http://backend:3000;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;  # IMPORTANT for SSE
    proxy_cache off;
    proxy_read_timeout 300s;
}
```

**Docker:** Already configured correctly

## 🔧 Diagnostic Tools

### Complete diagnostic script

```bash
#!/bin/bash
# diagnostico.sh

echo "=== AI Team - Docker Diagnostics ==="
echo ""

echo "1. Versions:"
docker --version
docker compose version
echo ""

echo "2. Service status:"
docker compose ps
echo ""

echo "3. Resource usage:"
docker stats --no-stream
echo ""

echo "4. Volumes:"
docker volume ls | grep ai-team
echo ""

echo "5. Networks:"
docker network ls | grep ai-team
echo ""

echo "6. Recent logs (last 50 lines):"
echo "--- Backend ---"
docker compose logs --tail=50 backend
echo ""
echo "--- Frontend ---"
docker compose logs --tail=50 frontend
echo ""
echo "--- PostgreSQL ---"
docker compose logs --tail=50 postgres
echo ""

echo "7. Health checks:"
echo "Frontend:"
curl -s http://localhost/ > /dev/null && echo "✅ OK" || echo "❌ FAIL"
echo "Backend:"
curl -s http://localhost:3000/api/health && echo "" || echo "❌ FAIL"
echo "PostgreSQL:"
docker compose exec postgres pg_isready -U aiuser
echo ""

echo "8. Environment variables (without sensitive values):"
echo "Backend:"
docker compose exec backend env | grep -E "NODE_ENV|PORT|ALLOWED_ORIGINS" | sort
echo "Frontend:"
docker compose exec frontend env | grep VITE_ | sort
echo ""

echo "9. Disk space:"
docker system df
echo ""

echo "=== End of diagnostics ==="
```

```bash
chmod +x diagnostico.sh
./diagnostico.sh > diagnostico_$(date +%Y%m%d_%H%M%S).txt
```

### Useful diagnostic commands

```bash
# View effective docker-compose configuration
docker compose config

# Inspect container
docker inspect ai-team-backend | jq

# View logs with timestamps
docker compose logs -f -t backend

# View last 100 lines
docker compose logs --tail=100 backend

# Search in logs
docker compose logs backend | grep -i error
docker compose logs backend | grep -i "status code"

# View processes in container
docker compose exec backend ps aux

# View exposed ports
docker compose port backend 3000
docker compose port frontend 80

# View container IPs
docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ai-team-backend

# Test connectivity between services
docker compose exec frontend ping -c 3 backend
docker compose exec backend ping -c 3 postgres

# View Docker daemon logs (Linux)
journalctl -u docker -f
```

## ❓ FAQ

### Why is my container restarting continuously?

View logs with `docker compose logs -f <service>`. Common causes:
- Missing environment variable
- Port already in use
- Dependent service not available
- Required file missing

### How do I update a base image?

```bash
# Rebuild with --pull
docker compose build --pull

# Or manual
docker pull node:20-alpine
docker pull postgres:15-alpine
docker compose build --no-cache
docker compose up -d
```

### How do I clean Docker completely?

```bash
# Stop everything
docker compose down -v

# Remove everything (⚠️ CAREFUL)
docker system prune -a --volumes

# Verify
docker ps -a  # Should show nothing
docker images  # Should show nothing
docker volume ls  # Should show nothing
```

### How do I migrate data to a new server?

```bash
# Source server
docker compose exec postgres pg_dump -U aiuser ai_team | gzip > backup.sql.gz

# Copy to new server
scp backup.sql.gz user@new-server:/tmp/

# Destination server
docker compose up -d postgres
# Wait until ready
gunzip -c /tmp/backup.sql.gz | docker compose exec -T postgres psql -U aiuser ai_team
docker compose up -d
```

### How do I debug a container that won't start?

```bash
# View detailed logs
docker compose logs -f backend

# Enter and execute command manually
docker compose run --rm --entrypoint sh backend
# Inside container:
npm start  # View direct error

# Override command temporarily
docker compose run --rm --entrypoint sh backend -c "npm run debug"
```

### Why does the build ignore code changes?

```bash
# Rebuild without cache
docker compose build --no-cache backend

# Or remove image and rebuild
docker rmi ai-team-backend
docker compose build backend
docker compose up -d backend
```

---

## 📚 More Resources

- [README-DOCKER.md](./README-DOCKER.md) - Main Docker guide
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment
- [SECURITY-DOCKER.md](./SECURITY-DOCKER.md) - Security
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Troubleshooting](https://docs.docker.com/compose/faq/)

---

**If you find a problem not documented here, please open an issue in the repository. 🐛**

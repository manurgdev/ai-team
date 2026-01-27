# AI Team Scripts

This directory contains useful scripts to manage the AI Team application with Docker.

## 📁 Structure

```
scripts/
├── dev/              # Development scripts
├── prod/             # Production scripts
└── maintenance/      # Maintenance scripts
```

## 🔧 Development Scripts (`dev/`)

### `start-dev.sh`
Starts the complete development environment.

```bash
./scripts/dev/start-dev.sh
```

**What it does:**
- Verifies Docker is running
- Creates .env file if it doesn't exist
- Starts all services with Docker Compose
- Waits for services to be ready
- Runs health checks
- Displays access URLs

### `stop-dev.sh`
Stops the development environment.

```bash
./scripts/dev/stop-dev.sh
```

**What it does:**
- Stops all containers
- Preserves volumes (DB data)

### `reset-db.sh`
Resets the database (**DELETES ALL DATA**).

```bash
./scripts/dev/reset-db.sh
```

**What it does:**
- Requests confirmation
- Stops services
- Removes PostgreSQL volume
- Restarts services
- Runs migrations

⚠️ **Warning:** This deletes all data. Use only in development.

### `logs.sh`
Displays service logs.

```bash
# View logs from all services
./scripts/dev/logs.sh

# View logs from a specific service
./scripts/dev/logs.sh backend
./scripts/dev/logs.sh frontend
./scripts/dev/logs.sh postgres
```

## 🛠️ Maintenance Scripts (`maintenance/`)

### `update-images.sh`
Updates Docker base images.

```bash
./scripts/maintenance/update-images.sh
```

**What it does:**
- Downloads latest versions of:
  - `node:20-alpine`
  - `postgres:15-alpine`
  - `nginx:alpine`
- Rebuilds application images
- Optionally cleans up old images

⚠️ **Note:** Requires restarting services to apply changes.

### `cleanup.sh`
Cleans up unused Docker resources.

```bash
./scripts/maintenance/cleanup.sh
```

**What it does:**
- Removes stopped containers
- Removes unused networks
- Removes dangling images
- Removes build cache
- Optionally performs aggressive cleanup

**Cleanup levels:**
1. **Normal**: Removes unused resources (safe)
2. **Aggressive**: Removes ALL unused images (requires rebuild)

✅ **Safe:** Does not remove volumes (DB data is preserved)

### `check-updates.sh`
Checks for available updates.

```bash
./scripts/maintenance/check-updates.sh
```

**What it does:**
- Checks npm vulnerabilities in backend
- Checks npm vulnerabilities in frontend
- Lists outdated dependencies
- Checks for Docker image updates
- Provides recommendations

## 📋 Recommended Usage

### Daily Development

```bash
# Start day
./scripts/dev/start-dev.sh

# View logs while working
./scripts/dev/logs.sh backend

# End of day
./scripts/dev/stop-dev.sh
```

### Weekly Maintenance

```bash
# Check updates
./scripts/maintenance/check-updates.sh

# Clean resources
./scripts/maintenance/cleanup.sh
```

## 🔒 Permissions

All scripts are configured as executable:

```bash
chmod +x scripts/dev/*.sh
chmod +x scripts/maintenance/*.sh
```

If you clone the repository, permissions should already be configured.

## 🆘 Troubleshooting

### Script doesn't execute

```bash
# Verify it has execution permissions
ls -la scripts/dev/start-dev.sh

# If it doesn't have permissions:
chmod +x scripts/dev/start-dev.sh
```

### Docker isn't running

```bash
# macOS
# Open Docker Desktop

# Linux
sudo systemctl start docker
```

### Missing environment variables

```bash
# Create .env from template
cp .env.example .env

# Edit with your values
nano .env
```

## 📚 Related Documentation

- [README-DOCKER.md](../README-DOCKER.md) - Complete Docker guide
- [DEPLOYMENT.md](../DEPLOYMENT.md) - Production deployment
- [SECURITY-DOCKER.md](../SECURITY-DOCKER.md) - Security
- [TROUBLESHOOTING-DOCKER.md](../TROUBLESHOOTING-DOCKER.md) - Troubleshooting

---

**Need help?** Check the [main documentation](../README.md) or open an issue.

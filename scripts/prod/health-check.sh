#!/bin/bash
# health-check.sh - Verifica la salud de todos los servicios

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🏥 AI Team - Health Check"
echo "========================="
echo ""

# Función para verificar servicio
check_service() {
    local name=$1
    local check_command=$2

    if eval "$check_command" > /dev/null 2>&1; then
        echo -e "   ${GREEN}✅ $name${NC}"
        return 0
    else
        echo -e "   ${RED}❌ $name${NC}"
        return 1
    fi
}

# Verificar Docker
echo "🐳 Docker:"
check_service "Docker daemon" "docker info"

# Verificar contenedores
echo ""
echo "📦 Contenedores:"
check_service "PostgreSQL (running)" "docker compose ps postgres | grep -q 'Up'"
check_service "Backend (running)" "docker compose ps backend | grep -q 'Up'"
check_service "Frontend (running)" "docker compose ps frontend | grep -q 'Up'"

# Health checks
echo ""
echo "🔍 Health Checks:"
check_service "PostgreSQL (healthy)" "docker compose exec postgres pg_isready -U ${DB_USER:-aiuser}"
check_service "Backend API" "curl -sf http://localhost:${BACKEND_PORT:-3000}/api/health"
check_service "Frontend" "curl -sf http://localhost:${FRONTEND_PORT:-80}"

# Verificar conectividad interna
echo ""
echo "🌐 Conectividad interna:"
check_service "Backend → PostgreSQL" "docker compose exec backend nc -zv postgres 5432"

# Recursos
echo ""
echo "💻 Recursos:"
echo ""
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"

# Espacio en disco
echo ""
echo "💾 Espacio en disco:"
docker system df

# Volúmenes
echo ""
echo "📦 Volúmenes:"
docker volume ls | grep ai-team

# Logs recientes (errores)
echo ""
echo "📋 Errores recientes (últimos 10):"
echo ""
echo "Backend:"
docker compose logs --tail=100 backend 2>/dev/null | grep -i error | tail -5 || echo "   Sin errores"
echo ""
echo "Frontend:"
docker compose logs --tail=100 frontend 2>/dev/null | grep -i error | tail -5 || echo "   Sin errores"
echo ""
echo "PostgreSQL:"
docker compose logs --tail=100 postgres 2>/dev/null | grep -i error | tail -5 || echo "   Sin errores"

echo ""
echo "✅ Health check completado"

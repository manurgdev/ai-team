#!/bin/bash
# check-updates.sh - Verifica actualizaciones de dependencias

set -e

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "🔍 AI Team - Verificación de Actualizaciones"
echo "============================================="
echo ""

# Función para verificar actualizaciones npm
check_npm_updates() {
    local dir=$1
    local name=$2

    if [ ! -d "$dir" ]; then
        echo -e "${RED}❌ Directorio no encontrado: $dir${NC}"
        return 1
    fi

    echo "📦 $name:"
    echo ""

    cd "$dir"

    # Verificar vulnerabilidades
    echo "   🔐 Verificando vulnerabilidades..."
    npm audit --production 2>/dev/null || npm audit 2>/dev/null | head -20

    echo ""
    echo "   📊 Dependencias desactualizadas:"
    npm outdated || echo -e "      ${GREEN}✅ Todas las dependencias están actualizadas${NC}"

    echo ""
    cd - > /dev/null
}

# Verificar Backend
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_npm_updates "./backend" "Backend (Node.js)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verificar Frontend
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_npm_updates "./frontend" "Frontend (React)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verificar imágenes Docker
echo "🐳 Verificando imágenes Docker base:"
echo ""

IMAGES=(
    "node:20-alpine"
    "postgres:15-alpine"
    "nginx:alpine"
)

for IMAGE in "${IMAGES[@]}"; do
    echo "   Verificando $IMAGE..."

    # Obtener digest local
    LOCAL_DIGEST=$(docker images --digests --format "{{.Repository}}:{{.Tag}} {{.Digest}}" | grep "^$IMAGE " | awk '{print $2}')

    # Pull silent para verificar
    REMOTE_DIGEST=$(docker pull "$IMAGE" 2>&1 | grep "Digest:" | awk '{print $2}')

    if [ "$LOCAL_DIGEST" = "$REMOTE_DIGEST" ]; then
        echo -e "      ${GREEN}✅ Actualizada${NC}"
    else
        echo -e "      ${YELLOW}⚠️  Actualización disponible${NC}"
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Recomendaciones
echo "📋 Recomendaciones:"
echo ""

if [ -f "./backend/package.json" ]; then
    BACKEND_VULNS=$(cd backend && npm audit --json 2>/dev/null | grep -o '"total":[0-9]*' | head -1 | cut -d: -f2)
    if [ "$BACKEND_VULNS" -gt 0 ]; then
        echo -e "   ${RED}⚠️  Backend tiene $BACKEND_VULNS vulnerabilidades${NC}"
        echo "      Ejecuta: cd backend && npm audit fix"
    fi
fi

if [ -f "./frontend/package.json" ]; then
    FRONTEND_VULNS=$(cd frontend && npm audit --json 2>/dev/null | grep -o '"total":[0-9]*' | head -1 | cut -d: -f2)
    if [ "$FRONTEND_VULNS" -gt 0 ]; then
        echo -e "   ${RED}⚠️  Frontend tiene $FRONTEND_VULNS vulnerabilidades${NC}"
        echo "      Ejecuta: cd frontend && npm audit fix"
    fi
fi

echo ""
echo "💡 Para actualizar imágenes Docker:"
echo "   ./scripts/maintenance/update-images.sh"
echo ""
echo "💡 Para actualizar dependencias npm:"
echo "   cd backend && npm update"
echo "   cd frontend && npm update"
echo ""
echo -e "${YELLOW}⚠️  Siempre prueba las actualizaciones en desarrollo primero${NC}"

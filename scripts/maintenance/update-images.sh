#!/bin/bash
# update-images.sh - Actualiza imágenes base de Docker

set -e

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔄 AI Team - Actualización de Imágenes Docker"
echo "=============================================="
echo ""

# Imágenes base a actualizar
IMAGES=(
    "node:20-alpine"
    "postgres:15-alpine"
    "nginx:alpine"
)

echo "📥 Descargando últimas versiones de imágenes base..."
echo ""

for IMAGE in "${IMAGES[@]}"; do
    echo "Pulling $IMAGE..."
    docker pull "$IMAGE"
    echo ""
done

echo -e "${GREEN}✅ Imágenes base actualizadas${NC}"
echo ""

# Reconstruir imágenes de la aplicación
echo "🔨 Reconstruyendo imágenes de la aplicación..."
docker compose build --no-cache --pull

echo ""
echo -e "${GREEN}✅ Imágenes actualizadas y reconstruidas${NC}"
echo ""
echo -e "${YELLOW}⚠️  Importante: Reinicia los servicios para aplicar cambios${NC}"
echo "   docker compose down && docker compose up -d"
echo ""

# Limpiar imágenes antiguas
echo "🧹 ¿Deseas limpiar imágenes antiguas?"
read -p "Esto eliminará imágenes no utilizadas (yes/no): " confirm

if [ "$confirm" = "yes" ]; then
    docker image prune -a -f
    echo -e "${GREEN}✅ Limpieza completada${NC}"
fi

echo ""
echo "📊 Espacio liberado:"
docker system df

#!/bin/bash
# cleanup.sh - Limpia recursos Docker no utilizados

set -e

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "🧹 AI Team - Limpieza de Docker"
echo "================================"
echo ""

# Mostrar uso actual
echo "📊 Uso actual de Docker:"
docker system df
echo ""

# Advertencia
echo -e "${YELLOW}⚠️  Este script eliminará:${NC}"
echo "   - Contenedores detenidos"
echo "   - Redes no utilizadas"
echo "   - Imágenes dangling (sin tag)"
echo "   - Cache de build"
echo ""
echo -e "${RED}   NO eliminará volúmenes (datos de la BD se mantienen)${NC}"
echo ""

read -p "¿Continuar? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Operación cancelada"
    exit 0
fi

echo ""
echo "🧹 Limpiando contenedores detenidos..."
docker container prune -f

echo ""
echo "🧹 Limpiando redes no utilizadas..."
docker network prune -f

echo ""
echo "🧹 Limpiando imágenes dangling..."
docker image prune -f

echo ""
echo "🧹 Limpiando cache de build..."
docker builder prune -f

echo ""
echo -e "${GREEN}✅ Limpieza completada${NC}"
echo ""
echo "📊 Uso después de limpieza:"
docker system df
echo ""

# Opción para limpieza agresiva
echo "🗑️  ¿Deseas hacer una limpieza AGRESIVA?"
echo -e "${RED}   Esto eliminará TODAS las imágenes no utilizadas${NC}"
echo "   (Requerirá reconstruir todas las imágenes)"
echo ""
read -p "¿Continuar con limpieza agresiva? (yes/no): " aggressive

if [ "$aggressive" = "yes" ]; then
    echo ""
    echo "🗑️  Limpieza agresiva en progreso..."
    docker system prune -a -f
    echo ""
    echo -e "${GREEN}✅ Limpieza agresiva completada${NC}"
    echo ""
    echo "📊 Uso final:"
    docker system df
fi

echo ""
echo -e "${YELLOW}💡 Tip: Para limpiar también volúmenes (⚠️ borra datos):${NC}"
echo "   docker system prune -a --volumes"

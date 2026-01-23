#!/bin/bash
# stop-dev.sh - Detiene el ambiente de desarrollo

set -e

echo "🛑 Deteniendo AI Team..."

# Detener servicios
docker compose down

echo ""
echo "✅ Servicios detenidos"
echo ""
echo "💡 Notas:"
echo "   - Los datos de la base de datos se mantienen en el volumen"
echo "   - Para eliminar también los volúmenes: docker compose down -v"
echo "   - Para iniciar de nuevo: ./scripts/dev/start-dev.sh"

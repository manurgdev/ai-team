#!/bin/bash
# check-db.sh - Verifica el estado de la base de datos y las migraciones

set -e

echo "🔍 Verificando estado de la base de datos..."
echo ""

# Verificar que Docker está corriendo
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker no está ejecutándose"
    exit 1
fi

# Verificar que los contenedores están corriendo
if ! docker compose ps | grep -q "ai-team-postgres.*Up"; then
    echo "❌ PostgreSQL no está ejecutándose"
    echo "   Ejecuta: docker compose up -d"
    exit 1
fi

echo "✅ PostgreSQL está ejecutándose"
echo ""

# Obtener credenciales del .env
if [ -f .env ]; then
    DB_USER=$(grep "^DB_USER=" .env | cut -d'=' -f2)
    DB_NAME=$(grep "^DB_NAME=" .env | cut -d'=' -f2)
else
    DB_USER="aiuser"
    DB_NAME="ai_team"
fi

echo "📊 Tablas en la base de datos:"
docker compose exec postgres psql -U "$DB_USER" -d "$DB_NAME" -c "\dt" 2>&1 || {
    echo ""
    echo "❌ No se pudo conectar a la base de datos"
    echo "   Usuario: $DB_USER"
    echo "   Base de datos: $DB_NAME"
    echo ""
    echo "💡 Solución:"
    echo "   1. Verifica que el archivo .env tenga las credenciales correctas"
    echo "   2. Ejecuta: docker compose down -v && docker compose up -d"
    exit 1
}

echo ""
echo "📋 Estado de migraciones:"
docker compose exec backend npx prisma migrate status --schema=./src/prisma/schema.prisma 2>&1 || {
    echo ""
    echo "❌ Error al verificar migraciones"
    echo ""
    echo "💡 Soluciones:"
    echo "   1. Ejecutar migraciones manualmente:"
    echo "      docker compose exec backend npx prisma migrate deploy --schema=./src/prisma/schema.prisma"
    echo ""
    echo "   2. Reiniciar contenedores:"
    echo "      docker compose restart backend"
    echo ""
    echo "   3. Reset completo (CUIDADO: borra todos los datos):"
    echo "      docker compose down -v && docker compose up -d"
    exit 1
}

echo ""
echo "✅ Base de datos verificada correctamente"

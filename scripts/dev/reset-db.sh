#!/bin/bash
# reset-db.sh - Reinicia la base de datos (ELIMINA TODOS LOS DATOS)

set -e

echo "⚠️  ADVERTENCIA: Esto eliminará TODOS los datos de la base de datos"
echo ""
read -p "¿Estás seguro de que deseas continuar? (escribe 'yes' para confirmar): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Operación cancelada"
    exit 0
fi

echo ""
echo "🗑️  Deteniendo servicios..."
docker compose down

echo "🗑️  Eliminando volumen de PostgreSQL..."
docker volume rm ai-team_postgres_data 2>/dev/null || docker volume rm ai-team_postgres_data_dev 2>/dev/null || true

echo "🚀 Reiniciando servicios..."
docker compose up -d

echo ""
echo "⏳ Esperando a que PostgreSQL esté listo..."
sleep 10

MAX_TRIES=30
TRIES=0
while [ $TRIES -lt $MAX_TRIES ]; do
    if docker compose exec postgres pg_isready -U aiuser > /dev/null 2>&1; then
        echo "   ✅ PostgreSQL listo"
        break
    fi
    TRIES=$((TRIES + 1))
    sleep 1
done

echo ""
echo "✅ Base de datos reiniciada"
echo "   Las migraciones se ejecutaron automáticamente"
echo ""
echo "💡 Ahora puedes crear un nuevo usuario en la aplicación"

#!/bin/bash
# deploy.sh - Script de deployment para producción

set -e

echo "🚀 AI Team - Deployment Script"
echo "=============================="
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: docker-compose.yml no encontrado"
    echo "   Ejecuta este script desde el directorio raíz del proyecto"
    exit 1
fi

# Verificar Docker
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker no está ejecutándose"
    exit 1
fi

# Verificar archivo .env.production
if [ ! -f ".env.production" ]; then
    echo "❌ Error: .env.production no encontrado"
    echo "   Crea este archivo con las variables de producción"
    exit 1
fi

# Cargar variables de entorno de producción
set -a
source .env.production
set +a

# Verificar secretos críticos
echo "🔍 Verificando configuración..."
if [ "$JWT_SECRET" = "your-super-secret-jwt-key-change-this-in-production" ]; then
    echo "❌ Error: JWT_SECRET no ha sido cambiado"
    echo "   Genera un secreto seguro: openssl rand -base64 48"
    exit 1
fi

if [ "$ENCRYPTION_SECRET" = "your-super-secret-encryption-key-change-this-in-production-must-be-32-chars" ]; then
    echo "❌ Error: ENCRYPTION_SECRET no ha sido cambiado"
    echo "   Genera un secreto de 32 caracteres: openssl rand -base64 32 | cut -c1-32"
    exit 1
fi

if [ "$DB_PASSWORD" = "aipassword" ]; then
    echo "❌ Error: DB_PASSWORD no ha sido cambiado"
    echo "   Genera una contraseña segura: openssl rand -base64 24"
    exit 1
fi

if [ "$NODE_ENV" != "production" ]; then
    echo "⚠️  Advertencia: NODE_ENV no es 'production'"
    read -p "¿Continuar de todos modos? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        exit 1
    fi
fi

echo "✅ Configuración válida"
echo ""

# Hacer backup antes de deploy
echo "💾 Creando backup de base de datos..."
if docker compose ps postgres | grep -q "Up"; then
    ./scripts/prod/backup-db.sh || echo "⚠️  No se pudo crear backup (¿primera vez?)"
fi

# Pull de cambios si es deploy desde Git
if [ -d ".git" ]; then
    echo "📥 Actualizando código desde Git..."
    git pull origin $(git branch --show-current)
fi

# Construir imágenes
echo "🔨 Construyendo imágenes..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# Detener servicios antiguos (mantener BD)
echo "🛑 Deteniendo servicios antiguos..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml stop backend frontend

# Iniciar nuevos servicios
echo "🚀 Iniciando servicios..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Esperar a que servicios estén listos
echo "⏳ Esperando a que servicios estén listos..."
sleep 10

# Health check
echo "🏥 Verificando salud de servicios..."
MAX_TRIES=60
TRIES=0

# Verificar PostgreSQL
while [ $TRIES -lt $MAX_TRIES ]; do
    if docker compose exec postgres pg_isready -U ${DB_USER:-aiuser} > /dev/null 2>&1; then
        echo "   ✅ PostgreSQL: OK"
        break
    fi
    TRIES=$((TRIES + 1))
    if [ $TRIES -eq $MAX_TRIES ]; then
        echo "   ❌ PostgreSQL: Timeout"
        exit 1
    fi
    sleep 1
done

# Verificar Backend
TRIES=0
while [ $TRIES -lt $MAX_TRIES ]; do
    if curl -sf http://localhost:${BACKEND_PORT:-3000}/api/health > /dev/null 2>&1; then
        echo "   ✅ Backend: OK"
        break
    fi
    TRIES=$((TRIES + 1))
    if [ $TRIES -eq $MAX_TRIES ]; then
        echo "   ❌ Backend: Timeout"
        docker compose logs backend
        exit 1
    fi
    sleep 2
done

# Verificar Frontend
if curl -sf http://localhost:${FRONTEND_PORT:-80} > /dev/null 2>&1; then
    echo "   ✅ Frontend: OK"
else
    echo "   ⚠️  Frontend: No responde (puede estar detrás de proxy)"
fi

# Limpiar imágenes antiguas
echo "🧹 Limpiando imágenes antiguas..."
docker image prune -f

echo ""
echo "✅ ¡Deployment completado exitosamente!"
echo ""
echo "📊 Estado de servicios:"
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

echo ""
echo "📝 Próximos pasos:"
echo "   1. Verificar logs: docker compose logs -f"
echo "   2. Monitorear métricas: docker stats"
echo "   3. Verificar aplicación en el navegador"
echo ""
echo "🆘 Si hay problemas:"
echo "   - Ver logs: docker compose logs -f backend"
echo "   - Rollback: git checkout <commit-anterior> && ./scripts/prod/deploy.sh"
echo "   - Restaurar DB: ./scripts/prod/restore-db.sh <backup-file>"

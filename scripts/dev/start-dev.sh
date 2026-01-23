#!/bin/bash
# start-dev.sh - Inicia el ambiente de desarrollo con Docker

set -e

echo "🚀 Iniciando AI Team en modo desarrollo..."
echo ""

# Verificar que Docker está corriendo
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker no está ejecutándose"
    echo "   Por favor inicia Docker Desktop o el servicio de Docker"
    exit 1
fi

# Verificar que existe .env
if [ ! -f .env ]; then
    echo "⚠️  Archivo .env no encontrado"
    echo "   Copiando desde .env.example..."
    cp .env.example .env
    echo "   ✅ Archivo .env creado"
    echo "   ⚠️  IMPORTANTE: Edita .env y configura tus secretos antes de continuar"
    echo ""
    read -p "Presiona Enter para continuar o Ctrl+C para cancelar..."
fi

# Iniciar servicios
echo "📦 Construyendo e iniciando contenedores..."
docker compose up -d

# Esperar a que servicios estén listos
echo ""
echo "⏳ Esperando a que servicios estén listos..."
sleep 5

# Verificar estado
echo ""
echo "📊 Estado de servicios:"
docker compose ps

# Health check
echo ""
echo "🏥 Verificando salud de servicios..."

# Esperar PostgreSQL
MAX_TRIES=30
TRIES=0
while [ $TRIES -lt $MAX_TRIES ]; do
    if docker compose exec postgres pg_isready -U aiuser > /dev/null 2>&1; then
        echo "   ✅ PostgreSQL: OK"
        break
    fi
    TRIES=$((TRIES + 1))
    if [ $TRIES -eq $MAX_TRIES ]; then
        echo "   ❌ PostgreSQL: Timeout"
        echo "   Ver logs: docker compose logs postgres"
        exit 1
    fi
    sleep 1
done

# Esperar Backend (las migraciones pueden tomar tiempo)
echo "   ⏳ Esperando a que backend complete migraciones..."
sleep 10
MAX_TRIES=30
TRIES=0
while [ $TRIES -lt $MAX_TRIES ]; do
    if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
        echo "   ✅ Backend: OK"
        break
    fi
    TRIES=$((TRIES + 1))
    if [ $TRIES -eq $MAX_TRIES ]; then
        echo "   ⚠️  Backend: No responde"
        echo "   Ver logs: docker compose logs backend"
    fi
    sleep 2
done

# Verificar Frontend
if curl -sf http://localhost > /dev/null 2>&1; then
    echo "   ✅ Frontend: OK"
else
    echo "   ⚠️  Frontend: No responde todavía"
fi

echo ""
echo "✨ ¡Ambiente de desarrollo listo!"
echo ""
echo "📍 Acceso a servicios:"
echo "   Frontend:  http://localhost:5173"
echo "   Backend:   http://localhost:3000"
echo "   API Health: http://localhost:3000/health"
echo ""
echo "📝 Comandos útiles:"
echo "   Ver logs:      docker compose logs -f"
echo "   Detener:       docker compose down"
echo "   Reiniciar:     docker compose restart"
echo "   Estado:        docker compose ps"
echo ""
echo "💡 Tip: Usa 'docker compose logs -f backend' para ver logs en tiempo real"

#!/bin/bash
# restore-db.sh - Restaura base de datos desde backup

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "♻️  AI Team - Restauración de Base de Datos"
echo "==========================================="
echo ""

# Verificar argumento
if [ -z "$1" ]; then
    echo -e "${RED}❌ Error: Debes especificar el archivo de backup${NC}"
    echo ""
    echo "Uso: $0 <archivo_backup.sql.gz>"
    echo ""
    echo "Backups disponibles:"
    ls -lht ./backups/backup_*.sql.gz 2>/dev/null | head -10 | awk '{print "   " $9 " (" $5 ", " $6 " " $7 ")"}'
    exit 1
fi

BACKUP_FILE="$1"
DB_CONTAINER="ai-team-postgres"
DB_NAME="${DB_NAME:-ai_team}"
DB_USER="${DB_USER:-aiuser}"

# Verificar que archivo existe
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Error: Archivo no encontrado: $BACKUP_FILE${NC}"
    exit 1
fi

# Verificar que PostgreSQL está corriendo
if ! docker compose ps postgres | grep -q "Up"; then
    echo -e "${RED}❌ Error: PostgreSQL no está ejecutándose${NC}"
    echo "   Inicia los servicios: docker compose up -d postgres"
    exit 1
fi

# Mostrar información
echo "📋 Información de restauración:"
echo "   Base de datos: $DB_NAME"
echo "   Backup: $BACKUP_FILE"
SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "   Tamaño: $SIZE"
echo ""

# Verificar integridad del backup
echo "🔍 Verificando integridad del backup..."
if gunzip -t "$BACKUP_FILE" 2>/dev/null; then
    echo -e "${GREEN}✅ Backup válido${NC}"
else
    echo -e "${RED}❌ Error: Backup corrupto o inválido${NC}"
    exit 1
fi

# Confirmación
echo ""
echo -e "${RED}⚠️  ADVERTENCIA: Esto sobrescribirá la base de datos actual${NC}"
echo -e "${RED}   Todos los datos actuales se perderán${NC}"
echo ""
read -p "¿Deseas continuar? Escribe 'yes' para confirmar: " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Operación cancelada"
    exit 0
fi

# Crear backup de seguridad antes de restaurar
echo ""
echo "💾 Creando backup de seguridad de la BD actual..."
SAFETY_BACKUP="./backups/pre-restore_$(date +%Y%m%d_%H%M%S).sql.gz"
mkdir -p ./backups
docker compose exec -T "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$SAFETY_BACKUP" || true
echo "   Guardado en: $SAFETY_BACKUP"

# Detener backend temporalmente
echo ""
echo "🛑 Deteniendo backend..."
docker compose stop backend

# Restaurar base de datos
echo ""
echo "♻️  Restaurando base de datos..."
echo "   (Esto puede tomar varios minutos dependiendo del tamaño)"

if gunzip -c "$BACKUP_FILE" | docker compose exec -T "$DB_CONTAINER" psql -U "$DB_USER" "$DB_NAME" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Base de datos restaurada exitosamente${NC}"
else
    echo -e "${RED}❌ Error al restaurar base de datos${NC}"
    echo ""
    echo "Intenta restaurar el backup de seguridad:"
    echo "   gunzip -c $SAFETY_BACKUP | docker compose exec -T postgres psql -U $DB_USER $DB_NAME"
    exit 1
fi

# Verificar restauración
echo ""
echo "🔍 Verificando restauración..."
TABLE_COUNT=$(docker compose exec -T "$DB_CONTAINER" psql -U "$DB_USER" "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' \n')

if [ "$TABLE_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Tablas encontradas: $TABLE_COUNT${NC}"
else
    echo -e "${RED}❌ No se encontraron tablas${NC}"
    exit 1
fi

# Reiniciar backend
echo ""
echo "🚀 Reiniciando backend..."
docker compose start backend

# Esperar a que backend esté listo
echo "⏳ Esperando a que backend esté listo..."
sleep 5

MAX_TRIES=30
TRIES=0
while [ $TRIES -lt $MAX_TRIES ]; do
    if curl -sf http://localhost:${BACKEND_PORT:-3000}/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend listo${NC}"
        break
    fi
    TRIES=$((TRIES + 1))
    if [ $TRIES -eq $MAX_TRIES ]; then
        echo -e "${YELLOW}⚠️  Backend no responde, verifica logs${NC}"
    fi
    sleep 2
done

echo ""
echo -e "${GREEN}✨ Restauración completada exitosamente${NC}"
echo ""
echo "📝 Próximos pasos:"
echo "   1. Verifica que la aplicación funciona correctamente"
echo "   2. Prueba login y funcionalidades principales"
echo "   3. Si todo está bien, puedes eliminar el backup de seguridad:"
echo "      rm $SAFETY_BACKUP"

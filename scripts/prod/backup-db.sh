#!/bin/bash
# backup-db.sh - Crea backup de la base de datos PostgreSQL

set -e

# Configuración
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=${RETENTION_DAYS:-30}
DB_CONTAINER="ai-team-postgres"
DB_NAME="${DB_NAME:-ai_team}"
DB_USER="${DB_USER:-aiuser}"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "💾 AI Team - Backup de Base de Datos"
echo "====================================="
echo ""

# Verificar que PostgreSQL está corriendo
if ! docker compose ps postgres | grep -q "Up"; then
    echo -e "${RED}❌ Error: PostgreSQL no está ejecutándose${NC}"
    exit 1
fi

# Crear directorio de backups
mkdir -p "$BACKUP_DIR"

# Nombre del archivo de backup
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.sql.gz"

# Crear backup
echo "📦 Creando backup de $DB_NAME..."
echo "   Archivo: $BACKUP_FILE"

if docker compose exec -T "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"; then
    echo -e "${GREEN}✅ Backup creado exitosamente${NC}"

    # Verificar tamaño
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "   Tamaño: $SIZE"

    # Verificar integridad
    if gunzip -t "$BACKUP_FILE" 2>/dev/null; then
        echo -e "${GREEN}✅ Integridad verificada${NC}"
    else
        echo -e "${RED}❌ Error: Backup corrupto${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Error: Falló la creación del backup${NC}"
    exit 1
fi

# Eliminar backups antiguos
if [ "$RETENTION_DAYS" -gt 0 ]; then
    echo ""
    echo "🧹 Eliminando backups mayores a $RETENTION_DAYS días..."
    DELETED=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
    if [ "$DELETED" -gt 0 ]; then
        echo "   Eliminados: $DELETED archivos"
    else
        echo "   No hay backups antiguos para eliminar"
    fi
fi

# Contar backups restantes
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | wc -l)
echo ""
echo "📊 Total de backups: $BACKUP_COUNT"
echo ""

# Listar últimos 5 backups
echo "📋 Últimos backups:"
ls -lht "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | head -5 | awk '{print "   " $9 " (" $5 ")"}'

# Opcional: Subir a cloud storage
if [ -n "$S3_BUCKET" ]; then
    echo ""
    echo "☁️  Subiendo a S3..."
    if command -v aws &> /dev/null; then
        aws s3 cp "$BACKUP_FILE" "s3://$S3_BUCKET/backups/"
        echo -e "${GREEN}✅ Subido a S3${NC}"
    else
        echo -e "${YELLOW}⚠️  AWS CLI no instalado, saltando S3${NC}"
    fi
fi

if [ -n "$GCS_BUCKET" ]; then
    echo ""
    echo "☁️  Subiendo a Google Cloud Storage..."
    if command -v gsutil &> /dev/null; then
        gsutil cp "$BACKUP_FILE" "gs://$GCS_BUCKET/backups/"
        echo -e "${GREEN}✅ Subido a GCS${NC}"
    else
        echo -e "${YELLOW}⚠️  gsutil no instalado, saltando GCS${NC}"
    fi
fi

echo ""
echo -e "${GREEN}✨ Proceso de backup completado${NC}"

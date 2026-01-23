# Scripts de AI Team

Este directorio contiene scripts útiles para gestionar la aplicación AI Team con Docker.

## 📁 Estructura

```
scripts/
├── dev/              # Scripts de desarrollo
├── prod/             # Scripts de producción
└── maintenance/      # Scripts de mantenimiento
```

## 🔧 Scripts de Desarrollo (`dev/`)

### `start-dev.sh`
Inicia el ambiente de desarrollo completo.

```bash
./scripts/dev/start-dev.sh
```

**Qué hace:**
- Verifica que Docker está ejecutándose
- Crea archivo .env si no existe
- Inicia todos los servicios con Docker Compose
- Espera a que servicios estén listos
- Ejecuta health checks
- Muestra URLs de acceso

### `stop-dev.sh`
Detiene el ambiente de desarrollo.

```bash
./scripts/dev/stop-dev.sh
```

**Qué hace:**
- Detiene todos los contenedores
- Mantiene los volúmenes (datos de BD)

### `reset-db.sh`
Reinicia la base de datos (**ELIMINA TODOS LOS DATOS**).

```bash
./scripts/dev/reset-db.sh
```

**Qué hace:**
- Solicita confirmación
- Detiene servicios
- Elimina volumen de PostgreSQL
- Reinicia servicios
- Ejecuta migraciones

⚠️ **Advertencia:** Esto elimina todos los datos. Úsalo solo en desarrollo.

### `logs.sh`
Muestra logs de servicios.

```bash
# Ver logs de todos los servicios
./scripts/dev/logs.sh

# Ver logs de un servicio específico
./scripts/dev/logs.sh backend
./scripts/dev/logs.sh frontend
./scripts/dev/logs.sh postgres
```

## 🚀 Scripts de Producción (`prod/`)

### `deploy.sh`
Script completo de deployment para producción.

```bash
./scripts/prod/deploy.sh
```

**Qué hace:**
- Verifica configuración de seguridad
- Crea backup de BD antes de deploy
- Pull de cambios desde Git (si aplica)
- Construye imágenes Docker
- Detiene servicios antiguos
- Inicia nuevos servicios
- Ejecuta health checks
- Limpia imágenes antiguas

**Requiere:**
- Archivo `.env.production` con variables de producción
- Secretos seguros configurados

### `backup-db.sh`
Crea backup comprimido de PostgreSQL.

```bash
./scripts/prod/backup-db.sh
```

**Qué hace:**
- Crea backup en formato SQL comprimido (gzip)
- Verifica integridad del backup
- Elimina backups antiguos (configurable)
- Opcionalmente sube a S3/GCS

**Configuración:**
```bash
# Variables de entorno opcionales
BACKUP_DIR=./backups           # Directorio de backups
RETENTION_DAYS=30              # Días de retención
S3_BUCKET=mi-bucket           # Bucket S3 (opcional)
GCS_BUCKET=mi-bucket          # Bucket GCS (opcional)
```

**Automatización:**
```bash
# Agregar a crontab para backups automáticos
crontab -e

# Backup diario a las 2 AM
0 2 * * * cd /path/to/ai-team && ./scripts/prod/backup-db.sh
```

### `restore-db.sh`
Restaura base de datos desde backup.

```bash
./scripts/prod/restore-db.sh ./backups/backup_20260123_020000.sql.gz
```

**Qué hace:**
- Verifica integridad del backup
- Solicita confirmación
- Crea backup de seguridad de BD actual
- Detiene backend
- Restaura base de datos
- Reinicia backend
- Verifica restauración

⚠️ **Advertencia:** Sobrescribe la base de datos actual.

### `health-check.sh`
Verifica la salud de todos los servicios.

```bash
./scripts/prod/health-check.sh
```

**Qué hace:**
- Verifica Docker daemon
- Verifica estado de contenedores
- Ejecuta health checks
- Verifica conectividad interna
- Muestra uso de recursos
- Muestra espacio en disco
- Muestra errores recientes en logs

## 🛠️ Scripts de Mantenimiento (`maintenance/`)

### `update-images.sh`
Actualiza imágenes base de Docker.

```bash
./scripts/maintenance/update-images.sh
```

**Qué hace:**
- Descarga últimas versiones de:
  - `node:20-alpine`
  - `postgres:15-alpine`
  - `nginx:alpine`
- Reconstruye imágenes de la aplicación
- Opcionalmente limpia imágenes antiguas

⚠️ **Nota:** Requiere reiniciar servicios para aplicar cambios.

### `cleanup.sh`
Limpia recursos Docker no utilizados.

```bash
./scripts/maintenance/cleanup.sh
```

**Qué hace:**
- Elimina contenedores detenidos
- Elimina redes no utilizadas
- Elimina imágenes dangling
- Elimina cache de build
- Opcionalmente hace limpieza agresiva

**Niveles de limpieza:**
1. **Normal**: Elimina recursos no usados (seguro)
2. **Agresiva**: Elimina TODAS las imágenes no usadas (requiere rebuild)

✅ **Seguro:** No elimina volúmenes (datos de BD se mantienen)

### `check-updates.sh`
Verifica actualizaciones disponibles.

```bash
./scripts/maintenance/check-updates.sh
```

**Qué hace:**
- Verifica vulnerabilidades npm en backend
- Verifica vulnerabilidades npm en frontend
- Lista dependencias desactualizadas
- Verifica actualizaciones de imágenes Docker
- Proporciona recomendaciones

## 📋 Uso Recomendado

### Desarrollo Diario

```bash
# Iniciar día
./scripts/dev/start-dev.sh

# Ver logs mientras trabajas
./scripts/dev/logs.sh backend

# Fin del día
./scripts/dev/stop-dev.sh
```

### Mantenimiento Semanal

```bash
# Verificar actualizaciones
./scripts/maintenance/check-updates.sh

# Limpiar recursos
./scripts/maintenance/cleanup.sh

# Verificar salud
./scripts/prod/health-check.sh
```

### Despliegue a Producción

```bash
# 1. Hacer backup
./scripts/prod/backup-db.sh

# 2. Deployment
./scripts/prod/deploy.sh

# 3. Verificar
./scripts/prod/health-check.sh
```

### Recuperación ante Desastres

```bash
# Si algo sale mal, restaurar backup
./scripts/prod/restore-db.sh ./backups/backup_YYYYMMDD_HHMMSS.sql.gz

# Verificar aplicación
./scripts/prod/health-check.sh
```

## 🔒 Permisos

Todos los scripts están configurados como ejecutables:

```bash
chmod +x scripts/dev/*.sh
chmod +x scripts/prod/*.sh
chmod +x scripts/maintenance/*.sh
```

Si clonas el repositorio, los permisos ya deberían estar configurados.

## 🆘 Solución de Problemas

### Script no ejecuta

```bash
# Verificar que tiene permisos de ejecución
ls -la scripts/dev/start-dev.sh

# Si no tiene permisos:
chmod +x scripts/dev/start-dev.sh
```

### Docker no está ejecutándose

```bash
# macOS
# Abre Docker Desktop

# Linux
sudo systemctl start docker
```

### Variables de entorno faltantes

```bash
# Crear .env desde template
cp .env.example .env

# Editar con tus valores
nano .env
```

## 📚 Documentación Relacionada

- [README-DOCKER.md](../README-DOCKER.md) - Guía completa de Docker
- [DEPLOYMENT.md](../DEPLOYMENT.md) - Despliegue en producción
- [SECURITY-DOCKER.md](../SECURITY-DOCKER.md) - Seguridad
- [TROUBLESHOOTING-DOCKER.md](../TROUBLESHOOTING-DOCKER.md) - Solución de problemas

---

**¿Necesitas ayuda?** Consulta la [documentación principal](../README.md) o abre un issue.

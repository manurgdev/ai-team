# 🔧 Troubleshooting Docker - AI Team

Guía completa para resolver problemas comunes con Docker y la aplicación AI Team.

## 📋 Tabla de Contenidos

1. [Problemas de Inicio](#problemas-de-inicio)
2. [Problemas de Red y Conectividad](#problemas-de-red-y-conectividad)
3. [Problemas de Base de Datos](#problemas-de-base-de-datos)
4. [Problemas de Construcción](#problemas-de-construcción)
5. [Problemas de Rendimiento](#problemas-de-rendimiento)
6. [Problemas de Volúmenes](#problemas-de-volúmenes)
7. [Problemas de Permisos](#problemas-de-permisos)
8. [Problemas Específicos de la Aplicación](#problemas-específicos-de-la-aplicación)
9. [Herramientas de Diagnóstico](#herramientas-de-diagnóstico)
10. [FAQ](#faq)

## 🚀 Problemas de Inicio

### Error: "Cannot connect to Docker daemon"

**Síntoma:**
```
Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?
```

**Causa:** Docker no está ejecutándose

**Solución:**
```bash
# Linux
sudo systemctl start docker
sudo systemctl enable docker

# macOS
# Abrir Docker Desktop

# Verificar
docker ps
```

### Error: "Service already running"

**Síntoma:**
```
ERROR: service "backend" is already running
```

**Causa:** Contenedores ya están ejecutándose

**Solución:**
```bash
# Ver contenedores activos
docker compose ps

# Detener todos
docker compose down

# Iniciar de nuevo
docker compose up -d
```

### Error: "Port is already allocated"

**Síntoma:**
```
Error starting userland proxy: listen tcp4 0.0.0.0:80: bind: address already in use
```

**Causa:** Puerto ya está en uso por otro proceso

**Solución:**
```bash
# Identificar qué usa el puerto
lsof -i :80
lsof -i :3000
lsof -i :5432

# Opción 1: Detener el proceso conflictivo
sudo kill -9 <PID>

# Opción 2: Cambiar puertos en .env
nano .env
# Cambia:
FRONTEND_PORT=8080
BACKEND_PORT=3001
DB_PORT=5433

# Reiniciar servicios
docker compose down
docker compose up -d
```

### Error: "Container exits immediately"

**Síntoma:** Contenedor se inicia y termina enseguida

**Diagnóstico:**
```bash
# Ver logs
docker compose logs backend
docker compose logs -f backend

# Ver código de salida
docker inspect ai-team-backend --format='{{.State.ExitCode}}'

# Códigos comunes:
# 0 - Salida normal (inusual para servicios)
# 1 - Error de aplicación
# 137 - Killed por OOM (sin memoria)
# 139 - Segmentation fault
# 143 - Terminado con SIGTERM
```

**Soluciones comunes:**
```bash
# 1. Variable de entorno faltante
docker compose config  # Verificar configuración

# 2. Problema con comando de inicio
docker compose exec backend sh
# Ejecutar comando manualmente para ver error

# 3. Falta alguna dependencia
docker compose build --no-cache backend
```

### Error: "Unhealthy" status

**Síntoma:**
```bash
docker compose ps
# Muestra: postgres (unhealthy)
```

**Solución:**
```bash
# Ver logs detallados
docker compose logs postgres

# Ver detalles del healthcheck
docker inspect ai-team-postgres --format='{{json .State.Health}}' | jq

# Esperar más tiempo (puede tomar 30-60 segundos)
watch -n 2 'docker compose ps'

# Si persiste, recrear contenedor
docker compose down
docker volume rm ai-team_postgres_data  # ⚠️ Borra datos
docker compose up -d
```

## 🌐 Problemas de Red y Conectividad

### Frontend no puede conectar con Backend

**Síntoma:** Errores CORS o "Failed to fetch" en navegador

**Diagnóstico:**
```bash
# 1. Verificar que backend está corriendo
curl http://localhost:3000/api/health

# 2. Verificar variables de entorno
docker compose exec frontend env | grep VITE_API_URL
docker compose exec backend env | grep ALLOWED_ORIGINS

# 3. Ver logs del backend
docker compose logs -f backend | grep CORS
```

**Soluciones:**

**Problema 1: VITE_API_URL incorrecto**
```bash
# Verificar .env
cat .env | grep VITE_API_URL

# Debe ser:
VITE_API_URL=http://localhost:3000/api  # Desarrollo local
# o
VITE_API_URL=https://tudominio.com/api  # Producción

# Reconstruir frontend si cambias esto
docker compose build frontend
docker compose up -d frontend
```

**Problema 2: CORS no permite origen**
```bash
# Verificar ALLOWED_ORIGINS en .env
cat .env | grep ALLOWED_ORIGINS

# Debe incluir el origen del frontend
ALLOWED_ORIGINS=http://localhost,http://localhost:5173

# Reiniciar backend
docker compose restart backend
```

**Problema 3: Red de Docker aislada**
```bash
# Verificar que servicios están en misma red
docker network inspect ai-team_ai-team-network

# Debería mostrar frontend, backend, postgres

# Si no, recrear:
docker compose down
docker compose up -d
```

### Backend no puede conectar con PostgreSQL

**Síntoma:**
```
Error: P1001: Can't reach database server at postgres:5432
```

**Diagnóstico:**
```bash
# 1. Verificar que postgres está healthy
docker compose ps

# 2. Ver logs de postgres
docker compose logs postgres

# 3. Verificar DATABASE_URL
docker compose exec backend sh -c 'echo $DATABASE_URL'

# 4. Probar conectividad
docker compose exec backend ping postgres
docker compose exec backend nc -zv postgres 5432
```

**Soluciones:**

**Problema 1: PostgreSQL no está listo**
```bash
# Esperar a que esté healthy (puede tomar 20-30s)
watch -n 2 'docker compose ps'

# Ver healthcheck
docker compose logs postgres | grep "database system is ready"
```

**Problema 2: DATABASE_URL incorrecto**
```bash
# Debe usar nombre del servicio "postgres", no "localhost"
# ❌ MAL:
DATABASE_URL=postgresql://aiuser:pass@localhost:5432/ai_team

# ✅ BIEN:
DATABASE_URL=postgresql://aiuser:pass@postgres:5432/ai_team

# O usar variables:
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
```

**Problema 3: Orden de inicio**
```bash
# Backend debe esperar a postgres
# Verificar depends_on en docker-compose.yml

# Reiniciar en orden correcto
docker compose down
docker compose up -d postgres
# Esperar 20 segundos
docker compose up -d backend frontend
```

### DNS no resuelve nombres de servicios

**Síntoma:** `ping: postgres: Name or service not known`

**Solución:**
```bash
# Verificar red
docker network ls
docker network inspect ai-team_ai-team-network

# Recrear red
docker compose down
docker network prune
docker compose up -d
```

## 🗄️ Problemas de Base de Datos

### Error: "relation does not exist"

**Síntoma:**
```
ERROR: relation "User" does not exist
```

**Causa:** Migraciones de Prisma no se han ejecutado

**Solución:**
```bash
# Verificar estado de migraciones
docker compose exec backend npx prisma migrate status --schema=./src/prisma/schema.prisma

# Ejecutar migraciones pendientes
docker compose exec backend npx prisma migrate deploy --schema=./src/prisma/schema.prisma

# Si persiste, reset completo (⚠️ borra datos)
docker compose down
docker volume rm ai-team_postgres_data
docker compose up -d
```

### Error: "password authentication failed"

**Síntoma:**
```
FATAL: password authentication failed for user "aiuser"
```

**Causa:** Contraseña en DATABASE_URL no coincide con DB_PASSWORD

**Solución:**
```bash
# Verificar variables
cat .env | grep DB_
cat .env | grep DATABASE_URL

# DB_PASSWORD y DATABASE_URL deben coincidir

# Si cambiaste password, recrear contenedor postgres
docker compose down
docker volume rm ai-team_postgres_data
docker compose up -d
```

### PostgreSQL se queda sin memoria

**Síntoma:**
```
FATAL: out of memory
```

**Solución:**
```bash
# Ver uso de memoria
docker stats ai-team-postgres

# Aumentar límite en docker-compose.prod.yml
services:
  postgres:
    deploy:
      resources:
        limits:
          memory: 2G  # Aumentar

# Aplicar cambios
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Locks en base de datos

**Síntoma:** Queries muy lentos, timeouts

**Diagnóstico:**
```sql
-- Conectar a DB
docker compose exec postgres psql -U aiuser ai_team

-- Ver locks activos
SELECT pid, usename, query, state
FROM pg_stat_activity
WHERE state != 'idle';

-- Ver locks bloqueantes
SELECT
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query AS blocked_statement,
  blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
  AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
  AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
  AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
  AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
  AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
  AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

**Solución:**
```sql
-- Terminar proceso bloqueante (cuidado!)
SELECT pg_terminate_backend(<blocking_pid>);

-- O reiniciar postgres
-- docker compose restart postgres
```

### Corrupción de datos

**Síntoma:** Errores extraños, datos inconsistentes

**Solución:**
```bash
# 1. Verificar integridad
docker compose exec postgres psql -U aiuser ai_team -c "REINDEX DATABASE ai_team;"

# 2. Restaurar desde backup
./scripts/prod/restore-db.sh /home/deploy/backups/backup_YYYYMMDD.sql.gz

# 3. Último recurso: reset completo
docker compose down -v
docker compose up -d
# Ejecutará migraciones desde cero
```

## 🔨 Problemas de Construcción

### Error: "COPY failed"

**Síntoma:**
```
COPY failed: file not found in build context
```

**Causa:** Archivo referenciado en Dockerfile no existe o está en .dockerignore

**Solución:**
```bash
# Verificar que archivos existen
ls -la backend/package.json
ls -la frontend/package.json

# Verificar .dockerignore
cat .dockerignore

# Reconstruir sin caché
docker compose build --no-cache
```

### Error: "npm install failed"

**Síntoma:**
```
npm ERR! code ENOTFOUND
npm ERR! errno ENOTFOUND
```

**Causa:** Sin conexión a internet o proxy mal configurado

**Solución:**
```bash
# Verificar conexión
ping registry.npmjs.org

# Si usas proxy corporativo
docker build --build-arg HTTP_PROXY=http://proxy:8080 \
             --build-arg HTTPS_PROXY=http://proxy:8080 \
             backend/

# Limpiar caché npm
docker compose build --no-cache --build-arg NPM_CONFIG_CACHE=/tmp/npm-cache
```

### "Layer does not exist" o "No space left on device"

**Síntoma:** Error al construir imágenes

**Solución:**
```bash
# Ver espacio usado
docker system df

# Limpiar imágenes no utilizadas
docker image prune -a

# Limpiar todo (⚠️ cuidado)
docker system prune -a --volumes

# Aumentar espacio de Docker Desktop (macOS/Windows)
# Settings → Resources → Disk image size
```

## ⚡ Problemas de Rendimiento

### Contenedores muy lentos

**Diagnóstico:**
```bash
# Ver uso de recursos
docker stats

# Ver procesos dentro del contenedor
docker compose exec backend top

# Ver I/O
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.BlockIO}}"
```

**Soluciones:**

**1. Aumentar recursos:**
```yaml
# docker-compose.prod.yml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
```

**2. Optimizar queries de BD:**
```bash
# Ver queries lentas
docker compose exec postgres psql -U aiuser ai_team -c "
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;"

# Analizar query específica
docker compose exec postgres psql -U aiuser ai_team -c "
EXPLAIN ANALYZE SELECT * FROM \"User\";"
```

**3. Caché de Docker:**
```bash
# En macOS, usa VirtioFS en lugar de gRPC FUSE
# Docker Desktop → Settings → Experimental Features → VirtioFS
```

### Build muy lento

**Solución:**
```bash
# Usar BuildKit (más rápido)
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Construir
docker compose build

# Usar caché de layers
docker compose build --build-arg BUILDKIT_INLINE_CACHE=1
```

### Alto uso de CPU/memoria

**Diagnóstico:**
```bash
# Ver top processes
docker compose exec backend ps aux --sort=-%cpu | head

# Ver uso de memoria
docker compose exec backend free -h
```

**Solución:**
```bash
# Limitar recursos
# Ver sección anterior sobre resource limits

# Reiniciar contenedor
docker compose restart backend

# Verificar memory leaks en aplicación
docker compose exec backend node --max-old-space-size=512 dist/server.js
```

## 💾 Problemas de Volúmenes

### Datos no persisten

**Síntoma:** Datos se pierden al reiniciar

**Causa:** Volumen no está configurado o se elimina

**Solución:**
```bash
# Verificar volúmenes
docker volume ls
docker volume inspect ai-team_postgres_data

# NO usar -v al detener (elimina volúmenes)
docker compose down       # ✅ Mantiene datos
docker compose down -v    # ❌ Elimina datos

# Recrear volumen solo si es necesario
docker volume create ai-team_postgres_data
```

### Volumen lleno

**Síntoma:**
```
ERROR: No space left on device
```

**Solución:**
```bash
# Ver tamaño de volumen
docker system df -v

# Limpiar datos antiguos en BD
docker compose exec postgres psql -U aiuser ai_team -c "VACUUM FULL;"

# Eliminar logs antiguos
docker compose exec backend find /app/logs -mtime +7 -delete

# Aumentar espacio de disco del host
```

### Permisos incorrectos en volumen

**Síntoma:** Permission denied al escribir

**Solución:**
```bash
# Ver permisos
docker compose exec backend ls -la /app

# Cambiar owner (como root)
docker compose exec -u root backend chown -R nodejs:nodejs /app

# O recrear volumen con permisos correctos
docker compose down
docker volume rm <volumen>
docker compose up -d
```

## 🔐 Problemas de Permisos

### "Permission denied" al ejecutar comandos

**Solución:**
```bash
# Ejecutar como root
docker compose exec -u root backend sh

# Agregar usuario a grupo docker (Linux)
sudo usermod -aG docker $USER
# Logout y login para aplicar

# Cambiar permisos de socket (Linux)
sudo chmod 666 /var/run/docker.sock
```

### "Operation not permitted" en contenedor

**Solución:**
```bash
# Agregar capabilities necesarias
# docker-compose.yml
services:
  backend:
    cap_add:
      - SYS_ADMIN  # Solo si realmente necesitas
```

## 🐛 Problemas Específicos de la Aplicación

### JWT Token inválido

**Síntoma:** 401 Unauthorized en todas las requests

**Causa:** JWT_SECRET cambió o tokens expirados

**Solución:**
```bash
# Verificar JWT_SECRET no cambió
docker compose exec backend sh -c 'echo $JWT_SECRET'

# Si cambió, usuarios deben re-login
# Si persiste, verificar código de validación

# Ver logs
docker compose logs backend | grep JWT
```

### Encryption/Decryption errors

**Síntoma:** "Decryption failed" al obtener API keys

**Causa:** ENCRYPTION_SECRET cambió o no tiene 32 caracteres

**Solución:**
```bash
# Verificar longitud (debe ser exactamente 32)
docker compose exec backend sh -c 'echo -n $ENCRYPTION_SECRET | wc -c'

# Si cambió, API keys antiguas NO se pueden recuperar
# Usuarios deben re-configurar API keys
```

### AI Provider APIs failing

**Síntoma:** Errores al ejecutar tareas con agents

**Diagnóstico:**
```bash
# Ver logs
docker compose logs backend | grep -i anthropic
docker compose logs backend | grep -i openai

# Probar conectividad
docker compose exec backend curl https://api.anthropic.com
docker compose exec backend curl https://api.openai.com

# Verificar API keys (no reveles el valor!)
docker compose exec backend sh -c 'test -n "$ANTHROPIC_API_KEY" && echo "Set" || echo "Not set"'
```

**Solución:**
- Verificar API key es válida
- Verificar cuota/límites de API
- Verificar firewall no bloquea requests salientes

### Server-Sent Events (SSE) not working

**Síntoma:** No se ven updates en tiempo real

**Causa:** Nginx o proxy buffer SSE

**Solución:**

**Nginx:**
```nginx
location /api/agents/execute-stream {
    proxy_pass http://backend:3000;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;  # IMPORTANTE para SSE
    proxy_cache off;
    proxy_read_timeout 300s;
}
```

**Docker:** Ya configurado correctamente

## 🔧 Herramientas de Diagnóstico

### Script de diagnóstico completo

```bash
#!/bin/bash
# diagnostico.sh

echo "=== AI Team - Diagnóstico Docker ==="
echo ""

echo "1. Versiones:"
docker --version
docker compose version
echo ""

echo "2. Estado de servicios:"
docker compose ps
echo ""

echo "3. Uso de recursos:"
docker stats --no-stream
echo ""

echo "4. Volúmenes:"
docker volume ls | grep ai-team
echo ""

echo "5. Redes:"
docker network ls | grep ai-team
echo ""

echo "6. Logs recientes (últimas 50 líneas):"
echo "--- Backend ---"
docker compose logs --tail=50 backend
echo ""
echo "--- Frontend ---"
docker compose logs --tail=50 frontend
echo ""
echo "--- PostgreSQL ---"
docker compose logs --tail=50 postgres
echo ""

echo "7. Health checks:"
echo "Frontend:"
curl -s http://localhost/ > /dev/null && echo "✅ OK" || echo "❌ FAIL"
echo "Backend:"
curl -s http://localhost:3000/api/health && echo "" || echo "❌ FAIL"
echo "PostgreSQL:"
docker compose exec postgres pg_isready -U aiuser
echo ""

echo "8. Variables de entorno (sin valores sensibles):"
echo "Backend:"
docker compose exec backend env | grep -E "NODE_ENV|PORT|ALLOWED_ORIGINS" | sort
echo "Frontend:"
docker compose exec frontend env | grep VITE_ | sort
echo ""

echo "9. Espacio en disco:"
docker system df
echo ""

echo "=== Fin del diagnóstico ==="
```

```bash
chmod +x diagnostico.sh
./diagnostico.sh > diagnostico_$(date +%Y%m%d_%H%M%S).txt
```

### Comandos útiles de diagnóstico

```bash
# Ver configuración efectiva de docker-compose
docker compose config

# Inspeccionar contenedor
docker inspect ai-team-backend | jq

# Ver logs con timestamps
docker compose logs -f -t backend

# Ver últimas 100 líneas
docker compose logs --tail=100 backend

# Buscar en logs
docker compose logs backend | grep -i error
docker compose logs backend | grep -i "status code"

# Ver procesos en contenedor
docker compose exec backend ps aux

# Ver puertos expuestos
docker compose port backend 3000
docker compose port frontend 80

# Ver IPs de contenedores
docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ai-team-backend

# Probar conectividad entre servicios
docker compose exec frontend ping -c 3 backend
docker compose exec backend ping -c 3 postgres

# Ver logs del Docker daemon (Linux)
journalctl -u docker -f
```

## ❓ FAQ

### ¿Por qué mi contenedor se reinicia continuamente?

Ver logs con `docker compose logs -f <servicio>`. Comunes:
- Variable de entorno faltante
- Puerto ya en uso
- Servicio dependiente no disponible
- Falta archivo requerido

### ¿Cómo actualizo una imagen base?

```bash
# Rebuild con --pull
docker compose build --pull

# O manual
docker pull node:20-alpine
docker pull postgres:15-alpine
docker compose build --no-cache
docker compose up -d
```

### ¿Cómo limpio Docker completamente?

```bash
# Detener todo
docker compose down -v

# Eliminar todo (⚠️ CUIDADO)
docker system prune -a --volumes

# Verificar
docker ps -a  # No debería mostrar nada
docker images  # No debería mostrar nada
docker volume ls  # No debería mostrar nada
```

### ¿Cómo migro datos a nuevo servidor?

```bash
# Servidor origen
docker compose exec postgres pg_dump -U aiuser ai_team | gzip > backup.sql.gz

# Copiar a nuevo servidor
scp backup.sql.gz user@nuevo-servidor:/tmp/

# Servidor destino
docker compose up -d postgres
# Esperar a que esté ready
gunzip -c /tmp/backup.sql.gz | docker compose exec -T postgres psql -U aiuser ai_team
docker compose up -d
```

### ¿Cómo debug un contenedor que no inicia?

```bash
# Ver logs detallados
docker compose logs -f backend

# Entrar y ejecutar comando manualmente
docker compose run --rm --entrypoint sh backend
# Dentro del contenedor:
npm start  # Ver error directo

# Override command temporalmente
docker compose run --rm --entrypoint sh backend -c "npm run debug"
```

### ¿Por qué el build ignora cambios de código?

```bash
# Rebuild sin caché
docker compose build --no-cache backend

# O eliminar imagen y rebuil
docker rmi ai-team-backend
docker compose build backend
docker compose up -d backend
```

---

## 📚 Más Recursos

- [README-DOCKER.md](./README-DOCKER.md) - Guía principal de Docker
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Despliegue en producción
- [SECURITY-DOCKER.md](./SECURITY-DOCKER.md) - Seguridad
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Troubleshooting](https://docs.docker.com/compose/faq/)

---

**Si encuentras un problema no documentado aquí, por favor abre un issue en el repositorio. 🐛**

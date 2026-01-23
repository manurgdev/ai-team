# 🔒 Guía de Seguridad Docker - AI Team

Esta guía cubre las mejores prácticas de seguridad para el despliegue de la aplicación AI Team con Docker.

## 📋 Tabla de Contenidos

1. [Mejores Prácticas de Seguridad](#mejores-prácticas-de-seguridad)
2. [Gestión de Secretos](#gestión-de-secretos)
3. [Configuración de HTTPS](#configuración-de-https)
4. [Seguridad de Contenedores](#seguridad-de-contenedores)
5. [Seguridad de la Red](#seguridad-de-la-red)
6. [Backup y Recuperación](#backup-y-recuperación)
7. [Monitoreo y Auditoría](#monitoreo-y-auditoría)
8. [Checklist de Seguridad](#checklist-de-seguridad)

## 🛡️ Mejores Prácticas de Seguridad

### 1. Usuarios No-Root en Contenedores

✅ **YA IMPLEMENTADO** - Los Dockerfiles ya usan usuarios no-root:

**Backend Dockerfile:**
```dockerfile
# Crear usuario no-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Cambiar propietario
RUN chown -R nodejs:nodejs /app

# Ejecutar como usuario no-root
USER nodejs
```

**Frontend Dockerfile:**
```dockerfile
# Nginx ya usa usuario no-privilegiado por defecto
```

### 2. Imágenes Base Mínimas

✅ **YA IMPLEMENTADO** - Usa imágenes Alpine cuando es posible:

```dockerfile
FROM node:20-alpine AS builder
FROM postgres:15-alpine
```

**Beneficios**:
- Superficie de ataque reducida
- Menos vulnerabilidades potenciales
- Imágenes más pequeñas y rápidas

### 3. Multi-Stage Builds

✅ **YA IMPLEMENTADO** - Los Dockerfiles usan multi-stage builds:

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
```

**Beneficios**:
- Solo incluye archivos necesarios en imagen final
- No expone código fuente en producción
- Reduce tamaño de imagen

### 4. Escaneo de Vulnerabilidades

Escanea imágenes regularmente:

```bash
# Instalar Trivy
curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin

# Escanear imágenes locales
trivy image ai-team-backend:latest
trivy image ai-team-frontend:latest
trivy image postgres:15-alpine

# Escanear con severidad crítica solamente
trivy image --severity CRITICAL,HIGH ai-team-backend:latest

# Escanear antes de push (en CI/CD)
trivy image --exit-code 1 --severity CRITICAL ai-team-backend:latest
```

### 5. Actualizaciones de Dependencias

```bash
# Backend: Auditar dependencias
cd backend
npm audit
npm audit fix

# Actualizar dependencias (con cuidado)
npm update
npm outdated

# Frontend
cd frontend
npm audit
npm audit fix
npm update
```

Configura Dependabot en GitHub para actualizaciones automáticas:

`.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/backend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10

  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10

  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
```

## 🔑 Gestión de Secretos

### ❌ NUNCA Hagas Esto

```dockerfile
# ❌ MAL - Secretos hardcodeados en Dockerfile
ENV JWT_SECRET=my-secret-key
ENV DB_PASSWORD=password123

# ❌ MAL - Secretos en imagen
COPY .env /app/.env
```

```yaml
# ❌ MAL - Secretos en docker-compose.yml
environment:
  JWT_SECRET: hardcoded-secret-bad
```

### ✅ Mejores Prácticas

#### Opción 1: Variables de Entorno desde .env

```bash
# .env (NO subir a Git - ya en .gitignore)
JWT_SECRET=<secreto-generado>
ENCRYPTION_SECRET=<secreto-generado>
DB_PASSWORD=<password-fuerte>
```

```yaml
# docker-compose.yml
environment:
  JWT_SECRET: ${JWT_SECRET}
  ENCRYPTION_SECRET: ${ENCRYPTION_SECRET}
```

#### Opción 2: Docker Secrets (Producción)

Para Docker Swarm o Kubernetes:

```yaml
# docker-compose.prod.yml
services:
  backend:
    secrets:
      - jwt_secret
      - encryption_secret
    environment:
      JWT_SECRET_FILE: /run/secrets/jwt_secret
      ENCRYPTION_SECRET_FILE: /run/secrets/encryption_secret

secrets:
  jwt_secret:
    external: true
  encryption_secret:
    external: true
```

Crear secrets:

```bash
# Crear secrets en Docker Swarm
echo "mi-secreto-super-seguro" | docker secret create jwt_secret -
openssl rand -base64 32 | cut -c1-32 | docker secret create encryption_secret -

# Listar secrets
docker secret ls

# Inspeccionar (no muestra valor)
docker secret inspect jwt_secret
```

#### Opción 3: Cloud Provider Secrets

**AWS Secrets Manager:**
```bash
aws secretsmanager create-secret \
    --name ai-team/jwt-secret \
    --secret-string "$(openssl rand -base64 48)"
```

**Google Secret Manager:**
```bash
echo -n "secreto" | gcloud secrets create jwt-secret --data-file=-
```

**Azure Key Vault:**
```bash
az keyvault secret set \
    --vault-name ai-team-vault \
    --name jwt-secret \
    --value "secreto"
```

### Generar Secretos Seguros

```bash
# JWT_SECRET (48+ caracteres)
openssl rand -base64 48
# o
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# ENCRYPTION_SECRET (exactamente 32 caracteres para AES-256)
openssl rand -base64 32 | cut -c1-32

# DB_PASSWORD (24 caracteres)
openssl rand -base64 24

# Password complejo con caracteres especiales
openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
```

### Rotar Secretos

```bash
# 1. Generar nuevo secreto
NEW_JWT_SECRET=$(openssl rand -base64 48)

# 2. Actualizar .env
sed -i "s/JWT_SECRET=.*/JWT_SECRET=$NEW_JWT_SECRET/" .env

# 3. Reiniciar servicios
docker compose restart backend

# 4. Verificar que funciona
curl http://localhost:3000/api/health

# 5. Invalidar tokens antiguos si es necesario
# (Los usuarios deberán volver a iniciar sesión)
```

## 🔐 Configuración de HTTPS

### Opción 1: Let's Encrypt con Certbot (VPS)

```bash
# Instalar Certbot
apt install -y certbot python3-certbot-nginx

# Obtener certificado
certbot --nginx -d tudominio.com -d www.tudominio.com

# Certificados se guardan en:
# /etc/letsencrypt/live/tudominio.com/fullchain.pem
# /etc/letsencrypt/live/tudominio.com/privkey.pem

# Renovación automática (crontab)
0 0 1 * * certbot renew --quiet
```

### Opción 2: Certbot con Docker (Standalone)

```bash
# Detener servicios temporalmente
docker compose down

# Obtener certificado standalone
docker run -it --rm \
  -v "/etc/letsencrypt:/etc/letsencrypt" \
  -v "/var/lib/letsencrypt:/var/lib/letsencrypt" \
  -p 80:80 -p 443:443 \
  certbot/certbot certonly --standalone \
  -d tudominio.com -d www.tudominio.com

# Reiniciar servicios
docker compose up -d
```

### Opción 3: Traefik (Reverse Proxy Automático)

`docker-compose.traefik.yml`:

```yaml
version: '3.8'

services:
  traefik:
    image: traefik:v2.10
    command:
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.email=tu@email.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock:ro"
      - "./letsencrypt:/letsencrypt"
    networks:
      - ai-team-network

  frontend:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`tudominio.com`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
      - "traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https"
      - "traefik.http.routers.frontend-http.rule=Host(`tudominio.com`)"
      - "traefik.http.routers.frontend-http.entrypoints=web"
      - "traefik.http.routers.frontend-http.middlewares=redirect-to-https"
```

### Configuración SSL Moderna en Nginx

```nginx
# /etc/nginx/conf.d/ssl.conf
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
ssl_ecdh_curve secp384r1;
ssl_session_timeout 10m;
ssl_session_cache shared:SSL:10m;
ssl_session_tickets off;
ssl_stapling on;
ssl_stapling_verify on;

# Headers de seguridad
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
```

## 🐳 Seguridad de Contenedores

### Limitar Recursos

Previene ataques de DoS por consumo de recursos:

```yaml
# docker-compose.prod.yml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE

  postgres:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G
```

### Capabilities y Privilegios

```yaml
services:
  backend:
    # Eliminar privilegios innecesarios
    cap_drop:
      - ALL
    # Agregar solo los necesarios
    cap_add:
      - NET_BIND_SERVICE  # Para bind a puertos < 1024
      - CHOWN             # Si necesitas cambiar ownership
    # Prevenir escalación de privilegios
    security_opt:
      - no-new-privileges:true
    # Sistema de archivos read-only (excepto directorios específicos)
    read_only: true
    tmpfs:
      - /tmp
      - /var/run
```

### Healthchecks

```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  frontend:
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/"]
      interval: 30s
      timeout: 5s
      retries: 3

  postgres:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-aiuser}"]
      interval: 10s
      timeout: 5s
      retries: 5
```

## 🌐 Seguridad de la Red

### Network Isolation

```yaml
# docker-compose.prod.yml
networks:
  frontend-network:
    driver: bridge
    internal: false  # Acceso a internet
  backend-network:
    driver: bridge
    internal: true   # Sin acceso a internet
  db-network:
    driver: bridge
    internal: true   # Sin acceso a internet

services:
  frontend:
    networks:
      - frontend-network
      - backend-network

  backend:
    networks:
      - backend-network
      - db-network

  postgres:
    networks:
      - db-network
    # No exponer puerto al host en producción
    # ports:
    #   - "5432:5432"
```

### Firewall (ufw)

```bash
# Habilitar firewall
ufw enable

# Permitir solo lo necesario
ufw default deny incoming
ufw default allow outgoing

# SSH (cambia puerto por defecto por seguridad)
ufw allow 22/tcp

# HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# DENEGAR acceso directo a PostgreSQL desde fuera
# (solo accesible desde contenedores)
ufw deny 5432/tcp

# Ver reglas
ufw status verbose

# Rate limiting SSH (prevenir brute force)
ufw limit 22/tcp
```

### Fail2ban (Protección contra Brute Force)

```bash
# Instalar
apt install -y fail2ban

# Configurar para Nginx
cat > /etc/fail2ban/jail.local <<EOF
[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[nginx-botsearch]
enabled = true
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 2

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
EOF

# Reiniciar
systemctl restart fail2ban
systemctl enable fail2ban

# Ver estado
fail2ban-client status
fail2ban-client status sshd
```

## 💾 Backup y Recuperación

### Script de Backup Automático

`/home/deploy/backup-db.sh`:

```bash
#!/bin/bash
set -e

# Configuración
BACKUP_DIR="/home/deploy/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30
DB_CONTAINER="ai-team-postgres"
DB_NAME="ai_team"
DB_USER="aiuser"

# Crear directorio
mkdir -p "$BACKUP_DIR"

# Backup completo (SQL + gzip)
echo "Iniciando backup de $DB_NAME..."
docker compose exec -T "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/backup_$DATE.sql.gz"

# Verificar
if [ $? -eq 0 ]; then
    echo "Backup exitoso: backup_$DATE.sql.gz"

    # Tamaño del backup
    du -h "$BACKUP_DIR/backup_$DATE.sql.gz"
else
    echo "ERROR: Backup falló"
    exit 1
fi

# Eliminar backups antiguos
echo "Eliminando backups mayores a $RETENTION_DAYS días..."
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Contar backups restantes
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | wc -l)
echo "Backups totales: $BACKUP_COUNT"

# Opcional: Subir a S3/GCS/Azure Storage
# aws s3 cp "$BACKUP_DIR/backup_$DATE.sql.gz" s3://mi-bucket/backups/
# gsutil cp "$BACKUP_DIR/backup_$DATE.sql.gz" gs://mi-bucket/backups/
# az storage blob upload --container backups --file "$BACKUP_DIR/backup_$DATE.sql.gz"

echo "Proceso completado"
```

```bash
# Hacer ejecutable
chmod +x /home/deploy/backup-db.sh

# Agregar a crontab
crontab -e

# Backup diario a las 2 AM
0 2 * * * /home/deploy/backup-db.sh >> /var/log/ai-team-backup.log 2>&1

# Backup cada 6 horas
0 */6 * * * /home/deploy/backup-db.sh >> /var/log/ai-team-backup.log 2>&1
```

### Script de Restauración

`/home/deploy/restore-db.sh`:

```bash
#!/bin/bash
set -e

if [ -z "$1" ]; then
    echo "Uso: $0 <archivo_backup.sql.gz>"
    echo "Backups disponibles:"
    ls -lh /home/deploy/backups/backup_*.sql.gz
    exit 1
fi

BACKUP_FILE="$1"
DB_CONTAINER="ai-team-postgres"
DB_NAME="ai_team"
DB_USER="aiuser"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Archivo no encontrado: $BACKUP_FILE"
    exit 1
fi

echo "⚠️  ADVERTENCIA: Esto sobrescribirá la base de datos actual"
echo "Base de datos: $DB_NAME"
echo "Backup: $BACKUP_FILE"
read -p "¿Continuar? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Operación cancelada"
    exit 0
fi

# Detener backend temporalmente
echo "Deteniendo backend..."
docker compose stop backend

# Restaurar
echo "Restaurando base de datos..."
gunzip -c "$BACKUP_FILE" | docker compose exec -T "$DB_CONTAINER" psql -U "$DB_USER" "$DB_NAME"

if [ $? -eq 0 ]; then
    echo "✅ Restauración exitosa"
else
    echo "❌ ERROR: Restauración falló"
    exit 1
fi

# Reiniciar servicios
echo "Reiniciando servicios..."
docker compose start backend

echo "Proceso completado"
```

```bash
chmod +x /home/deploy/restore-db.sh

# Usar:
# ./restore-db.sh /home/deploy/backups/backup_20260123_020000.sql.gz
```

### Backup de Volúmenes Docker

```bash
#!/bin/bash
# backup-volumes.sh

BACKUP_DIR="/home/deploy/volume-backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup del volumen postgres_data
docker run --rm \
  -v ai-team_postgres_data:/data \
  -v "$BACKUP_DIR":/backup \
  alpine tar czf /backup/postgres_data_$DATE.tar.gz -C /data .

echo "Backup del volumen creado: postgres_data_$DATE.tar.gz"
```

## 📊 Monitoreo y Auditoría

### Logs Centralizados

#### Opción 1: Logtail / Papertrail

```yaml
# docker-compose.prod.yml
services:
  backend:
    logging:
      driver: syslog
      options:
        syslog-address: "tcp://logs.papertrailapp.com:12345"
        tag: "ai-team-backend"
```

#### Opción 2: Fluentd

```yaml
services:
  fluentd:
    image: fluent/fluentd:v1.15-1
    volumes:
      - ./fluentd/conf:/fluentd/etc
      - ./fluentd/logs:/fluentd/log
    ports:
      - "24224:24224"

  backend:
    logging:
      driver: fluentd
      options:
        fluentd-address: localhost:24224
        tag: backend
```

### Monitoreo con Prometheus + Grafana

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'

  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana_data:/var/lib/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=<contraseña-segura>

  node-exporter:
    image: prom/node-exporter:latest
    ports:
      - "9100:9100"

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
    ports:
      - "8080:8080"

volumes:
  prometheus_data:
  grafana_data:
```

`prometheus.yml`:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']
```

### Alertas con Uptime Robot

Configura en https://uptimerobot.com:

1. **HTTP(s) Monitor** para frontend:
   - URL: `https://tudominio.com`
   - Interval: 5 minutos

2. **Keyword Monitor** para backend:
   - URL: `https://tudominio.com/api/health`
   - Keyword: `"status":"ok"`
   - Interval: 5 minutos

3. **Alertas**:
   - Email
   - Slack webhook
   - SMS (plan paid)

### Auditoría de Accesos

```bash
# Ver últimos logins SSH
last -a

# Ver intentos fallidos SSH
grep "Failed password" /var/log/auth.log

# Ver conexiones actuales
who
w

# Ver logs de Docker
journalctl -u docker -f

# Ver logs de contenedor
docker compose logs -f --tail=100 backend

# Buscar errores
docker compose logs backend | grep -i error
docker compose logs backend | grep -i warning
```

## ✅ Checklist de Seguridad

### Pre-Deployment

- [ ] Todos los secretos son generados aleatoriamente y únicos
- [ ] No hay secretos hardcodeados en código o Dockerfiles
- [ ] `.env` está en `.gitignore`
- [ ] Imágenes escaneadas con Trivy (sin vulnerabilidades críticas)
- [ ] Dependencias actualizadas (`npm audit`)
- [ ] Multi-stage builds implementados
- [ ] Usuarios no-root en contenedores
- [ ] CORS configurado correctamente
- [ ] NODE_ENV=production
- [ ] Rate limiting habilitado

### Post-Deployment

- [ ] HTTPS configurado y funcionando
- [ ] Certificados SSL válidos (A+ en SSL Labs)
- [ ] Headers de seguridad configurados
- [ ] Firewall configurado (solo puertos necesarios)
- [ ] Fail2ban instalado y configurado
- [ ] PostgreSQL NO expuesto públicamente
- [ ] Backups automáticos configurados
- [ ] Monitoreo configurado (Uptime Robot, etc.)
- [ ] Logs centralizados o monitoreados
- [ ] Health checks funcionando
- [ ] Resource limits configurados
- [ ] Política de actualizaciones definida

### Mantenimiento Continuo

- [ ] Revisar logs semanalmente
- [ ] Actualizar dependencias mensualmente
- [ ] Rotar secretos cada 90 días
- [ ] Probar restauración de backups trimestralmente
- [ ] Renovar certificados SSL automáticamente
- [ ] Auditar accesos mensualmente
- [ ] Revisar vulnerabilidades de imágenes
- [ ] Mantener Docker Engine actualizado

## 🆘 Respuesta a Incidentes

### Sospecha de Compromiso

1. **NO apagues inmediatamente** - puede destruir evidencia
2. Aísla el sistema (desconecta de red o bloquea firewall)
3. Captura memoria y logs antes de apagar
4. Crea imágenes forenses de discos
5. Analiza logs de acceso
6. Revisa procesos sospechosos
7. Cambia TODOS los secretos y contraseñas
8. Notifica a usuarios si es necesario

### Comandos Útiles

```bash
# Ver procesos en contenedor
docker compose exec backend ps aux

# Ver conexiones de red
docker compose exec backend netstat -tulpn

# Ver archivos modificados recientemente
docker compose exec backend find / -mtime -1 -type f 2>/dev/null

# Inspeccionar contenedor en busca de anomalías
docker inspect ai-team-backend

# Revisar logs por IP sospechosa
docker compose logs backend | grep "<IP_SOSPECHOSA>"
```

---

## 📚 Recursos Adicionales

- [OWASP Docker Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [NIST Container Security Guide](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-190.pdf)

---

**¡La seguridad es un proceso continuo, no un estado final! 🔒**

# 🐳 Guía Completa de Docker - AI Team

Esta guía cubre todo lo necesario para ejecutar la aplicación AI Team usando Docker, desde desarrollo local hasta preparación para producción.

## 📋 Tabla de Contenidos

1. [Arquitectura](#arquitectura)
2. [Requisitos Previos](#requisitos-previos)
3. [Configuración Inicial](#configuración-inicial)
4. [Desarrollo Local](#desarrollo-local)
5. [Gestión de Base de Datos](#gestión-de-base-de-datos)
6. [Comandos Útiles](#comandos-útiles)
7. [Solución de Problemas](#solución-de-problemas)

## 🏗️ Arquitectura

La aplicación AI Team está completamente dockerizada con la siguiente arquitectura:

```
┌─────────────────────────────────────────────────────┐
│                   Docker Host                        │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │   Frontend   │  │   Backend    │  │ PostgreSQL│ │
│  │              │  │              │  │           │ │
│  │ React + Vite │◄─┤ Node.js +    │◄─┤ Database  │ │
│  │ + Nginx      │  │ Express +    │  │ (Port     │ │
│  │ (Port 80)    │  │ TypeScript   │  │  5432)    │ │
│  │              │  │ (Port 3000)  │  │           │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
│         │                 │                 │       │
│         └─────────────────┴─────────────────┘       │
│                 ai-team-network                      │
│                  (Bridge Network)                    │
│                                                      │
│  Volumes:                                           │
│  • postgres_data → /var/lib/postgresql/data         │
└─────────────────────────────────────────────────────┘
```

### Servicios

1. **PostgreSQL** (`postgres`)
   - Imagen: `postgres:15-alpine`
   - Puerto: 5432
   - Volumen persistente para datos
   - Health check cada 10 segundos

2. **Backend** (`backend`)
   - Build: Multi-stage desde `./backend/Dockerfile`
   - Puerto: 3000
   - Ejecuta migraciones automáticamente al iniciar
   - Depende de PostgreSQL (espera health check)

3. **Frontend** (`frontend`)
   - Build: Multi-stage desde `./frontend/Dockerfile`
   - Puerto: 80
   - Nginx sirviendo SPA de React
   - Proxy pass a backend para /api/*

### Red y Comunicación

- **Red personalizada**: `ai-team-network` (tipo bridge)
- Los servicios se comunican usando nombres de servicio DNS:
  - Frontend → Backend: `http://backend:3000`
  - Backend → PostgreSQL: `postgresql://postgres:5432`

## ✅ Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

- **Docker Engine** 20.10 o superior
- **Docker Compose** 2.0 o superior
- **Git** (para clonar el repositorio)
- **Mínimo 2GB RAM** disponible para contenedores
- **4GB espacio en disco** para imágenes y volúmenes

### Verificar instalación

```bash
# Verificar Docker
docker --version
# Debe mostrar: Docker version 20.10.x o superior

# Verificar Docker Compose
docker compose version
# Debe mostrar: Docker Compose version v2.x.x o superior

# Verificar que Docker está ejecutándose
docker ps
# No debe mostrar error de conexión
```

## ⚙️ Configuración Inicial

### 1. Clonar el Repositorio

```bash
git clone <tu-repositorio-url>
cd ai-team
```

### 2. Configurar Variables de Entorno

Copia el archivo de ejemplo y edítalo:

```bash
cp .env.example .env
```

Edita el archivo `.env` con tus valores:

```bash
# Puedes usar nano, vim o cualquier editor
nano .env
```

### 3. Variables de Entorno Explicadas

#### 🗄️ Base de Datos

```env
DB_USER=aiuser                    # Usuario de PostgreSQL
DB_PASSWORD=aipassword            # Contraseña de PostgreSQL
DB_NAME=ai_team                   # Nombre de la base de datos
DB_PORT=5432                      # Puerto expuesto (host)
```

⚠️ **Importante**: En producción, usa contraseñas seguras, no los valores de ejemplo.

#### 🔐 Seguridad (JWT y Encriptación)

```env
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
ENCRYPTION_SECRET=your-super-secret-encryption-key-change-this-in-production-must-be-32-chars
```

⚠️ **CRÍTICO**:
- `JWT_SECRET`: Debe ser una cadena aleatoria larga (mínimo 32 caracteres)
- `ENCRYPTION_SECRET`: Debe tener exactamente 32 caracteres para AES-256
- **NUNCA** uses los valores de ejemplo en producción
- Genera secretos seguros:
  ```bash
  # JWT_SECRET
  openssl rand -base64 48

  # ENCRYPTION_SECRET (exactamente 32 caracteres)
  openssl rand -base64 32 | cut -c1-32
  ```

#### 🌐 Backend y CORS

```env
NODE_ENV=production               # production o development
BACKEND_PORT=3000                 # Puerto expuesto del backend
ALLOWED_ORIGINS=http://localhost:5173,http://localhost
```

`ALLOWED_ORIGINS`: Lista separada por comas de orígenes permitidos para CORS.
- **Desarrollo local**: `http://localhost:5173,http://localhost`
- **Producción**: `https://tudominio.com,https://www.tudominio.com`

#### 🎨 Frontend

```env
FRONTEND_PORT=80                  # Puerto expuesto del frontend
VITE_API_URL=http://localhost:3000/api
```

`VITE_API_URL`: URL del backend que el frontend usará.
- **Desarrollo local**: `http://localhost:3000/api`
- **Producción**: `https://api.tudominio.com/api` o `https://tudominio.com/api`

#### 🤖 API Keys de IA (Opcional)

Estos son opcionales. Los usuarios pueden configurarlos dentro de la aplicación:

```env
ANTHROPIC_API_KEY=               # Claude API key
OPENAI_API_KEY=                  # OpenAI API key
GOOGLE_API_KEY=                  # Google AI API key
```

#### 🐙 GitHub OAuth (Opcional)

Para futuras integraciones de GitHub:

```env
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

## 🚀 Desarrollo Local

### Iniciar la Aplicación

```bash
# Construir imágenes e iniciar todos los servicios
docker compose up -d

# Ver logs en tiempo real
docker compose logs -f
```

La opción `-d` ejecuta los contenedores en background (detached mode).

### Acceder a los Servicios

Una vez iniciados, accede a:

- **Frontend**: http://localhost (puerto 80)
- **Backend API**: http://localhost:3000
- **PostgreSQL**: localhost:5432

### Verificar Estado

```bash
# Ver estado de todos los servicios
docker compose ps

# Debería mostrar algo como:
# NAME                  IMAGE                COMMAND             STATUS
# ai-team-backend       ai-team-backend      ...                 Up
# ai-team-frontend      ai-team-frontend     ...                 Up
# ai-team-postgres      postgres:15-alpine   ...                 Up (healthy)
```

### Ver Logs

```bash
# Logs de todos los servicios
docker compose logs -f

# Logs de un servicio específico
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres

# Ver últimas 100 líneas
docker compose logs --tail=100 backend
```

### Detener la Aplicación

```bash
# Detener servicios (conserva volúmenes y red)
docker compose stop

# Detener y eliminar contenedores (conserva volúmenes)
docker compose down

# Detener, eliminar contenedores Y volúmenes (⚠️ borra datos)
docker compose down -v
```

### Reconstruir tras Cambios de Código

Cuando hagas cambios en el código, necesitas reconstruir las imágenes:

```bash
# Reconstruir todas las imágenes
docker compose build

# Reconstruir sin caché (construcción limpia)
docker compose build --no-cache

# Reconstruir y reiniciar
docker compose up -d --build

# Reconstruir solo un servicio
docker compose build backend
docker compose up -d backend
```

### Hot-Reload en Desarrollo

Por defecto, Docker ejecuta builds de producción. Para desarrollo con hot-reload:

1. Usa `docker-compose.override.yml` (ver sección siguiente)
2. O ejecuta el backend/frontend localmente sin Docker:

```bash
# Backend local
cd backend
npm install
npm run dev

# Frontend local (en otra terminal)
cd frontend
npm install
npm run dev
```

Y solo ejecuta PostgreSQL con Docker:

```bash
docker compose up -d postgres
```

## 🗄️ Gestión de Base de Datos

### Ejecutar Migraciones de Prisma

Las migraciones se ejecutan automáticamente al iniciar el backend, pero puedes ejecutarlas manualmente:

```bash
# Ejecutar migraciones pendientes
docker compose exec backend npx prisma migrate deploy --schema=./src/prisma/schema.prisma

# Ver estado de migraciones
docker compose exec backend npx prisma migrate status --schema=./src/prisma/schema.prisma
```

### Generar Cliente de Prisma

Si modificas el schema de Prisma:

```bash
docker compose exec backend npx prisma generate --schema=./src/prisma/schema.prisma
```

### Prisma Studio (Interfaz Visual)

Explora y edita datos con Prisma Studio:

```bash
docker compose exec backend npx prisma studio --schema=./src/prisma/schema.prisma
```

Luego abre: http://localhost:5555

### Acceder a PostgreSQL Directamente

```bash
# Conectar con psql
docker compose exec postgres psql -U aiuser -d ai_team

# Dentro de psql, puedes ejecutar queries SQL:
# \dt          - Listar tablas
# \d tabla     - Describir tabla
# SELECT * FROM "User";
# \q           - Salir
```

### Backup de Base de Datos

```bash
# Crear backup
docker compose exec postgres pg_dump -U aiuser ai_team > backup_$(date +%Y%m%d_%H%M%S).sql

# O con compresión
docker compose exec postgres pg_dump -U aiuser ai_team | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Restaurar desde Backup

```bash
# Restaurar desde archivo SQL
docker compose exec -T postgres psql -U aiuser ai_team < backup_20240123_120000.sql

# Restaurar desde archivo comprimido
gunzip -c backup_20240123_120000.sql.gz | docker compose exec -T postgres psql -U aiuser ai_team
```

### Reiniciar Base de Datos (⚠️ Borra Todos los Datos)

```bash
# Detener servicios
docker compose down

# Eliminar volumen de PostgreSQL
docker volume rm ai-team_postgres_data

# Reiniciar (creará nueva BD vacía)
docker compose up -d
```

## 🛠️ Comandos Útiles

### Gestión de Contenedores

```bash
# Reiniciar un servicio específico
docker compose restart backend

# Reiniciar todos los servicios
docker compose restart

# Ver estadísticas de recursos (CPU, memoria)
docker stats

# Ver solo los de esta app
docker stats ai-team-backend ai-team-frontend ai-team-postgres

# Pausar servicios (sin detener)
docker compose pause

# Reanudar servicios pausados
docker compose unpause
```

### Ejecutar Comandos dentro de Contenedores

```bash
# Abrir shell en un contenedor
docker compose exec backend sh
docker compose exec frontend sh
docker compose exec postgres sh

# Ejecutar comando sin abrir shell
docker compose exec backend npm run test
docker compose exec backend node --version

# Ejecutar como root (para instalar paquetes, etc.)
docker compose exec -u root backend sh
```

### Inspección y Debugging

```bash
# Inspeccionar configuración de un servicio
docker compose config

# Ver detalles de un contenedor
docker inspect ai-team-backend

# Ver logs con timestamps
docker compose logs -f -t backend

# Buscar en logs
docker compose logs backend | grep ERROR

# Ver procesos dentro de un contenedor
docker compose exec backend ps aux
```

### Limpieza y Mantenimiento

```bash
# Eliminar contenedores detenidos
docker container prune

# Eliminar imágenes no utilizadas
docker image prune

# Eliminar todo no utilizado (contenedores, redes, imágenes)
docker system prune

# Limpieza agresiva (incluye volúmenes)
docker system prune -a --volumes

# Ver espacio usado por Docker
docker system df
```

### Red y Conectividad

```bash
# Inspeccionar red
docker network inspect ai-team_ai-team-network

# Ver IPs de los contenedores
docker compose exec backend ip addr
docker compose exec backend hostname -i

# Probar conectividad entre servicios
docker compose exec backend ping postgres
docker compose exec frontend ping backend

# Verificar conectividad a PostgreSQL
docker compose exec backend nc -zv postgres 5432
```

### Variables de Entorno

```bash
# Ver variables de entorno de un contenedor
docker compose exec backend env

# Ver solo DATABASE_URL
docker compose exec backend sh -c 'echo $DATABASE_URL'
```

## 🔍 Solución de Problemas

### Error: "Containers already exist"

**Problema**: `ERROR: service "backend" is already running`

**Solución**:
```bash
docker compose down
docker compose up -d
```

### Error: "Port already allocated"

**Problema**: `bind: address already in use` o puerto 80/3000/5432 en uso

**Solución**:
```bash
# Encontrar qué proceso usa el puerto
lsof -i :80
lsof -i :3000
lsof -i :5432

# Detener ese proceso o cambiar puerto en .env
# Por ejemplo:
FRONTEND_PORT=8080
BACKEND_PORT=3001
DB_PORT=5433
```

### Frontend no se conecta al Backend

**Problema**: Errores CORS o "Failed to fetch"

**Solución**:
1. Verifica `ALLOWED_ORIGINS` en `.env`
2. Verifica `VITE_API_URL` en `.env`
3. Reconstruye frontend:
   ```bash
   docker compose build frontend
   docker compose up -d frontend
   ```

### Base de Datos no inicia

**Problema**: PostgreSQL unhealthy o no inicia

**Solución**:
```bash
# Ver logs detallados
docker compose logs postgres

# Verificar permisos del volumen
docker volume inspect ai-team_postgres_data

# Si es problema de permisos, recrea el volumen
docker compose down -v
docker compose up -d
```

### Backend falla al ejecutar migraciones

**Problema**: `Error: P1001: Can't reach database server`

**Solución**:
1. Verifica que PostgreSQL esté healthy:
   ```bash
   docker compose ps
   ```
2. Verifica `DATABASE_URL` en logs del backend:
   ```bash
   docker compose logs backend | grep DATABASE_URL
   ```
3. Reinicia servicios respetando dependencias:
   ```bash
   docker compose down
   docker compose up -d postgres
   # Esperar a que esté healthy (10-20 segundos)
   docker compose up -d backend frontend
   ```

### Contenedor se reinicia continuamente

**Problema**: Estado `Restarting` constantemente

**Solución**:
```bash
# Ver logs para identificar error
docker compose logs -f backend

# Revisar exit code
docker inspect ai-team-backend --format='{{.State.ExitCode}}'

# Errores comunes:
# - Variables de entorno faltantes
# - Puerto ya en uso
# - Dependencia no disponible (BD)
```

### Cambios de código no se reflejan

**Problema**: Modificaste código pero no ves cambios

**Solución**:
```bash
# Reconstruir imagen sin caché
docker compose build --no-cache backend
docker compose up -d backend

# O para todo
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Volumen sin espacio

**Problema**: `no space left on device`

**Solución**:
```bash
# Ver espacio usado
docker system df

# Limpiar imágenes no usadas
docker image prune -a

# Limpiar todo
docker system prune -a --volumes

# Ver tamaño de volúmenes
docker volume ls
docker system df -v
```

### No puedes conectarte desde el host

**Problema**: No puedes acceder a http://localhost desde tu navegador

**Solución**:
1. Verifica que los contenedores estén corriendo:
   ```bash
   docker compose ps
   ```
2. Verifica que los puertos estén mapeados:
   ```bash
   docker compose port frontend 80
   docker compose port backend 3000
   ```
3. Prueba con curl:
   ```bash
   curl http://localhost
   curl http://localhost:3000/api
   ```

## 📚 Recursos Adicionales

- [Guía de Deployment](./DEPLOYMENT.md) - Despliegue en producción
- [Seguridad Docker](./SECURITY-DOCKER.md) - Mejores prácticas de seguridad
- [Troubleshooting Avanzado](./TROUBLESHOOTING-DOCKER.md) - Solución de problemas complejos
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)

## 🆘 Obtener Ayuda

Si encuentras problemas no cubiertos en esta guía:

1. Revisa los logs detallados: `docker compose logs -f`
2. Consulta [TROUBLESHOOTING-DOCKER.md](./TROUBLESHOOTING-DOCKER.md)
3. Busca el error en Docker/GitHub issues
4. Abre un issue en el repositorio del proyecto

---

**Siguiente paso**: Para despliegue en producción, consulta [DEPLOYMENT.md](./DEPLOYMENT.md)

# 🚀 Guía de Setup para Equipo Nuevo

Esta guía te ayudará a clonar y ejecutar el proyecto AI Team en un equipo nuevo por primera vez.

## Requisitos Previos

Antes de comenzar, verifica que tengas instalado:

1. **Docker Desktop** (versión >= 24.0)
   - Descarga: https://www.docker.com/products/docker-desktop
   - Asegúrate de que Docker Desktop esté ejecutándose

2. **Git**
   - Verifica con: `git --version`

3. **Acceso a las claves API** (opcionales para probar):
   - Anthropic API key (para Claude)
   - OpenAI API key (para GPT-4)
   - Google API key (para Gemini)

## Pasos de Instalación

### 1. Clonar el Repositorio

```bash
git clone <repository-url>
cd ai-team
```

### 2. Configurar Variables de Entorno

```bash
# Copiar archivo de ejemplo
cp .env.example .env
```

Edita el archivo `.env` y configura al menos estos valores:

```env
# Database (puedes dejar los valores por defecto)
DB_USER=ai_team
DB_PASSWORD=ai_team_secer
DB_NAME=ai_team_db
DB_PORT=5432

# Backend
BACKEND_PORT=3000
NODE_ENV=development

# IMPORTANTE: Cambia estos secretos
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
ENCRYPTION_SECRET=your-super-secret-encryption-key-change-this-in-production-must-be-32-chars

# Frontend
FRONTEND_PORT=80
VITE_API_URL=http://localhost:3000/api

# API Keys (opcional - se pueden configurar luego en la app)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_API_KEY=
```

**⚠️ Importante:** Los valores de `JWT_SECRET` y `ENCRYPTION_SECRET` deben ser cadenas aleatorias largas (32+ caracteres).

### 3. Dar Permisos a Scripts

```bash
chmod +x scripts/dev/*.sh
```

### 4. Iniciar la Aplicación

```bash
./scripts/dev/start-dev.sh
```

Este script:
1. ✅ Verifica que Docker esté corriendo
2. ✅ Copia `.env.example` a `.env` si no existe
3. ✅ Construye las imágenes Docker
4. ✅ Inicia PostgreSQL
5. ✅ Ejecuta las migraciones de Prisma automáticamente
6. ✅ Inicia backend y frontend
7. ✅ Verifica que todo esté funcionando

**Tiempo estimado:** 2-5 minutos la primera vez (descarga imágenes e instala dependencias).

### 5. Verificar Instalación

El script mostrará el estado de los servicios. También puedes verificar manualmente:

```bash
# Ver estado de contenedores
docker compose ps

# Deberías ver algo como:
# ai-team-backend    Up    0.0.0.0:3000->3000/tcp
# ai-team-frontend   Up    0.0.0.0:5173->5173/tcp
# ai-team-postgres   Up    0.0.0.0:5432->5432/tcp
```

Verificar base de datos:

```bash
./scripts/dev/check-db.sh
```

Este script verifica que:
- PostgreSQL está ejecutándose
- Las tablas fueron creadas correctamente
- Las migraciones están aplicadas

### 6. Acceder a la Aplicación

Abre tu navegador en:

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3000
- **Health Check:** http://localhost:3000/health

### 7. Crear tu Primera Cuenta

1. Ve a http://localhost:5173
2. Click en "Sign Up"
3. Crea tu cuenta de usuario
4. Inicia sesión

### 8. Configurar API Keys (Opcional)

1. Una vez autenticado, ve a "Configuration" o "Settings"
2. Agrega al menos una API key de un proveedor de IA:
   - Anthropic (Claude)
   - OpenAI (GPT-4)
   - Google (Gemini)
3. Haz click en "Test Connection" para verificar que funciona

## Problemas Comunes

### ❌ Error: "Docker no está ejecutándose"

**Solución:** Abre Docker Desktop y espera a que inicie completamente.

### ❌ Error: "Base de datos sin tablas"

**Síntomas:**
- El backend inicia pero falla al hacer queries
- Errores sobre tablas que no existen

**Solución 1 - Verificar estado:**
```bash
./scripts/dev/check-db.sh
```

**Solución 2 - Ejecutar migraciones manualmente:**
```bash
docker compose exec backend npx prisma migrate deploy --schema=./src/prisma/schema.prisma
```

**Solución 3 - Reset completo:**
```bash
docker compose down -v
docker compose up -d
```

Ver más soluciones en [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

### ❌ Error: Puerto ya en uso

Si ves errores como "port is already allocated":

**Solución 1 - Cambiar puerto en .env:**
```bash
# Edita .env y cambia los puertos
BACKEND_PORT=3001
FRONTEND_PORT=5174
```

**Solución 2 - Detener proceso que usa el puerto:**
```bash
# En macOS/Linux
lsof -i :3000  # Ver qué usa el puerto
kill -9 <PID>  # Detener proceso

# En Windows (PowerShell)
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### ❌ Backend no responde

**Verificar logs:**
```bash
docker compose logs backend
```

**Buscar errores de migración:**
```bash
docker compose logs backend | grep -i "prisma\|migration\|error"
```

**Reiniciar backend:**
```bash
docker compose restart backend
docker compose logs -f backend
```

### ❌ Frontend muestra pantalla en blanco

**Verificar logs:**
```bash
docker compose logs frontend
```

**Limpiar caché y reiniciar:**
```bash
docker compose down
docker compose build frontend --no-cache
docker compose up -d
```

## Comandos Útiles

### Ver logs en tiempo real
```bash
# Todos los servicios
docker compose logs -f

# Solo backend
docker compose logs -f backend

# Solo frontend
docker compose logs -f frontend
```

### Detener la aplicación
```bash
docker compose down
```

### Detener y eliminar datos (reset completo)
```bash
docker compose down -v
```

### Reiniciar un servicio específico
```bash
docker compose restart backend
# o
docker compose restart frontend
```

### Acceder al shell de un contenedor
```bash
# Backend
docker compose exec backend sh

# PostgreSQL
docker compose exec postgres psql -U ai_team -d ai_team_db
```

### Ver uso de recursos
```bash
docker stats
```

## Próximos Pasos

1. **Lee la documentación:**
   - [README.md](./README.md) - Información general del proyecto
   - [README-DOCKER.md](./README-DOCKER.md) - Guía completa de Docker
   - [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Solución de problemas

2. **Configura GitHub Integration (opcional):**
   - Genera un Personal Access Token en GitHub
   - Configúralo en la aplicación
   - Podrás exportar resultados como Pull Requests

3. **Crea tu primera tarea:**
   - Ve a "New Task"
   - Selecciona los agentes que quieres en tu equipo
   - Describe la tarea
   - ¡Observa a los agentes trabajar en tiempo real!

## ¿Necesitas Ayuda?

1. Revisa [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. Ejecuta `./scripts/dev/check-db.sh` para diagnóstico
3. Revisa los logs: `docker compose logs`
4. Contacta al equipo de desarrollo

## Notas de Desarrollo

### Hot Reload

La aplicación está configurada con hot-reload:
- **Backend:** Los cambios en `backend/src/` se reflejan automáticamente (tsx watch)
- **Frontend:** Los cambios en `frontend/src/` activan Vite HMR

No necesitas reiniciar los contenedores para ver cambios en el código.

### Base de Datos

Las migraciones se ejecutan automáticamente al iniciar. Si agregas nuevos modelos:

```bash
# Crear migración
docker compose exec backend npx prisma migrate dev --name nombre_migracion

# Aplicar en producción
docker compose exec backend npx prisma migrate deploy
```

### Actualizaciones

Cuando hagas `git pull` de cambios:

```bash
# Si hay cambios en package.json o Dockerfiles
docker compose build
docker compose up -d

# Si hay cambios en el schema de Prisma
docker compose exec backend npx prisma migrate deploy --schema=./src/prisma/schema.prisma
```

¡Listo! Ya tienes AI Team ejecutándose en tu equipo. 🎉

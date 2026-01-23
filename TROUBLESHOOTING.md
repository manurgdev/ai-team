# Troubleshooting Guide

Guía de solución de problemas comunes al clonar y ejecutar el proyecto.

## Problema: Base de datos sin tablas

### Síntoma
Al ejecutar `./scripts/dev/start-dev.sh`, el backend inicia pero no hay tablas en la base de datos.

### Diagnóstico
```bash
# Verificar estado de la base de datos
./scripts/dev/check-db.sh
```

### Soluciones

#### Opción 1: Ejecutar migraciones manualmente
```bash
docker compose exec backend npx prisma migrate deploy --schema=./src/prisma/schema.prisma
```

#### Opción 2: Reiniciar el contenedor del backend
```bash
docker compose restart backend
docker compose logs -f backend
```

#### Opción 3: Reset completo (⚠️ Borra todos los datos)
```bash
docker compose down -v
docker compose up -d
```

## Problema: Error "role does not exist"

### Síntoma
Error al conectar a PostgreSQL: `FATAL: role "xxx" does not exist`

### Solución
1. Verifica que el archivo `.env` en la raíz del proyecto tiene las credenciales correctas:
   ```env
   DB_USER=ai_team
   DB_PASSWORD=ai_team_secer
   DB_NAME=ai_team_db
   ```

2. Si cambiaste las credenciales, necesitas recrear los contenedores:
   ```bash
   docker compose down -v
   docker compose up -d
   ```

## Problema: Backend no responde

### Síntoma
El contenedor backend está "Up" pero no responde en http://localhost:3000

### Diagnóstico
```bash
# Ver logs del backend
docker compose logs -f backend

# Verificar estado del contenedor
docker compose ps
```

### Posibles causas y soluciones

#### 1. Migraciones fallando
```bash
# Ver logs específicos de migraciones
docker compose logs backend | grep -i "prisma\|migration"

# Ejecutar migraciones manualmente
docker compose exec backend npx prisma migrate deploy --schema=./src/prisma/schema.prisma
```

#### 2. Error en variables de entorno
```bash
# Verificar que .env existe
ls -la .env

# Si no existe, copiar desde template
cp .env.example .env

# Editar .env y configurar secretos
vim .env  # o tu editor preferido

# Reiniciar contenedores
docker compose restart
```

#### 3. Puerto ocupado
```bash
# Verificar si el puerto 3000 está ocupado
lsof -i :3000

# Cambiar puerto en .env si es necesario
echo "BACKEND_PORT=3001" >> .env
docker compose restart backend
```

## Problema: Frontend no carga

### Síntoma
Vite inicia pero muestra errores al cargar la aplicación

### Diagnóstico
```bash
# Ver logs del frontend
docker compose logs -f frontend

# Verificar que Vite está sirviendo
curl http://localhost:5173
```

### Soluciones

#### 1. Archivos de configuración faltantes
El error puede indicar que falta `tsconfig.node.json` u otros archivos de config.

```bash
# Verificar que todos los archivos de config existen
ls -la frontend/tsconfig*.json frontend/vite.config.ts

# Reiniciar frontend
docker compose restart frontend
```

#### 2. Node modules corruptos
```bash
# Reconstruir imagen del frontend
docker compose build frontend --no-cache
docker compose up -d frontend
```

## Problema: Cambios en código no se reflejan

### Síntoma
Modificas archivos pero los cambios no aparecen en la aplicación

### Solución para Backend
```bash
# Verificar que tsx watch está corriendo
docker compose logs backend | grep "watch"

# Si no está usando watch, reiniciar
docker compose restart backend
```

### Solución para Frontend
```bash
# Verificar que Vite HMR está activo
docker compose logs frontend | grep "ready"

# Reiniciar frontend
docker compose restart frontend
```

## Comandos útiles

### Ver logs en tiempo real
```bash
# Todos los servicios
docker compose logs -f

# Solo backend
docker compose logs -f backend

# Solo frontend
docker compose logs -f frontend

# Solo PostgreSQL
docker compose logs -f postgres
```

### Acceder a contenedores
```bash
# Shell en backend
docker compose exec backend sh

# Shell en frontend
docker compose exec frontend sh

# Shell en PostgreSQL
docker compose exec postgres psql -U ai_team -d ai_team_db
```

### Limpieza completa
```bash
# Detener y eliminar contenedores + volúmenes
docker compose down -v

# Eliminar imágenes también
docker compose down -v --rmi all

# Reconstruir desde cero
docker compose build --no-cache
docker compose up -d
```

### Verificar estado general
```bash
# Estado de contenedores
docker compose ps

# Uso de recursos
docker stats

# Verificar redes
docker network ls | grep ai-team

# Verificar volúmenes
docker volume ls | grep ai-team
```

## Requisitos previos

Asegúrate de tener instalado:
- Docker Desktop (o Docker Engine + Docker Compose)
- Git
- Un editor de texto

Versiones recomendadas:
- Docker: >= 24.0
- Docker Compose: >= 2.20

## ¿Necesitas más ayuda?

Si ninguna de estas soluciones funciona:

1. Revisa los logs completos:
   ```bash
   docker compose logs > logs.txt
   ```

2. Verifica tu configuración:
   ```bash
   cat .env
   docker compose config
   ```

3. Abre un issue en GitHub con:
   - Sistema operativo y versión
   - Versión de Docker
   - Logs completos
   - Pasos exactos que seguiste

# Deployment — CRM

> Versión 1.0 · 2026-09-21

## 1. Entornos

| Entorno | Base de datos | Autenticación DB | Frontend | Backend |
|---|---|---|---|---|
| Desarrollo | `crm_dev` en `SQLEXPRESS` local (TCP 1433) | Login SQL `crm_dev` (modo mixto) | Vite dev server `:5173` | `node --watch` `:4000` |
| Test | `crm_test` | Login SQL `crm_dev` (local) / `sa` del contenedor (CI) | — | Vitest |
| Staging / Producción | SQL Server 2019+ o Azure SQL | Login SQL dedicado, TLS válido | Build estático servido por nginx | Node 22 en contenedor o PM2 |

## 2. Topología recomendada (producción)

```
Internet ──HTTPS──▶ Reverse proxy (nginx / IIS / Azure App Gateway)
                      ├── /            → archivos estáticos del build de React
                      └── /api/*       → http://server:4000   (mismo origen: sin CORS, cookies simples)
                                            └── TDS/TLS ──▶ SQL Server (red privada)
```

Servir frontend y API bajo el **mismo origen** simplifica CORS y cookies. Si se despliegan en
orígenes distintos, configurar `CORS_ORIGINS` y `SameSite=None; Secure` para la cookie de refresh.

## 3. Variables de entorno

### 3.1 Backend (`server/.env`)

| Variable | Obligatoria | Default | Descripción |
|---|---|---|---|
| `NODE_ENV` | sí | `development` | `development` \| `test` \| `production` |
| `PORT` | no | `4000` | Puerto HTTP |
| `TRUST_PROXY` | no | `false` | `true` detrás de reverse proxy |
| `LOG_LEVEL` | no | `info` | `fatal`…`trace` |
| `DATABASE_URL` | sí | — | Cadena Prisma para SQL Server |
| `TEST_DATABASE_URL` | solo tests | — | Debe contener `_test` |
| `JWT_ACCESS_SECRET` | sí | — | ≥ 32 caracteres aleatorios |
| `JWT_ACCESS_EXPIRES_IN` | no | `15m` | Vida del access token |
| `REFRESH_TOKEN_EXPIRES_DAYS` | no | `7` | Vida del refresh token |
| `COOKIE_SECURE` | no | `false` | `true` en producción (HTTPS) |
| `BCRYPT_ROUNDS` | no | `12` | Coste de bcrypt |
| `LOCKOUT_ATTEMPTS` | no | `5` | Fallos antes de bloquear |
| `LOCKOUT_MINUTES` | no | `15` | Duración del bloqueo |
| `CORS_ORIGINS` | sí | — | Orígenes permitidos separados por coma |
| `RATE_LIMIT_WINDOW_MS` | no | `900000` | Ventana del rate limit global |
| `RATE_LIMIT_MAX` | no | `300` | Peticiones por ventana e IP |
| `LOGIN_RATE_LIMIT_MAX` | no | `10` | Intentos de login por ventana e IP |
| `SEED_ADMIN_EMAIL` | solo seed | — | Email del primer Admin |
| `SEED_ADMIN_PASSWORD` | solo seed | — | Contraseña temporal del primer Admin |
| `SEED_ADMIN_FIRST_NAME` / `SEED_ADMIN_LAST_NAME` | no | `Admin` / `Sistema` | — |

Formato de `DATABASE_URL`:

```
sqlserver://HOST:1433;database=NOMBRE;user=USUARIO;password=CONTRASEÑA;encrypt=true;trustServerCertificate=false
sqlserver://localhost:1433;database=crm_dev;user=crm_dev;password=CONTRASEÑA;encrypt=true;trustServerCertificate=true   (desarrollo local)
```

Si la contraseña contiene `;` o `=`, envolverla entre llaves: `password={p;ss=w}`.

### 3.2 Frontend (`client/.env`)

| Variable | Default | Descripción |
|---|---|---|
| `VITE_API_URL` | `http://localhost:4000/api` | Base de la API. En producción con mismo origen: `/api` |
| `VITE_APP_NAME` | `CRM` | Nombre mostrado |

Todo lo que empieza por `VITE_` se incrusta en el bundle público: **nunca** poner secretos.

## 4. Preparación de SQL Server en producción

```sql
-- 1. Base con la collation del proyecto
CREATE DATABASE crm COLLATE Modern_Spanish_100_CI_AI;
GO
-- 2. Login para migraciones (DDL) y login para la aplicación (DML)
CREATE LOGIN crm_migrator WITH PASSWORD = '<secreto>', CHECK_POLICY = ON;
CREATE LOGIN crm_app      WITH PASSWORD = '<secreto>', CHECK_POLICY = ON;
GO
USE crm;
CREATE USER crm_migrator FOR LOGIN crm_migrator;
ALTER ROLE db_ddladmin   ADD MEMBER crm_migrator;
ALTER ROLE db_datareader ADD MEMBER crm_migrator;
ALTER ROLE db_datawriter ADD MEMBER crm_migrator;
CREATE USER crm_app FOR LOGIN crm_app;
ALTER ROLE db_datareader ADD MEMBER crm_app;
ALTER ROLE db_datawriter ADD MEMBER crm_app;
GO
```

`prisma migrate deploy` se ejecuta con `crm_migrator` (no necesita shadow database); la aplicación
corre con `crm_app`. Habilitar TLS con certificado válido y `trustServerCertificate=false`.

## 5. Opción A — Docker Compose (recomendada)

Archivos (se crean en la fase de producción):

- `server/Dockerfile`: imagen `node:22-alpine`, `npm ci --omit=dev`, `prisma generate`, usuario no root, `CMD ["node", "src/server.js"]`. Un `entrypoint.sh` ejecuta `prisma migrate deploy` antes de arrancar (configurable con `RUN_MIGRATIONS=true`).
- `client/Dockerfile`: etapa de build (`npm ci && npm run build`) + etapa `nginx:alpine` con `nginx.conf` que sirve `/` (SPA fallback a `index.html`) y hace proxy de `/api` al servicio `server`.
- `docker-compose.yml`: servicios `server`, `client`; perfil `staging` añade `mssql` (`mcr.microsoft.com/mssql/server:2022-latest`) con volumen persistente. Secretos vía `env_file` no versionado o Docker secrets.

Comandos:

```bash
docker compose build
docker compose up -d                      # producción con SQL Server externo
docker compose --profile staging up -d    # con SQL Server en contenedor
docker compose logs -f server
```

## 6. Opción B — Windows Server con PM2 + IIS

1. Instalar Node 22 LTS y `npm i -g pm2`.
2. Clonar, `npm ci`, `npm run build -w client`.
3. `server/.env` con las variables de producción (permisos de archivo restringidos al usuario del servicio).
4. `npx prisma migrate deploy` (desde `server/`).
5. `pm2 start src/server.js --name crm-api --cwd server` y `pm2 save` + `pm2-windows-service` para arranque automático.
6. IIS: sitio que sirve `client/dist` con *URL Rewrite* (SPA fallback) y *Application Request Routing* para `/api` → `http://localhost:4000`. HTTPS con certificado válido.

## 7. Pipeline de despliegue

1. Merge a `main` con CI en verde.
2. Etiquetar versión (`vX.Y.Z`) y generar changelog.
3. Backup de la base (`BACKUP DATABASE crm TO DISK = …`).
4. `prisma migrate deploy` (migraciones aditivas primero; destructivas en dos versiones).
5. Desplegar backend y frontend (imágenes o build).
6. Verificar `GET /health` y flujo de login.
7. Rollback: restaurar imagen/build anterior; si la migración fue destructiva, restaurar backup.

## 8. Operación

| Aspecto | Práctica |
|---|---|
| Salud | `GET /health` (app + `SELECT 1` en base) para el balanceador/monitor |
| Logs | JSON a stdout; recolectados por Docker/PM2; retención según política; sin datos sensibles |
| Backups | SQL Server: full diario, log cada 15 min (modelo *Full recovery*); prueba de restauración mensual |
| Métricas mínimas | Latencia p95 por ruta, tasa de 5xx, conexiones a base, uso de CPU/memoria |
| Escalado | API sin estado (los refresh tokens están en base) → varias réplicas detrás del proxy; rate limit por IP requiere `TRUST_PROXY=true` |
| Mantenimiento | Job diario: limpiar `RefreshToken` expirados (> 30 días) y `Notification` leídas (> 90 días); reindexar según fragmentación |
| Actualizaciones | `npm audit` semanal; actualizaciones de Prisma probadas en staging |

## 9. Checklist de puesta en producción

- [ ] `NODE_ENV=production`, `COOKIE_SECURE=true`, `TRUST_PROXY=true` si aplica.
- [ ] `JWT_ACCESS_SECRET` único y aleatorio (≥ 64 bytes).
- [ ] `CORS_ORIGINS` solo con el dominio real.
- [ ] Login SQL de aplicación con permisos mínimos; TLS válido.
- [ ] Migraciones aplicadas (`prisma migrate status` sin pendientes).
- [ ] Seed ejecutado una vez; contraseña del Admin inicial cambiada.
- [ ] `/health` responde `ok` tras el despliegue.
- [ ] Backups programados y probados.
- [ ] Sin `.env` ni secretos en imágenes, repositorio ni logs.
- [ ] Cabeceras de seguridad verificadas (p. ej. con `curl -I`).

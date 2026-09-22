# CRM

CRM profesional para gestionar el proceso comercial de una empresa: empresas y contactos,
clientes, leads, pipeline de oportunidades (tabla y Kanban), actividades, notas, historial,
dashboard, reportes, notificaciones y configuración, con roles y permisos extensibles.

> Estado: **Fase 3.2 — Autenticación, usuarios y roles** completada. La implementación avanza por fases
> (ver [Roadmap](#roadmap)). Este README se actualiza en cada fase.

## Tabla de contenidos

- [Arquitectura](#arquitectura)
- [Tecnologías](#tecnologías)
- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [SQL Server](#sql-server)
- [Prisma y migraciones](#prisma-y-migraciones)
- [Ejecución](#ejecución)
- [Tests](#tests)
- [API](#api)
- [Deployment](#deployment)
- [Documentación](#documentación)
- [Roadmap](#roadmap)
- [Convenciones de Git](#convenciones-de-git)

## Arquitectura

```
client/   React SPA (Vite) ──HTTP/JSON──▶ server/  Node.js + Express ──Prisma──▶ SQL Server
                                            routes → controllers → services
                                            middleware · validators · lib · config
docs/     Especificación técnica
```

- **Frontend**: componentes reutilizables, lógica de datos en hooks (TanStack Query), presentación separada.
- **Backend**: API REST por capas; validación con Zod en cada endpoint; manejo centralizado de errores;
  logging estructurado; autenticación JWT + refresh token rotativo; RBAC con alcance por ownership.
- **Base de datos**: SQL Server relacional normalizada, acceso con Prisma, migraciones versionadas.

Detalle: [docs/architecture.md](docs/architecture.md).

## Tecnologías

| Capa | Tecnologías |
|---|---|
| Frontend | React, Vite, React Router, TanStack Query, react-hook-form, Zod, Axios, Tailwind CSS, @hello-pangea/dnd, Recharts, lucide-react |
| Backend | Node.js 22, Express, Prisma, Zod, jsonwebtoken, bcrypt, helmet, cors, express-rate-limit, cookie-parser, pino |
| Base de datos | Microsoft SQL Server 2019+ (desarrollo: 2022 Express) |
| Testing | Vitest, Supertest, React Testing Library, MSW |
| Calidad | ESLint, Prettier |
| Infra | npm workspaces, Docker Compose, GitHub Actions |

## Requisitos

- Node.js ≥ 22.18 (usa el *type stripping* nativo para el cliente Prisma generado) y npm ≥ 10
- Git
- Microsoft SQL Server 2019+ (Express es suficiente) con **TCP/IP habilitado** en el puerto 1433
- Windows: `sqlcmd` (incluido con SQL Server) para los scripts de creación de bases

## Instalación

```bash
git clone https://github.com/zatfortDev/crm-claude.git
cd crm-claude
npm install
```

`npm install` en la raíz instala las dependencias de `client/` y `server/` (npm workspaces).

## Configuración

1. Copiar los archivos de ejemplo:

   ```bash
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   ```

2. Editar `server/.env`:
   - `DATABASE_URL` y `TEST_DATABASE_URL` según tu SQL Server (ver abajo).
   - `JWT_ACCESS_SECRET`: generar con
     `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`.
   - `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`: credenciales temporales del primer administrador
     (se exige cambiarlas en el primer login).

3. **Nunca** subir `server/.env` ni `client/.env` al repositorio (están en `.gitignore`).

Variables documentadas en [docs/deployment.md § 3](docs/deployment.md#3-variables-de-entorno).

### Variables de entorno (resumen)

| Backend | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión Prisma a SQL Server |
| `TEST_DATABASE_URL` | Base de tests (debe contener `_test`) |
| `JWT_ACCESS_SECRET` | Secreto del JWT (≥ 32 caracteres) |
| `CORS_ORIGINS` | Orígenes permitidos (coma) |
| `PORT`, `NODE_ENV`, `LOG_LEVEL`, `COOKIE_SECURE`, `TRUST_PROXY` | Runtime |
| `SEED_ADMIN_*` | Admin inicial para el seed |

| Frontend | Descripción |
|---|---|
| `VITE_API_URL` | URL base de la API |

## SQL Server

### Desarrollo local (SQL Server Express)

La aplicación se conecta con un **login SQL** (el driver de Prisma 7 no soporta autenticación
integrada de Windows). Pasos, una sola vez:

1. Habilitar **TCP/IP** en *SQL Server Configuration Manager → Protocolos de SQLEXPRESS*, fijar
   **Puerto TCP = 1433** en `IPAll` (puertos dinámicos vacío).
2. Habilitar **modo mixto** y crear el login de desarrollo (elegí tu contraseña):

   ```bash
   sqlcmd -S "localhost\SQLEXPRESS" -E -Q "EXEC xp_instance_regwrite N'HKEY_LOCAL_MACHINE', N'Software\Microsoft\MSSQLServer\MSSQLServer', N'LoginMode', REG_DWORD, 2"
   sqlcmd -S "localhost\SQLEXPRESS" -E -Q "CREATE LOGIN crm_dev WITH PASSWORD = 'TU_CONTRASEÑA', CHECK_POLICY = OFF; ALTER SERVER ROLE dbcreator ADD MEMBER crm_dev;"
   ```

3. Reiniciar el servicio **SQL Server (SQLEXPRESS)**.
4. Crear las bases con la collation del proyecto y dar acceso al login:

   ```bash
   npm run db:create
   ```

   (ejecuta `server/scripts/create-databases.sql`: `crm_dev` y `crm_test` con `Modern_Spanish_100_CI_AI`).
5. En `server/.env`:
   `DATABASE_URL="sqlserver://localhost:1433;database=crm_dev;user=crm_dev;password=TU_CONTRASEÑA;encrypt=true;trustServerCertificate=true"`

Guía completa: [docs/database.md § 8](docs/database.md#8-preparación-de-sql-server-desarrollo-local).

## Prisma y migraciones

```bash
npm run db:generate          # genera el cliente Prisma
npm run db:migrate           # aplica migraciones pendientes en desarrollo (prisma migrate dev)
npm run db:migrate -- --name add_something   # crea una nueva migración
npm run db:deploy            # aplica migraciones en test/producción (prisma migrate deploy)
npm run db:seed              # roles, permisos, etapas, fuentes, settings y admin inicial (idempotente)
npm run db:studio            # Prisma Studio
```

Esquema en `server/prisma/schema.prisma`; migraciones en `server/prisma/migrations/`.
Flujo y reglas: [docs/database.md § 9](docs/database.md#9-flujo-de-migraciones).

## Ejecución

```bash
npm run dev            # backend (http://localhost:4000) + frontend (http://localhost:5173)
npm run dev -w server  # solo backend
npm run dev -w client  # solo frontend
npm run build          # build de producción del frontend
npm start -w server    # backend en modo producción
```

Primer acceso: iniciar sesión con `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` y cambiar la contraseña.

## Tests

```bash
npm test                      # backend + frontend
npm run test -w server        # integración (Supertest sobre crm_test) + unitarios
npm run test:coverage -w server
npm run test -w client        # componentes con RTL + MSW
npm run lint
```

Estrategia: [docs/testing.md](docs/testing.md).

## API

Base: `/api`. Autenticación `Bearer` + cookie de refresh. Respuestas con envoltorio
`{ success, data, meta? }` / `{ success: false, error: { code, message, details? } }`.

| Recurso | Ruta |
|---|---|
| Autenticación | `/api/auth` |
| Usuarios y roles | `/api/users`, `/api/roles`, `/api/permissions` |
| Empresas y contactos | `/api/companies`, `/api/contacts` |
| Clientes | `/api/clients` |
| Leads | `/api/leads` |
| Oportunidades | `/api/opportunities` (+ `/kanban`) |
| Actividades y notas | `/api/activities`, `/api/notes` |
| Dashboard y reportes | `/api/dashboard`, `/api/reports` |
| Búsqueda, notificaciones | `/api/search`, `/api/notifications` |
| Configuración y auditoría | `/api/settings`, `/api/pipeline-stages`, `/api/lead-sources`, `/api/audit-logs` |
| Salud | `/health` |

Referencia completa: [docs/api.md](docs/api.md).

## Deployment

Opciones documentadas en [docs/deployment.md](docs/deployment.md):

- **Docker Compose** (recomendada): `server` + `client` (nginx con proxy `/api`) + SQL Server externo o en contenedor para staging.
- **Windows Server**: PM2 + IIS como reverse proxy.

Migraciones en producción solo con `prisma migrate deploy`. Checklist de salida a producción incluido.

## Documentación

| Documento | Contenido |
|---|---|
| [docs/requirements.md](docs/requirements.md) | Alcance, roles, requisitos funcionales y no funcionales, reglas de negocio, decisiones |
| [docs/architecture.md](docs/architecture.md) | Capas, estructura de carpetas, convenciones de API, frontend |
| [docs/database.md](docs/database.md) | Tablas, relaciones, índices, restricciones, integridad, preparación de SQL Server, migraciones |
| [docs/api.md](docs/api.md) | Endpoints, permisos, ejemplos de request/response, códigos de error |
| [docs/security.md](docs/security.md) | Amenazas y mitigaciones, autenticación, RBAC, validación, cabeceras, checklist |
| [docs/testing.md](docs/testing.md) | Niveles, herramientas, base de test, casos críticos, CI |
| [docs/deployment.md](docs/deployment.md) | Entornos, variables, SQL Server en producción, Docker, PM2, operación |

## Roadmap

| Fase | Rama | Estado |
|---|---|---|
| 1. Análisis | — | ✅ |
| 2. Especificación (docs) | `main` | ✅ |
| 3.1 Setup: workspaces, Express, React, Prisma, migración inicial, seed | `feature/project-setup` | ✅ |
| 3.2 Autenticación, usuarios, roles y permisos | `feature/authentication` | ✅ |
| 3.3 Empresas y contactos | `feature/companies-contacts` | ⏳ |
| 3.4 Clientes | `feature/clients` | ⏳ |
| 3.5 Leads y conversión | `feature/leads` | ⏳ |
| 3.6 Oportunidades y Kanban | `feature/opportunities` | ⏳ |
| 3.7 Actividades, notas y timeline | `feature/activities` | ⏳ |
| 3.8 Dashboard y reportes | `feature/dashboard` | ⏳ |
| 3.9 Notificaciones, búsqueda global, configuración, auditoría | `feature/notifications-settings` | ⏳ |
| 3.10 Seguridad, optimización, Docker, CI, docs finales | `feature/production-readiness` | ⏳ |

## Convenciones de Git

- Ramas `feature/<modulo>` integradas a `main` con `--no-ff` tras tests en verde y revisión de secretos.
- Commits pequeños con prefijo: `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`.
- Nunca se versionan `.env`, credenciales, tokens ni certificados.

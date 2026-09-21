# Arquitectura — CRM

> Versión 1.0 · 2026-09-21

## 1. Visión general

Aplicación web de tres capas físicas: un SPA en React, una API REST en Node.js/Express
y una base de datos Microsoft SQL Server accedida mediante Prisma ORM.

```
┌──────────────────────────┐   HTTPS · JSON   ┌────────────────────────────────────┐   TDS/TCP   ┌────────────────┐
│ client/  React SPA       │ ───────────────▶ │ server/  Node 22 + Express         │ ──────────▶ │ SQL Server     │
│ Vite · React Router      │ ◀─────────────── │ routes → controllers → services    │ ◀────────── │ 2019+ / Azure  │
│ TanStack Query · RHF+Zod │ {success,data}   │ middleware · validators · prisma   │             │ SQL            │
│ Tailwind · Recharts      │                  │ pino · helmet · rate-limit          │             └────────────────┘
└──────────────────────────┘                  └────────────────────────────────────┘
```

Principios:

1. **La lógica de negocio vive en `services`**; rutas y controladores son delgados.
2. **Nada entra sin validar**: cada endpoint declara esquemas Zod para `body`, `params` y `query`.
3. **La autoridad está en el backend**: el frontend oculta botones según permisos, pero el
   servidor los aplica siempre.
4. **Contratos estables**: formato de respuesta único, códigos de error enumerados, paginación uniforme.
5. **Fallar rápido**: la configuración se valida al arrancar; sin `.env` correcto el proceso no inicia.

## 2. Estructura de carpetas

```
crm-con-claude/
├── client/                      # Frontend React (Vite)
│   ├── public/
│   ├── src/
│   │   ├── api/                 # axios instance + un módulo por recurso (clientsApi.js …)
│   │   ├── app/                 # router.jsx · providers.jsx · AppLayout.jsx
│   │   ├── components/
│   │   │   ├── ui/              # primitivas: Button, Input, Select, Textarea, Checkbox, Modal,
│   │   │   │                    #   Table, Card, Badge, Tabs, Pagination, Skeleton, Toast, Dropdown
│   │   │   ├── layout/          # Sidebar, Navbar, PageHeader, NotificationBell, UserMenu
│   │   │   └── common/          # DataTable, EmptyState, ErrorState, ConfirmDialog, SearchInput,
│   │   │                        #   FilterBar, EntityTimeline, NotesPanel, ActivityList, OwnerSelect
│   │   ├── features/            # un directorio por módulo funcional
│   │   │   └── <modulo>/
│   │   │       ├── components/  # presentación específica (ClientForm, ClientTable, KanbanBoard…)
│   │   │       ├── hooks/       # useClients(), useClient(id), useCreateClient() … (TanStack Query)
│   │   │       └── pages/       # ClientsPage, ClientDetailPage
│   │   ├── context/             # AuthContext (usuario, permisos, token en memoria)
│   │   ├── hooks/               # useDebounce, usePagination, usePermission, useQueryParams
│   │   ├── lib/                 # formatters (fechas, moneda), constants, schemas (zod), utils
│   │   └── styles/              # index.css (Tailwind + tokens de diseño)
│   ├── tests/                   # setup de Vitest, MSW handlers
│   ├── .env.example
│   ├── index.html
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── server/                      # Backend Express
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/          # generadas por `prisma migrate dev`, SQL revisado y versionado
│   │   └── seed.js              # roles, permisos, etapas, fuentes, settings, admin inicial
│   ├── src/
│   │   ├── config/              # env.js (zod), cors.js, rateLimit.js, constants.js
│   │   ├── controllers/         # <recurso>.controller.js
│   │   ├── services/            # <recurso>.service.js (+ audit.service.js, notification.service.js)
│   │   ├── routes/              # <recurso>.routes.js · index.js monta todo bajo /api
│   │   ├── middleware/          # authenticate, authorize, validate, errorHandler, notFound,
│   │   │                        #   requestLogger, rateLimiter, requireFreshPassword
│   │   ├── validators/          # <recurso>.validators.js (esquemas Zod)
│   │   ├── utils/               # ApiError, apiResponse, pagination, asyncHandler, password, tokens,
│   │   │                        #   csv, dates, scope
│   │   ├── models/              # constantes de dominio: leadStatuses, activityTypes, permissions…
│   │   ├── lib/                 # prisma.js (singleton), logger.js (pino)
│   │   ├── app.js               # crea y configura la app (sin listen) → testeable
│   │   └── server.js            # listen + graceful shutdown
│   ├── tests/
│   │   ├── integration/         # <recurso>.test.js con Supertest
│   │   ├── unit/
│   │   ├── helpers/             # db.js (reset/seed), auth.js (loginAs), factories.js
│   │   └── setup/               # globalSetup (migrate deploy sobre crm_test), setupFiles
│   ├── .env.example
│   └── package.json
│
├── docs/                        # especificación (este directorio)
├── .github/workflows/ci.yml     # lint + tests + build
├── docker-compose.yml           # server + client(nginx) [+ mssql para staging]
├── package.json                 # npm workspaces: client, server · scripts raíz
├── .gitignore
└── README.md
```

## 3. Backend

### 3.1 Flujo de una petición

```
Request
  → requestLogger (asigna requestId, loguea método/ruta/duración)
  → helmet · cors · express.json({limit:'1mb'}) · cookie-parser
  → rateLimiter (global; login tiene uno más estricto)
  → router /api/<recurso>
      → authenticate            (verifica JWT, carga req.user = {id, roleId, permissions})
      → requireFreshPassword    (bloquea si mustChangePassword, salvo endpoints permitidos)
      → authorize('clients:read')
      → validate({ body, params, query })  (Zod; strip de campos desconocidos)
      → controller              (extrae datos validados, llama al service, responde)
          → service             (reglas de negocio, scope, transacciones, auditoría, notificaciones)
              → prisma          (acceso a datos)
  → notFound (404 para rutas inexistentes)
  → errorHandler (ApiError → respuesta uniforme; otros → 500 sin detalles en producción)
```

### 3.2 Responsabilidades por capa

| Capa | Hace | No hace |
|---|---|---|
| `routes` | Define el path, encadena middlewares y controlador | Lógica, acceso a datos |
| `controllers` | Lee `req.validated`, `req.user`; llama a un service; usa `apiResponse` | Reglas de negocio, Prisma |
| `services` | Reglas de negocio, `scope` por ownership, `$transaction`, emite `AuditLog` y `Notification`, lanza `ApiError` con códigos de negocio | Conocer `req`/`res` |
| `validators` | Esquemas Zod reutilizables (`createClientSchema`, `listClientsQuerySchema`…) | — |
| `middleware` | Autenticación, autorización, validación, logging, errores, rate limit | — |
| `utils` | Helpers puros (paginación, CSV, hash, tokens) | Estado |
| `models` | Constantes y enumeraciones del dominio + catálogo de permisos | Esquemas de datos (están en Prisma) |
| `lib` | Singletons: cliente Prisma, logger | — |
| `config` | Carga y valida `.env` (Zod). Exporta objeto `env` tipado y congelado | — |

### 3.3 Convenciones de la API

**Envoltorio de respuesta**

```json
// Éxito (objeto)
{ "success": true, "data": { "id": 12, "name": "…" } }

// Éxito (listado)
{ "success": true, "data": [ … ], "meta": { "page": 1, "pageSize": 20, "total": 143, "totalPages": 8 } }

// Error
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Datos inválidos",
    "details": [ { "field": "email", "message": "Email inválido" } ] } }
```

**Códigos de error** (`ApiError`):

| HTTP | `code` | Uso |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Zod falla (`details` por campo) |
| 400 | `BAD_REQUEST` | Petición malformada |
| 401 | `UNAUTHORIZED` | Token ausente/expirado/inválido, credenciales incorrectas |
| 403 | `FORBIDDEN` | Sin permiso o fuera de alcance |
| 403 | `PASSWORD_CHANGE_REQUIRED` | `mustChangePassword` activo |
| 404 | `NOT_FOUND` | Recurso inexistente o fuera de alcance (no se distingue, evita enumeración) |
| 409 | `CONFLICT` | Unicidad (email, taxId), doble conversión, empresa ya cliente |
| 422 | `BUSINESS_RULE` | Regla de negocio violada (`details.rule`): transición inválida, último admin, etc. |
| 423 | `ACCOUNT_LOCKED` | Bloqueo por intentos fallidos |
| 429 | `RATE_LIMITED` | Rate limit |
| 500 | `INTERNAL_ERROR` | Error no controlado (sin stack en producción) |

**Paginación, orden y filtros** (`GET` de listados):

| Parámetro | Tipo | Default | Notas |
|---|---|---|---|
| `page` | int ≥ 1 | 1 | |
| `pageSize` | int 1..100 | 20 | |
| `sortBy` | string (whitelist por recurso) | `createdAt` | |
| `sortOrder` | `asc` \| `desc` | `desc` | |
| `search` | string | — | Busca en columnas definidas por recurso con `contains` |
| `includeDeleted` | bool | false | Solo con `X:delete` (ver archivados) |
| filtros propios | según recurso | — | Ej. `status`, `ownerId`, `stageId`, `from`, `to` |

**Fechas**: ISO 8601 en UTC (`2026-09-21T14:30:00.000Z`). Campos `DATE` puros como `YYYY-MM-DD`.

**Identificadores**: enteros positivos en la URL; validados con Zod (`z.coerce.number().int().positive()`).

### 3.4 Alcance (scope) por ownership

`utils/scope.js` expone `ownerScope(user, resource)` que devuelve `{}` si el usuario tiene
`<resource>:read_all` o `{ ownerId: user.id }` en caso contrario. Los services lo fusionan en
cada `where`. Para edición, `assertCanModify(user, resource, record)` verifica `update_all`
o propiedad y lanza `FORBIDDEN`.

### 3.5 Transacciones y auditoría

- Operaciones compuestas (conversión de lead, cambio de etapa, reasignación, alta de usuario)
  se ejecutan en `prisma.$transaction(async (tx) => …)`.
- `audit.service.log(tx, { entityType, entityId, action, changes, userId, ip })` se llama
  **dentro** de la transacción para que el log sea consistente con el cambio.
- `changes` guarda solo los campos modificados: `{ before: {…}, after: {…} }`, nunca
  `passwordHash` ni tokens.

### 3.6 Notificaciones

`notification.service.create(tx, { userId, type, title, message, entityType, entityId })`
se invoca desde los services de negocio. Las de "actividad vence hoy / vencida" se generan
por un *job* liviano ejecutado con `setInterval` al arrancar (cada hora, idempotente por
usuario/día) — suficiente para v1 y sin infraestructura adicional.

### 3.7 Logging

- `pino` con `pino-http`: cada request loguea `requestId`, método, ruta, status, duración, `userId`.
- Niveles: `error` (5xx y excepciones), `warn` (401/403/423/429, fallos de login), `info` (arranque,
  operaciones críticas: login, conversión, cierre de oportunidad, cambios de rol), `debug` (dev).
- `redact`: `req.headers.authorization`, `req.headers.cookie`, `*.password`, `*.passwordHash`, `*.token`.
- Salida JSON a stdout; en desarrollo `pino-pretty`.

### 3.8 Configuración

`config/env.js` valida con Zod todas las variables (ver [deployment.md § 3](deployment.md#3-variables-de-entorno))
y aborta con un mensaje claro si falta alguna. Ningún módulo lee `process.env` directamente.

### 3.9 Manejo de errores

- `utils/ApiError.js`: `new ApiError(status, code, message, details?)` + fábricas
  (`ApiError.notFound()`, `.forbidden()`, `.conflict()`, `.businessRule(rule, message)`).
- `asyncHandler` envuelve controladores para propagar promesas rechazadas.
- `errorHandler` mapea: `ApiError` → tal cual; `ZodError` → 400; errores Prisma conocidos
  (`P2002` unicidad → 409, `P2025` no encontrado → 404, `P2003` FK → 422); resto → 500.
  En producción el mensaje de 500 es genérico y el stack va solo al log.

## 4. Frontend

### 4.1 Capas

| Capa | Responsabilidad |
|---|---|
| `api/` | Instancia Axios (`baseURL`, `withCredentials`), interceptor que añade `Authorization`, interceptor de 401 que intenta `/auth/refresh` una vez y reintenta; funciones por recurso que devuelven `data` |
| `features/*/hooks` | TanStack Query: `useQuery` para lecturas (keys por recurso y filtros), `useMutation` con invalidación; aquí se concentra la "lógica de datos" del front |
| `features/*/components` | Presentación: reciben datos y callbacks por props |
| `features/*/pages` | Componen layout + hooks + componentes; manejan estado de URL (filtros, página) |
| `components/ui` | Primitivas sin conocimiento del dominio |
| `components/common` | Compuestos reutilizables entre módulos (tabla de datos, timeline, notas, diálogo de confirmación) |
| `context/AuthContext` | Usuario, permisos, access token en memoria; `login`, `logout`, `hasPermission` |
| `lib/schemas` | Esquemas Zod de formularios (espejo de los del backend, sin reglas que requieran datos del servidor) |

### 4.2 Rutas

| Ruta | Página | Permiso |
|---|---|---|
| `/login` | Login | público |
| `/change-password` | Cambio obligatorio | autenticado |
| `/` → `/dashboard` | Dashboard | `dashboard:view` |
| `/companies`, `/companies/:id` | Empresas | `companies:read` |
| `/contacts`, `/contacts/:id` | Contactos | `contacts:read` |
| `/clients`, `/clients/:id` | Clientes | `clients:read` |
| `/leads`, `/leads/:id` | Leads | `leads:read` |
| `/opportunities`, `/opportunities/kanban`, `/opportunities/:id` | Oportunidades | `opportunities:read` |
| `/activities` | Actividades | `activities:read` |
| `/reports` | Reportes | `reports:view` |
| `/notifications` | Notificaciones | autenticado |
| `/users`, `/roles` | Administración | `users:read`, `roles:read` |
| `/settings` (general, pipeline, fuentes, auditoría) | Configuración | `settings:read` / `settings:manage` / `audit:read` |
| `/profile` | Perfil propio | autenticado |

`ProtectedRoute` redirige a `/login` sin sesión, a `/change-password` si `mustChangePassword`, y
muestra 403 si falta el permiso.

### 4.3 Patrones de UI

- **Listados**: `PageHeader` (título + acción primaria) → `FilterBar` (búsqueda con debounce + filtros) →
  `DataTable` (ordenable, paginada, skeleton en carga, `EmptyState` sin datos, `ErrorState` con reintento).
- **Formularios**: modal o página según complejidad; `react-hook-form` + `zodResolver`; errores del
  servidor (`details[]`) se mapean a los campos.
- **Detalle**: cabecera con datos clave y acciones → tabs (Resumen, Contactos/Oportunidades,
  Actividades, Notas, Historial).
- **Confirmaciones**: `ConfirmDialog` para archivar, cerrar oportunidad como perdida, cambiar rol.
- **Feedback**: toasts para éxito/error; estados de carga en botones.
- **Kanban**: columnas por etapa con totales; drag & drop con `@hello-pangea/dnd`; al soltar en
  ganada/perdida se abre diálogo (motivo si perdida); actualización optimista con rollback.
- **Diseño**: tokens en Tailwind (paleta primaria, grises, semánticos), tipografía Inter, sidebar
  colapsable, navbar con búsqueda global y campana.

### 4.4 Estado

- Servidor: TanStack Query (cache por `['clients', filters]`, `['client', id]`, etc.; `staleTime` 30 s).
- Sesión: `AuthContext` (token en memoria + `me`). Al cargar la app se intenta `POST /auth/refresh`
  (cookie) para restaurar sesión sin `localStorage`.
- UI local: `useState`/URL search params. Sin store global adicional.

## 5. Base de datos

Ver [database.md](database.md). Resumen: 18 tablas, PK `INT IDENTITY`, soft delete en entidades
principales, `PipelineStage` y `LeadSource` configurables, `AuditLog` polimórfico append-only,
índices filtrados para unicidad con NULL, CHECK constraints para dominios de valores.

## 6. Decisiones transversales

| Tema | Decisión |
|---|---|
| Módulos | ES Modules en todo el repo (`"type": "module"`) |
| Versionado de API | Prefijo `/api` sin versión en v1; si se necesita, `/api/v2` convive |
| IDs | Enteros; nunca se exponen IDs de otras entidades fuera de alcance |
| Zona horaria | Base en UTC; el frontend formatea con la zona de configuración (`Setting.timezone`) |
| Moneda | `Opportunity.currency` ISO 4217; por defecto `Setting.default_currency` |
| Borrado | Soft delete con `deletedAt`; filtros por defecto lo excluyen |
| Concurrencia | Última escritura gana en edición simple; operaciones de estado dentro de transacción con relectura |
| Tamaño de payload | 1 MB |
| CSV | Generado en streaming en el servidor, `Content-Disposition: attachment` |

## 7. Extensibilidad prevista

| Necesidad futura | Punto de extensión |
|---|---|
| Nuevo rol | Registro en `Role` + permisos vía UI, sin código |
| Nuevo permiso | Añadir código a `models/permissions.js` + seed; usar en `authorize()` |
| Equipos | `User.managerId` + scope `team` en `utils/scope.js` |
| Email | Implementar `notification.channels.email` y un job de cola |
| Tiempo real | Publicar eventos desde `notification.service` a un adaptador WebSocket |
| Multi-tenant | Añadir `tenantId` a tablas raíz y al scope; fuera de v1 |
| Etiquetas | Tablas `Tag` y `EntityTag` (polimórfica con FKs nullable) |

# API REST — CRM

> Versión 1.0 · 2026-09-21 · Base URL: `http://<host>:<port>/api`

## 1. Convenciones generales

- **Formato**: JSON en request y response (`Content-Type: application/json`).
- **Autenticación**: `Authorization: Bearer <accessToken>` en todos los endpoints salvo los marcados como públicos.
  El refresh token viaja en cookie `httpOnly` (`crm_refresh`) restringida a `Path=/api/auth`.
- **Respuesta**: envoltorio uniforme (ver [architecture.md § 3.3](architecture.md#33-convenciones-de-la-api)).
- **Errores**: `{ success: false, error: { code, message, details? } }` con los códigos de la tabla de arquitectura.
- **Paginación**: `page`, `pageSize` (≤ 100), `sortBy`, `sortOrder`, `search` + filtros por recurso; respuesta con `meta`.
- **Fechas**: ISO 8601 UTC; fechas puras `YYYY-MM-DD`.
- **IDs**: enteros positivos.
- **Alcance**: los listados y detalles aplican el scope por ownership del usuario; un recurso fuera de alcance responde `404`.
- **Permisos**: columna *Permiso* de cada tabla. `—` = solo autenticado.
- **Verbos**: `POST` crea · `PUT` reemplaza (todos los campos editables, validados) · `PATCH` cambia estado/asignación · `DELETE` archiva (soft delete).
- **Idempotencia**: `PUT`, `PATCH` y `DELETE` son idempotentes; `POST /leads/:id/convert` responde `409` si ya fue convertido.

Objetos resumidos que aparecen embebidos en respuestas:

```json
"owner":   { "id": 3, "firstName": "Ana", "lastName": "Pérez" }
"company": { "id": 10, "name": "Acme S.A." }
"contact": { "id": 22, "firstName": "Juan", "lastName": "Gómez", "email": "juan@acme.com" }
"client":  { "id": 5, "type": "COMPANY", "displayName": "Acme S.A." }
"stage":   { "id": 2, "name": "Contactado", "isWon": false, "isLost": false, "color": "#3b82f6" }
```

## 2. Salud

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/health` | público | `{ status: "ok", db: "ok", uptime, version }`. `503` si la base no responde. |

## 3. Autenticación — `/api/auth`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/auth/login` | público (rate limit 10/15 min) | Inicia sesión |
| POST | `/auth/refresh` | cookie | Rota el refresh token y emite nuevo access token |
| POST | `/auth/logout` | — | Revoca el refresh token actual y limpia la cookie |
| GET | `/auth/me` | — | Usuario actual con rol y permisos |
| POST | `/auth/change-password` | — | Cambia la contraseña (permitido con `mustChangePassword`) |
| PUT | `/auth/profile` | — | Edita nombre y teléfono propios |

**POST /auth/login**

```json
// Request
{ "email": "ana@empresa.com", "password": "********" }

// 200
{ "success": true, "data": {
    "accessToken": "eyJ…", "expiresIn": 900,
    "user": { "id": 3, "email": "ana@empresa.com", "firstName": "Ana", "lastName": "Pérez",
              "role": { "id": 3, "name": "Vendedor" }, "permissions": ["clients:read", "…"],
              "mustChangePassword": false } } }
// + Set-Cookie: crm_refresh=…; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=604800

// 401 UNAUTHORIZED  "Credenciales inválidas"      (email inexistente, contraseña incorrecta o usuario inactivo)
// 423 ACCOUNT_LOCKED "Cuenta bloqueada temporalmente"
// 429 RATE_LIMITED
```

**POST /auth/refresh** → `200 { accessToken, expiresIn, user }` + nueva cookie. `401` si la cookie falta, expiró o fue revocada (reuso detectado → se revoca la cadena).

**POST /auth/change-password**

```json
{ "currentPassword": "********", "newPassword": "********" }
// 204 · 400 VALIDATION_ERROR (política) · 401 (actual incorrecta)
```

## 4. Usuarios — `/api/users`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/users` | `users:read` | Lista. Filtros: `search` (nombre/email), `roleId`, `isActive` |
| GET | `/users/:id` | `users:read` | Detalle |
| POST | `/users` | `users:create` | Alta con contraseña temporal |
| PUT | `/users/:id` | `users:update` | Edita nombre, apellido, teléfono, email |
| PATCH | `/users/:id/status` | `users:manage` | `{ isActive }` — protege al último Admin; revoca tokens al desactivar |
| PATCH | `/users/:id/role` | `users:manage` | `{ roleId }` — no sobre uno mismo; protege al último Admin |
| POST | `/users/:id/reset-password` | `users:manage` | `{ temporaryPassword }` → `mustChangePassword = true`, revoca tokens |
| GET | `/users/options` | — | `[{ id, firstName, lastName }]` de usuarios activos, para selectores de responsable |

```json
// POST /users
{ "email": "carlos@empresa.com", "firstName": "Carlos", "lastName": "Ruiz", "phone": "+54 11 5555-0000",
  "roleId": 3, "temporaryPassword": "Temporal2026!" }
// 201 { id, email, firstName, lastName, phone, role, isActive, mustChangePassword, createdAt }
// 409 CONFLICT si el email existe
```

## 5. Roles y permisos — `/api/roles`, `/api/permissions`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/roles` | `roles:read` | Lista con conteo de usuarios y permisos |
| GET | `/roles/:id` | `roles:read` | Detalle con `permissions: [codes]` |
| POST | `/roles` | `roles:manage` | `{ name, description, permissions: ["clients:read", …] }` |
| PUT | `/roles/:id` | `roles:manage` | Ídem; roles del sistema: solo `description` y `permissions` |
| DELETE | `/roles/:id` | `roles:manage` | Físico; `422 BUSINESS_RULE` si es del sistema o tiene usuarios |
| GET | `/permissions` | `roles:read` | Catálogo agrupado por módulo |

## 6. Empresas — `/api/companies`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/companies` | `companies:read` | Filtros: `search` (name, legalName, taxId, email), `industry`, `city`, `country`, `employeesRange`, `includeDeleted`. `sortBy`: name, city, createdAt |
| GET | `/companies/:id` | `companies:read` | Detalle + `client` (si es cliente) + `contactsCount` + `openOpportunitiesCount` |
| POST | `/companies` | `companies:create` | Crea |
| PUT | `/companies/:id` | `companies:update` | Edita |
| DELETE | `/companies/:id` | `companies:delete` | Archiva (`422` si tiene cliente activo u oportunidades abiertas) |
| POST | `/companies/:id/restore` | `companies:delete` | Restaura |
| GET | `/companies/:id/contacts` | `contacts:read` | Contactos de la empresa (paginado) |
| GET | `/companies/:id/activities` | `activities:read` | Actividades vinculadas (scope aplicado) |
| GET | `/companies/:id/notes` | `companies:read` | Notas (fijadas primero) |
| GET | `/companies/:id/timeline` | `companies:read` | Timeline unificado |

```json
// POST /companies
{ "name": "Acme S.A.", "legalName": "Acme Sociedad Anónima", "taxId": "30-12345678-9", "industry": "Tecnología",
  "website": "https://acme.com", "email": "info@acme.com", "phone": "+54 11 4000-0000",
  "addressLine": "Av. Corrientes 1234", "city": "Buenos Aires", "state": "CABA", "country": "Argentina",
  "postalCode": "C1043", "employeesRange": "51-200", "description": "…" }
// 201 → objeto Company completo con createdBy
```

## 7. Contactos — `/api/contacts`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/contacts` | `contacts:read` | Filtros: `search` (nombre, apellido, email, teléfono), `companyId`, `jobTitle`, `includeDeleted` |
| GET | `/contacts/:id` | `contacts:read` | Detalle + `company` + `opportunitiesCount` |
| POST | `/contacts` | `contacts:create` | `{ firstName, lastName, email?, phone?, mobile?, jobTitle?, department?, companyId?, isPrimary?, linkedinUrl? }` |
| PUT | `/contacts/:id` | `contacts:update` | Edita (cambiar `companyId` quita `isPrimary`) |
| DELETE | `/contacts/:id` | `contacts:delete` | Archiva (`422` si es contacto principal de un cliente activo) |
| POST | `/contacts/:id/restore` | `contacts:delete` | Restaura |
| GET | `/contacts/:id/activities` · `/notes` · `/timeline` | `contacts:read` | Como en empresas |

## 8. Clientes — `/api/clients`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/clients` | `clients:read` (+`read_all` para ver todos) | Filtros: `search` (nombre de empresa / contacto), `status`, `ownerId`, `type`, `segment`, `from`/`to` (clientSince), `includeDeleted`. `sortBy`: displayName, status, clientSince, createdAt |
| GET | `/clients/:id` | `clients:read` | Detalle + `company` / `primaryContact` + `owner` + `stats { openOpportunities, wonValue, pendingActivities }` |
| POST | `/clients` | `clients:create` | Ver ejemplo |
| PUT | `/clients/:id` | `clients:update` (+`update_all`) | Edita `status`, `segment`, `summary`, `primaryContactId`, `clientSince` |
| PATCH | `/clients/:id/assign` | `clients:assign` | `{ ownerId }` → notifica |
| DELETE | `/clients/:id` | `clients:delete` | Archiva (`422` si tiene oportunidades abiertas) |
| POST | `/clients/:id/restore` | `clients:delete` | Restaura |
| GET | `/clients/:id/opportunities` | `opportunities:read` | Oportunidades del cliente |
| GET | `/clients/:id/activities` · `/notes` · `/timeline` | `clients:read` | — |

```json
// POST /clients (B2B)
{ "type": "COMPANY", "companyId": 10, "primaryContactId": 22, "status": "ACTIVE", "segment": "Enterprise",
  "ownerId": 3, "clientSince": "2026-09-01", "summary": "Cliente estratégico" }
// POST /clients (B2C)
{ "type": "INDIVIDUAL", "primaryContactId": 40, "ownerId": 3 }
// 201 → { id, type, displayName, company, primaryContact, status, segment, owner, clientSince, createdAt }
// 409 CONFLICT  si la empresa ya es cliente
// 400 VALIDATION_ERROR si type=COMPANY sin companyId o INDIVIDUAL sin primaryContactId
```

## 9. Leads — `/api/leads`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/leads` | `leads:read` (+`read_all`) | Filtros: `search` (nombre, email, companyName), `status`, `sourceId`, `ownerId`, `from`/`to` (createdAt), `includeDeleted` |
| GET | `/leads/:id` | `leads:read` | Detalle + `source` + `owner` + `company?` + `converted { clientId, contactId, opportunityId }` |
| POST | `/leads` | `leads:create` | Ver ejemplo |
| PUT | `/leads/:id` | `leads:update` (+`update_all`) | `422` si `CONVERTED` |
| PATCH | `/leads/:id/status` | `leads:update` | `{ status, reason? }` — valida transición; `LOST`/`UNQUALIFIED` requieren `reason`; volver a `NEW` requiere `leads:update_all` |
| PATCH | `/leads/:id/assign` | `leads:assign` | `{ ownerId }` |
| POST | `/leads/:id/convert` | `leads:convert` | Ver ejemplo |
| DELETE | `/leads/:id` | `leads:delete` | Archiva (`422` si `CONVERTED`) |
| POST | `/leads/:id/restore` | `leads:delete` | Restaura |
| GET | `/leads/:id/activities` · `/notes` · `/timeline` | `leads:read` | — |

```json
// POST /leads
{ "firstName": "Laura", "lastName": "Díaz", "email": "laura@startup.io", "phone": "+54 9 11 6000-0000",
  "companyName": "Startup.io", "jobTitle": "CTO", "sourceId": 1, "ownerId": 3, "estimatedValue": 15000,
  "description": "Interesada en plan anual" }
// 400 si no hay email ni phone

// POST /leads/:id/convert
{ "company": { "mode": "create" | "existing" | "none", "companyId": 10, "name": "Startup.io", "industry": "Software" },
  "contact":  { "jobTitle": "CTO" },                       // se crea siempre a partir de los datos del lead
  "client":   { "status": "ACTIVE", "segment": "SMB" },    // se crea o se reutiliza si la empresa ya es cliente
  "opportunity": { "create": true, "name": "Plan anual Startup.io", "amount": 15000, "currency": "USD",
                   "stageId": 1, "expectedCloseDate": "2026-12-15" } }
// 200 → { lead: {…status:"CONVERTED"}, company, contact, client, opportunity | null }
// 409 CONFLICT si ya estaba convertido · 422 BUSINESS_RULE si el estado no admite conversión
```

## 10. Oportunidades — `/api/opportunities`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/opportunities` | `opportunities:read` (+`read_all`) | Filtros: `search` (nombre, cliente), `stageId`, `status` (`open`/`won`/`lost`), `ownerId`, `clientId`, `amountMin`/`amountMax`, `closeFrom`/`closeTo`, `includeDeleted`. `sortBy`: name, amount, probability, expectedCloseDate, createdAt |
| GET | `/opportunities/kanban` | `opportunities:read` | `[{ stage, totalAmount, count, items: [tarjetas] }]` por etapa activa; filtros `ownerId`, `search` |
| GET | `/opportunities/:id` | `opportunities:read` | Detalle + `client` + `company` (derivada) + `contact` + `stage` + `owner` + `status` |
| POST | `/opportunities` | `opportunities:create` | Ver ejemplo |
| PUT | `/opportunities/:id` | `opportunities:update` (+`update_all`) | `422` si está cerrada |
| PATCH | `/opportunities/:id/stage` | `opportunities:update` | `{ stageId, lostReason?, note? }` — historial; cierre; `lostReason` obligatorio si perdida |
| PATCH | `/opportunities/:id/assign` | `opportunities:assign` | `{ ownerId }` |
| POST | `/opportunities/:id/reopen` | `opportunities:reopen` | `{ stageId, note? }` → reabre en la etapa indicada |
| DELETE | `/opportunities/:id` | `opportunities:delete` | Archiva (`422` si ganada) |
| POST | `/opportunities/:id/restore` | `opportunities:delete` | Restaura |
| GET | `/opportunities/:id/history` | `opportunities:read` | Historial de etapas |
| GET | `/opportunities/:id/activities` · `/notes` · `/timeline` | `opportunities:read` | — |

```json
// POST /opportunities
{ "name": "Licencias 2027", "clientId": 5, "contactId": 22, "stageId": 1, "ownerId": 3,
  "amount": 42000, "currency": "USD", "probability": 10, "expectedCloseDate": "2027-01-31", "description": "…" }
// 201 → objeto + status:"OPEN"
// 422 BUSINESS_RULE rule:"CONTACT_NOT_IN_CLIENT"

// PATCH /opportunities/:id/stage → perdida
{ "stageId": 6, "lostReason": "Eligieron a un competidor por precio" }
// 200 → oportunidad actualizada (probability 0, actualCloseDate hoy, status "LOST")
```

## 11. Actividades — `/api/activities`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/activities` | `activities:read` (+`read_all`) | Filtros: `type`, `status`, `priority`, `ownerId`, `overdue=true`, `dueFrom`/`dueTo`, `today=true`, `week=true`, `companyId`, `contactId`, `clientId`, `leadId`, `opportunityId`, `search` (subject). `sortBy`: dueDate, scheduledAt, createdAt, priority |
| GET | `/activities/:id` | `activities:read` | Detalle con entidades vinculadas resumidas |
| POST | `/activities` | `activities:create` | Ver ejemplo |
| PUT | `/activities/:id` | `activities:update` (+`update_all`) | Edita |
| PATCH | `/activities/:id/complete` | `activities:update` | `{ outcome?, durationMinutes? }` → COMPLETED |
| PATCH | `/activities/:id/status` | `activities:update` | `{ status }` (PENDING, IN_PROGRESS, CANCELLED) |
| DELETE | `/activities/:id` | `activities:delete` (+`delete_all`) | Borrado físico |

```json
// POST /activities
{ "type": "MEETING", "subject": "Demo del producto", "description": "…", "priority": "HIGH",
  "scheduledAt": "2026-09-25T14:00:00.000Z", "dueDate": "2026-09-25T15:00:00.000Z", "durationMinutes": 60,
  "ownerId": 3, "clientId": 5, "contactId": 22, "opportunityId": 8 }
// 400 si type TASK/FOLLOW_UP sin dueDate · 422 si las entidades vinculadas no son coherentes (p. ej. contacto de otra empresa)
```

## 12. Notas — `/api/notes`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/notes` | `notes:create` | `{ content, companyId? \| contactId? \| clientId? \| leadId? \| opportunityId?, isPinned? }` — exactamente un padre |
| PUT | `/notes/:id` | `notes:update` (propias) / `notes:manage` | `{ content, isPinned }` |
| DELETE | `/notes/:id` | `notes:delete` (propias) / `notes:manage` | Físico |

Los listados de notas se obtienen desde la entidad padre (`GET /clients/:id/notes`, etc.).

## 13. Timeline (por entidad)

`GET /<recurso>/:id/timeline?page&pageSize&types=activity,note,audit`

```json
{ "success": true, "data": [
    { "kind": "activity", "at": "2026-09-20T10:00:00Z", "actor": {…}, "payload": { "id": 9, "type": "CALL", "subject": "…", "status": "COMPLETED" } },
    { "kind": "note",     "at": "2026-09-19T16:20:00Z", "actor": {…}, "payload": { "id": 4, "content": "…" } },
    { "kind": "audit",    "at": "2026-09-18T09:00:00Z", "actor": {…}, "payload": { "action": "STAGE_CHANGE", "changes": { "before": {"stageId":1}, "after": {"stageId":2} } } }
  ], "meta": {…} }
```

## 14. Dashboard — `/api/dashboard`

Todos aceptan `?from&to` (por defecto últimos 30 días) y, para `dashboard:view_all`, `?ownerId`.

| Método | Ruta | Permiso | Respuesta |
|---|---|---|---|
| GET | `/dashboard/summary` | `dashboard:view` | `{ clients: { total }, leads: { new, byStatus }, opportunities: { open, won, lost, pipelineValue, weightedValue, wonValue }, activities: { pending, overdue, completedInPeriod } }` |
| GET | `/dashboard/pipeline` | `dashboard:view` | `[{ stage, count, amount }]` |
| GET | `/dashboard/leads-trend` | `dashboard:view` | `[{ date, created, converted }]` por día o semana |
| GET | `/dashboard/won-lost` | `dashboard:view` | `[{ month, won, lost, wonAmount }]` |
| GET | `/dashboard/recent-activities` | `dashboard:view` | Últimas 10 |
| GET | `/dashboard/upcoming-activities` | `dashboard:view` | Próximas 10 pendientes (vencidas primero) |
| GET | `/dashboard/performance` | `dashboard:view_all` | `[{ user, wonCount, wonAmount, openCount, openAmount, conversionRate, activitiesCompleted }]` |

Las agregaciones se resuelven en SQL Server (`groupBy`/`aggregate` de Prisma o `$queryRaw` parametrizado), nunca en memoria.

## 15. Reportes — `/api/reports`

Todos aceptan `?from&to&ownerId&format=json|csv`. Con `csv` responde `text/csv; charset=utf-8` con BOM y `Content-Disposition: attachment; filename="<reporte>_<fecha>.csv"` (permiso `reports:export`).

| Método | Ruta | Permiso | Contenido |
|---|---|---|---|
| GET | `/reports/pipeline` | `reports:view` | Por etapa: cantidad, valor, valor ponderado |
| GET | `/reports/sales-by-user` | `reports:view` (+`view_all`) | Por vendedor: ganadas, perdidas, valor ganado, tasa de cierre |
| GET | `/reports/leads-conversion` | `reports:view` | Por fuente y por estado: cantidad, convertidos, tasa |
| GET | `/reports/forecast` | `reports:view` | Por mes (6 meses): valor, ponderado, cantidad |
| GET | `/reports/activities` | `reports:view` | Por usuario y tipo: creadas, completadas, vencidas |

## 16. Búsqueda global — `/api/search`

`GET /search?q=acme` → `{ companies: [...5], contacts: [...5], clients: [...5], leads: [...5], opportunities: [...5] }`.
Mínimo 2 caracteres. Respeta scope y permisos de lectura por módulo (los módulos sin permiso no aparecen).

## 17. Notificaciones — `/api/notifications`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/notifications` | Propias, paginadas; filtro `unread=true` |
| GET | `/notifications/unread-count` | `{ count }` |
| PATCH | `/notifications/:id/read` | Marca leída |
| POST | `/notifications/read-all` | Marca todas |

## 18. Configuración — `/api/settings`, `/api/pipeline-stages`, `/api/lead-sources`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/settings` | `settings:read` | `{ company_name, default_currency, timezone, date_format }` |
| PUT | `/settings` | `settings:manage` | Actualiza claves conocidas (Zod) |
| GET | `/pipeline-stages` | — | Etapas (`?includeInactive=true`) ordenadas |
| POST | `/pipeline-stages` | `settings:manage` | `{ name, sortOrder, defaultProbability, color, isWon?, isLost? }` |
| PUT | `/pipeline-stages/:id` | `settings:manage` | Edita; valida una sola ganada/perdida activas |
| PATCH | `/pipeline-stages/reorder` | `settings:manage` | `{ ids: [3,1,2,…] }` |
| DELETE | `/pipeline-stages/:id` | `settings:manage` | Físico si no tiene oportunidades ni historial; si no, `422` (usar `isActive=false`) |
| GET | `/lead-sources` | — | Fuentes (`?includeInactive=true`) |
| POST / PUT / DELETE | `/lead-sources[/:id]` | `settings:manage` | Ídem, `422` si tiene leads |

## 19. Auditoría — `/api/audit-logs`

`GET /audit-logs?entityType&entityId&userId&action&from&to&page&pageSize` — permiso `audit:read`.

## 20. Resumen de códigos por situación

| Situación | HTTP / code |
|---|---|
| Sin token / expirado | 401 `UNAUTHORIZED` |
| `mustChangePassword` | 403 `PASSWORD_CHANGE_REQUIRED` |
| Sin permiso | 403 `FORBIDDEN` |
| Fuera de alcance o inexistente | 404 `NOT_FOUND` |
| Email/taxId duplicado, empresa ya cliente, lead ya convertido | 409 `CONFLICT` |
| Transición inválida, último admin, archivar con dependencias, contacto ajeno | 422 `BUSINESS_RULE` (`details.rule`) |
| Datos inválidos | 400 `VALIDATION_ERROR` (`details[]`) |
| Cuenta bloqueada | 423 `ACCOUNT_LOCKED` |
| Demasiadas peticiones | 429 `RATE_LIMITED` |

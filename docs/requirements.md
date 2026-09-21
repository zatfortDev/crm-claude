# Requisitos del sistema — CRM

> Versión 1.0 · Fecha: 2026-09-21 · Estado: aprobado para implementación

Este documento describe **qué** debe hacer el sistema. El **cómo** se detalla en
[architecture.md](architecture.md), [database.md](database.md), [api.md](api.md),
[security.md](security.md), [testing.md](testing.md) y [deployment.md](deployment.md).

---

## 1. Objetivo

Construir un CRM profesional, single-tenant, para que una empresa administre su
proceso comercial de punta a punta: directorio de empresas y contactos, cartera de
clientes, captación de leads, pipeline de oportunidades, actividades y seguimiento,
con un dashboard y reportes basados en datos reales y un sistema de roles y permisos
extensible.

## 2. Alcance

### 2.1 Incluido en la versión 1

| Módulo | Descripción breve |
|---|---|
| Autenticación | Login, logout, refresh de sesión, cambio de contraseña, bloqueo por intentos fallidos |
| Usuarios | Alta, edición, activación/desactivación, asignación de rol, reseteo de contraseña (solo Admin) |
| Roles y permisos | Roles del sistema (Admin, Manager, Vendedor) + roles personalizados con permisos granulares |
| Empresas | Directorio de organizaciones con búsqueda, filtros, detalle, contactos, actividades, notas e historial |
| Contactos | Personas, opcionalmente asociadas a una empresa |
| Clientes | Relación comercial (cuenta) con responsable y estado; puede ser empresa o persona |
| Leads | Prospectos con estado, fuente, responsable y conversión a cliente/contacto/oportunidad |
| Oportunidades | Negocios con valor, etapa, probabilidad y fecha estimada de cierre; vista tabla y Kanban |
| Actividades | Llamadas, emails, reuniones, tareas y seguimientos vinculados a cualquier entidad |
| Notas | Texto libre adjunto a empresas, contactos, clientes, leads u oportunidades |
| Historial | Timeline unificado por entidad (actividades + notas + cambios auditados) |
| Dashboard | KPIs y gráficos con datos reales de SQL Server |
| Reportes | 5 reportes con filtros y exportación CSV |
| Búsqueda y filtros | Búsqueda global y filtros por listado |
| Notificaciones | In-app (campana), por eventos del sistema |
| Configuración | Datos generales, etapas del pipeline, fuentes de leads |
| Auditoría | Registro de operaciones críticas consultable por Admin |

### 2.2 Fuera de alcance de la versión 1 (documentado para futuras versiones)

- Registro público de usuarios y recuperación de contraseña por email.
- Notificaciones por email o en tiempo real (WebSockets).
- Importación masiva de datos (solo exportación CSV).
- Adjuntos/archivos, productos, cotizaciones, facturación.
- Integración con proveedores de email/calendario.
- Multi-tenant (varias empresas usuarias en la misma instancia).
- Conversión de moneda (se almacena el código ISO pero no se convierte).
- Equipos jerárquicos (el campo `User.managerId` queda reservado).

## 3. Actores y roles

| Rol | Descripción | Alcance de datos |
|---|---|---|
| **Admin** | Administra usuarios, roles, configuración y auditoría. Tiene todos los permisos. | Global |
| **Manager** | Supervisa clientes, leads, oportunidades, actividades y vendedores. Puede asignar responsables, convertir leads, reabrir oportunidades y exportar reportes. | Global |
| **Vendedor** | Gestiona sus propios clientes, leads, oportunidades y actividades. Puede crear y editar empresas y contactos (directorio compartido). | Propio (`ownerId = usuario`) |

Los tres roles son "del sistema" (no se pueden borrar). El Admin puede crear roles
adicionales combinando permisos. El catálogo de permisos está en
[security.md § 4](security.md#4-autorización-rbac).

## 4. Requisitos funcionales

Notación: **RF-XX-NN**. Cada requisito tiene criterios de aceptación verificables por tests.

### 4.1 Autenticación (RF-AU)

| ID | Requisito | Criterios de aceptación |
|---|---|---|
| RF-AU-01 | Login con email y contraseña | Devuelve access token (15 min) y cookie httpOnly con refresh token (7 días). Credenciales inválidas → 401 con mensaje genérico. |
| RF-AU-02 | Refresh de sesión | Con cookie válida emite nuevo access token y rota el refresh token. Reuso de un token rotado revoca toda la cadena. |
| RF-AU-03 | Logout | Revoca el refresh token y limpia la cookie. |
| RF-AU-04 | Bloqueo por intentos fallidos | 5 fallos → bloqueo 15 min. Login durante el bloqueo → 423 sin revelar detalles. |
| RF-AU-05 | Cambio de contraseña | Requiere contraseña actual. Nueva contraseña cumple la política (≥ 10 caracteres, mayúscula, minúscula, número). Revoca los demás refresh tokens del usuario. |
| RF-AU-06 | Cambio obligatorio en primer login | Usuario con `mustChangePassword = true` solo puede acceder a `/auth/me` y `/auth/change-password` hasta cambiarla. |
| RF-AU-07 | Usuario inactivo | No puede iniciar sesión ni refrescar; sus refresh tokens se revocan al desactivarlo. |
| RF-AU-08 | Sin registro público | No existe endpoint de registro abierto. |

### 4.2 Usuarios y roles (RF-US)

| ID | Requisito | Criterios de aceptación |
|---|---|---|
| RF-US-01 | Admin crea usuarios | Email único, rol obligatorio, contraseña temporal; `mustChangePassword = true`. |
| RF-US-02 | Admin edita datos y rol | Un usuario no puede cambiar su propio rol. |
| RF-US-03 | Activar / desactivar | No se puede desactivar ni degradar al último Admin activo. Los usuarios nunca se borran físicamente. |
| RF-US-04 | Reseteo de contraseña por Admin | Genera contraseña temporal y fuerza cambio. |
| RF-US-05 | Gestión de roles | Crear/editar/borrar roles personalizados con permisos. Roles del sistema: no borrables ni renombrables. No se borra un rol con usuarios asignados. |
| RF-US-06 | Listado con búsqueda y filtros | Por nombre/email, rol y estado. Paginado. |
| RF-US-07 | Perfil propio | Cualquier usuario ve y edita su nombre y teléfono. |

### 4.3 Empresas (RF-CO)

| ID | Requisito | Criterios de aceptación |
|---|---|---|
| RF-CO-01 | Crear empresa | Nombre obligatorio. `taxId` único si se informa (ignorando archivadas). |
| RF-CO-02 | Editar empresa | Cualquier usuario con `companies:update`. |
| RF-CO-03 | Buscar y filtrar | Búsqueda por nombre/razón social/`taxId`/email; filtros por industria, ciudad, país, tamaño. Paginado y ordenable. |
| RF-CO-04 | Ver detalle | Datos, contactos, cliente asociado (si existe), oportunidades vía cliente, actividades, notas, timeline. |
| RF-CO-05 | Archivar / restaurar | Soft delete. No se archiva si tiene cliente activo u oportunidades abiertas. Solo Manager/Admin. |
| RF-CO-06 | Contactos asociados | Listar y crear contactos desde la empresa; marcar contacto principal. |

### 4.4 Contactos (RF-CT)

| ID | Requisito | Criterios de aceptación |
|---|---|---|
| RF-CT-01 | Crear contacto | Nombre y apellido obligatorios; email único si se informa; empresa opcional. |
| RF-CT-02 | Editar y reasignar empresa | Cambiar `companyId` es válido; si el contacto era principal de la empresa anterior, deja de serlo. |
| RF-CT-03 | Buscar y filtrar | Por nombre, email, teléfono, empresa, cargo. |
| RF-CT-04 | Detalle | Datos, empresa, oportunidades donde participa, actividades, notas, timeline. |
| RF-CT-05 | Archivar / restaurar | Soft delete. No se archiva si es contacto principal de un cliente activo. |

### 4.5 Clientes (RF-CL)

| ID | Requisito | Criterios de aceptación |
|---|---|---|
| RF-CL-01 | Crear cliente | Tipo `COMPANY` (requiere `companyId`, una empresa es cliente a lo sumo una vez) o `INDIVIDUAL` (requiere `primaryContactId`). Responsable por defecto: el creador. |
| RF-CL-02 | Editar cliente | Estado ∈ {ACTIVE, INACTIVE, CHURNED}; segmento libre. |
| RF-CL-03 | Asignar responsable | Requiere `clients:assign`. Notifica al nuevo responsable. |
| RF-CL-04 | Buscar y filtrar | Por nombre de empresa/contacto; filtros por estado, responsable, segmento, fecha de alta. |
| RF-CL-05 | Detalle | Datos, empresa/contacto, oportunidades (abiertas y cerradas, valor total), actividades, notas, timeline. |
| RF-CL-06 | Alcance | Vendedor solo ve/edita clientes con `ownerId` propio. |
| RF-CL-07 | Archivar / restaurar | No se archiva con oportunidades abiertas. |

### 4.6 Leads (RF-LE)

| ID | Requisito | Criterios de aceptación |
|---|---|---|
| RF-LE-01 | Crear lead | Nombre y apellido obligatorios; email o teléfono al menos uno; fuente opcional; estado inicial `NEW`. |
| RF-LE-02 | Editar lead | No editable si `CONVERTED`. |
| RF-LE-03 | Cambiar estado | Transiciones válidas (ver § 6.2). `LOST` y `UNQUALIFIED` requieren motivo. |
| RF-LE-04 | Asignar responsable | Requiere `leads:assign`. Notifica. |
| RF-LE-05 | Convertir | Crea/vincula empresa, crea contacto, crea o reutiliza cliente, opcionalmente crea oportunidad; todo en una transacción. Lead pasa a `CONVERTED` con punteros. Doble conversión → 409. |
| RF-LE-06 | Buscar y filtrar | Por nombre/email/empresa; filtros por estado, fuente, responsable, rango de fechas. |
| RF-LE-07 | Alcance | Vendedor solo ve/edita/convierte leads propios. |

### 4.7 Oportunidades (RF-OP)

| ID | Requisito | Criterios de aceptación |
|---|---|---|
| RF-OP-01 | Crear oportunidad | Nombre, cliente y etapa obligatorios; responsable por defecto el creador; probabilidad inicial = la de la etapa; monto ≥ 0; moneda por defecto de configuración. |
| RF-OP-02 | Contacto asociado | Debe pertenecer a la empresa del cliente o ser su contacto principal. |
| RF-OP-03 | Cambiar etapa | Registra historial (`fromStage`, `toStage`, usuario, fecha). Etapa ganada → probabilidad 100 y `actualCloseDate`; perdida → probabilidad 0, `actualCloseDate` y `lostReason` obligatorio. |
| RF-OP-04 | Reabrir | Solo con `opportunities:reopen` (Manager/Admin). Limpia `actualCloseDate`, registra historial. |
| RF-OP-05 | Kanban | Columnas por etapa activa ordenadas por `sortOrder`; tarjetas con nombre, cliente, monto, responsable, fecha estimada; drag & drop cambia etapa con confirmación al cerrar. Totales por columna. |
| RF-OP-06 | Buscar y filtrar | Por nombre/cliente; filtros por etapa, responsable, rango de montos, rango de cierre estimado, estado (abierta/ganada/perdida). |
| RF-OP-07 | Alcance | Vendedor solo ve/edita oportunidades propias. |
| RF-OP-08 | Archivar | No se archivan oportunidades ganadas (integridad de reportes); las demás sí. |

### 4.8 Actividades (RF-AC)

| ID | Requisito | Criterios de aceptación |
|---|---|---|
| RF-AC-01 | Registrar actividad | Tipo ∈ {CALL, EMAIL, MEETING, TASK, FOLLOW_UP}; asunto obligatorio; responsable por defecto el creador; puede vincular empresa, contacto, cliente, lead y/u oportunidad simultáneamente. |
| RF-AC-02 | Fechas | `scheduledAt` (cuándo ocurre) y `dueDate` (vencimiento). Para TASK y FOLLOW_UP `dueDate` es obligatorio. |
| RF-AC-03 | Completar | Marca `COMPLETED` y `completedAt`; permite registrar `outcome`. |
| RF-AC-04 | Vencidas | `dueDate < ahora` y estado PENDING/IN_PROGRESS. Se resaltan en UI y generan notificación diaria. |
| RF-AC-05 | Listado "Mis actividades" | Filtros: estado, tipo, vencidas, hoy, esta semana, entidad vinculada. |
| RF-AC-06 | Alcance | Vendedor ve las que es responsable o creador. |

### 4.9 Notas e historial (RF-NO)

| ID | Requisito | Criterios de aceptación |
|---|---|---|
| RF-NO-01 | Crear nota | Contenido obligatorio; exactamente una entidad padre. |
| RF-NO-02 | Editar / borrar | El autor sus propias notas; `notes:manage` cualquiera. |
| RF-NO-03 | Fijar nota | `isPinned` la muestra primero. |
| RF-NO-04 | Timeline | Endpoint por entidad que combina actividades, notas y entradas de auditoría, ordenado por fecha descendente, paginado. |

### 4.10 Dashboard (RF-DA)

| ID | Métrica | Definición |
|---|---|---|
| RF-DA-01 | Total de clientes | `Client` activos no archivados |
| RF-DA-02 | Nuevos leads | Leads creados en el período (por defecto 30 días) |
| RF-DA-03 | Oportunidades abiertas | Etapa con `isWon = 0` y `isLost = 0` |
| RF-DA-04 | Oportunidades ganadas / perdidas | En el período, por `actualCloseDate` |
| RF-DA-05 | Valor total del pipeline | Suma de `amount` de abiertas; y ponderado `amount × probability / 100` |
| RF-DA-06 | Actividades pendientes | PENDING/IN_PROGRESS del usuario (o globales para Manager/Admin), con vencidas destacadas |
| RF-DA-07 | Actividades recientes | Últimas 10 completadas o creadas |
| RF-DA-08 | Rendimiento comercial | Por vendedor: oportunidades ganadas, valor ganado, tasa de conversión, actividades completadas |
| RF-DA-09 | Gráficos | Pipeline por etapa (barras), evolución de leads (línea), ganadas vs perdidas (barras) |
| RF-DA-10 | Alcance | Vendedor: sus datos. Manager/Admin: globales con filtro por vendedor |

### 4.11 Reportes (RF-RE)

| ID | Reporte | Dimensiones y filtros |
|---|---|---|
| RF-RE-01 | Pipeline por etapa | Cantidad y valor por etapa; filtro por responsable y rango de cierre estimado |
| RF-RE-02 | Ventas por vendedor | Ganadas, perdidas, valor ganado, tasa; filtro por período |
| RF-RE-03 | Conversión de leads | Por fuente y por estado; tasa de conversión; filtro por período y responsable |
| RF-RE-04 | Forecast mensual | Suma de `amount × probability` agrupada por mes de `expectedCloseDate`, próximos 6 meses |
| RF-RE-05 | Resumen de actividades | Por usuario y tipo: creadas, completadas, vencidas; filtro por período |
| RF-RE-06 | Exportación | Todos con `?format=csv` (permiso `reports:export`) |

### 4.12 Búsqueda global (RF-SE)

| ID | Requisito | Criterios |
|---|---|---|
| RF-SE-01 | Buscar en empresas, contactos, clientes, leads y oportunidades | Mínimo 2 caracteres; máximo 5 resultados por tipo; respeta el alcance del usuario; insensible a mayúsculas y acentos. |

### 4.13 Notificaciones (RF-NT)

| ID | Evento | Destinatario |
|---|---|---|
| RF-NT-01 | Registro asignado (cliente, lead, oportunidad, actividad) | Nuevo responsable |
| RF-NT-02 | Actividad vence hoy / vencida | Responsable (resumen diario generado al primer acceso del día) |
| RF-NT-03 | Lead convertido | Responsable del lead (si no es quien convirtió) |
| RF-NT-04 | Oportunidad ganada / perdida | Responsable (si no es quien cerró) y Managers |
| RF-NT-05 | Consultar, marcar leída, marcar todas | Solo las propias. Contador de no leídas. |

### 4.14 Configuración (RF-CF)

| ID | Requisito |
|---|---|
| RF-CF-01 | Datos generales: nombre de la empresa, moneda por defecto, zona horaria, formato de fecha |
| RF-CF-02 | Etapas del pipeline: crear, editar, ordenar, activar/desactivar, probabilidad por defecto, color. Exactamente una etapa ganada y una perdida activas. No se borra una etapa con oportunidades. |
| RF-CF-03 | Fuentes de leads: crear, editar, activar/desactivar. No se borra una fuente con leads. |
| RF-CF-04 | Auditoría: Admin consulta el log filtrando por entidad, usuario, acción y fecha. |

## 5. Requisitos no funcionales

| Categoría | Requisito |
|---|---|
| Seguridad | Ver [security.md](security.md). Contraseñas con bcrypt, JWT de corta vida, refresh token rotativo en cookie httpOnly, RBAC, validación server-side, rate limiting, cabeceras de seguridad, sin secretos en código. |
| Rendimiento | Listados paginados (máx. 100 por página); consultas del dashboard resueltas con agregaciones en SQL Server (no en memoria); índices para las consultas frecuentes; respuesta < 500 ms para listados con 100k registros en hardware modesto. |
| Disponibilidad | Endpoint `/health`; arranque falla rápido si falta configuración; apagado ordenado (graceful shutdown). |
| Mantenibilidad | Separación en capas; validación con esquemas; componentes UI reutilizables; docs actualizadas por fase; ESLint + Prettier. |
| Observabilidad | Logs JSON estructurados con `requestId`; sin datos sensibles. |
| Compatibilidad | Node ≥ 22, SQL Server ≥ 2019 (probado en 2022 Express), navegadores evergreen. |
| Internacionalización | UI en español; fechas en UTC en base y formateadas según configuración; identificadores en inglés. |
| Accesibilidad | Navegación por teclado en formularios y Kanban; contraste AA; estados de carga/vacío/error explícitos. |
| Responsive | Usable desde 360 px (sidebar colapsable; tablas con scroll horizontal; Kanban con scroll horizontal). |

## 6. Reglas de negocio

### 6.1 Propiedad y alcance

- `ownerId` existe en Client, Lead, Opportunity y Activity. Company y Contact son directorio compartido (sin dueño).
- Un usuario sin `X:read_all` solo consulta registros donde `ownerId = su id` (en Activity: `ownerId` o `createdById`).
- Un usuario sin `X:update_all` solo modifica registros propios.
- Asignar responsable requiere `X:assign`; el Vendedor no puede reasignar.

### 6.2 Estados de lead

```
NEW ──▶ CONTACTED ──▶ QUALIFIED ──▶ CONVERTED (terminal)
 │           │             │
 └───────────┴─────────────┴──▶ UNQUALIFIED | LOST  (requieren motivo; reversibles a NEW por Manager/Admin)
```

La conversión se permite desde NEW, CONTACTED o QUALIFIED.

### 6.3 Pipeline de oportunidades

- Etapas iniciales (seed): Prospecto (10 %), Contactado (25 %), Propuesta (50 %), Negociación (75 %), Ganada (100 %, `isWon`), Perdida (0 %, `isLost`).
- Estado derivado: `OPEN` si la etapa no es ganada ni perdida; `WON`; `LOST`.
- Una oportunidad cerrada no se edita salvo reapertura.

### 6.4 Actividades

- Vencida: `dueDate < now()` y estado en {PENDING, IN_PROGRESS}.
- Completar fija `completedAt = now()`; cancelar no.

### 6.5 Integridad

- Usuarios: nunca se borran; se desactivan. Último Admin protegido.
- Soft delete en Company, Contact, Client, Lead, Opportunity con reglas de bloqueo (ver tabla en [database.md § 6](database.md#6-reglas-de-integridad)).
- Conversión y cierre de oportunidades son transaccionales.

## 7. Decisiones de diseño registradas

| ID | Decisión | Alternativas descartadas | Fecha |
|---|---|---|---|
| D-01 | `Client` es una relación comercial vinculada 1:1 a `Company` o a un `Contact` principal; la oportunidad referencia al cliente y deriva la empresa | Company con flag `isClient`; Client independiente con datos duplicados | 2026-09-21 |
| D-02 | Una sola entidad `Activity` con `type = TASK` para tareas | Tabla `Task` separada | 2026-09-21 |
| D-03 | Sin registro público; el Admin crea usuarios | Registro abierto; registro con aprobación | 2026-09-21 |
| D-04 | Notificaciones in-app con polling | Email; WebSockets | 2026-09-21 |
| D-05 | Soft delete en entidades principales; usuarios se desactivan | Hard delete | 2026-09-21 |
| D-06 | Manager con alcance global; `User.managerId` reservado | Alcance por equipo | 2026-09-21 |
| D-07 | 5 reportes iniciales con export CSV | 3 básicos; definir después | 2026-09-21 |
| D-08 | UI, docs y comentarios en español; identificadores, tablas y endpoints en inglés | Todo en español; todo en inglés | 2026-09-21 |
| D-09 | Stack: ESM, Zod, pino, Vitest, TanStack Query, react-hook-form, Tailwind + componentes propios, @hello-pangea/dnd, Recharts, Axios, npm workspaces | Jest; MUI/Ant | 2026-09-21 |
| D-10 | `PipelineStage` y `LeadSource` configurables en tablas; estados de lead y tipos de actividad como constantes | Todo hardcodeado; todo configurable | 2026-09-21 |
| D-11 | Access token JWT en memoria (15 min) + refresh token opaco rotativo en cookie httpOnly (7 días) | JWT único de larga vida en localStorage | 2026-09-21 |
| D-12 | PK `INT IDENTITY`; `NVARCHAR`; `DATETIME2` en UTC; collation de base `Modern_Spanish_100_CI_AI` | GUID como PK; collation del servidor (`Modern_Spanish_CI_AS`) | 2026-09-21 |
| D-13 | Desarrollo local con autenticación integrada de Windows contra `SQLEXPRESS` por TCP 1433 | Login SQL en modo mixto | 2026-09-21 |

## 8. Glosario

| Término | Significado |
|---|---|
| Empresa (Company) | Organización del directorio, cliente o no |
| Contacto (Contact) | Persona, con o sin empresa |
| Cliente (Client) | Relación comercial activa con una empresa o persona |
| Lead | Prospecto aún no convertido |
| Oportunidad (Opportunity) | Negocio potencial con valor y etapa |
| Pipeline | Conjunto ordenado de etapas por las que pasa una oportunidad |
| Responsable (owner) | Usuario a cargo de un registro |
| Timeline / Historial | Vista cronológica de actividades, notas y cambios de una entidad |
| Soft delete / archivar | Marcar `deletedAt` sin borrar físicamente |

# Base de datos — SQL Server + Prisma

> Versión 1.0 · 2026-09-21 · Motor objetivo: SQL Server 2019+ (desarrollo: 2022 Express)

## 1. Convenciones

| Aspecto | Convención | Motivo |
|---|---|---|
| Nombres de tablas | `PascalCase` singular (`Client`, `PipelineStage`) | Coincide con los modelos Prisma |
| Nombres de columnas | `camelCase` (`ownerId`, `createdAt`) | Coincide con el código JS sin `@map` |
| Claves primarias | `id INT IDENTITY(1,1)` (clustered) | Compacto, secuencial, sin fragmentación |
| Claves foráneas | `<entidad>Id`; siempre indexadas | Joins y filtros frecuentes |
| Texto | `NVARCHAR(n)` / `NVARCHAR(MAX)` | Unicode (acentos, ñ) |
| Fechas/hora | `DATETIME2(3)` en **UTC** | Precisión, sin ambigüedad de zona |
| Fechas puras | `DATE` | `expectedCloseDate`, `clientSince` |
| Dinero | `DECIMAL(18,2)` | Sin errores de coma flotante |
| Booleanos | `BIT` | — |
| Auditoría de fila | `createdAt DEFAULT SYSUTCDATETIME()`, `updatedAt` (Prisma `@updatedAt`) | — |
| Borrado lógico | `deletedAt DATETIME2 NULL` | Preserva historial |
| Índices | `IX_<Tabla>_<cols>`, únicos `UX_…`, filtrados `FX_…` | Legibilidad en SSMS |
| Restricciones | `CK_<Tabla>_<regla>`, `FK_<Tabla>_<Referencia>` | — |
| Collation de base | `Modern_Spanish_100_CI_AI` | Búsquedas insensibles a mayúsculas **y acentos**, orden español |

### 1.1 Consideraciones específicas de Prisma + SQL Server

| Tema | Detalle | Decisión |
|---|---|---|
| Enums | El conector SQL Server de Prisma no soporta `enum` nativos | Columnas `NVARCHAR` + `CHECK` en la migración + constantes en `server/src/models` + validación Zod |
| `mode: 'insensitive'` | No disponible en SQL Server | La collation `CI_AI` de la base resuelve la insensibilidad |
| Índices únicos con NULL | SQL Server permite un único NULL en índice único | **Índices únicos filtrados** (`WHERE col IS NOT NULL AND deletedAt IS NULL`), añadidos editando el SQL de la migración |
| Rutas de cascada múltiples | SQL Server rechaza FKs que generen más de una ruta `CASCADE`/`SET NULL` hacia una tabla | Todas las FKs a `User` y entre entidades de negocio usan `ON DELETE NO ACTION ON UPDATE NO ACTION` explícito; solo dependientes puros usan `CASCADE` |
| `Restrict` | No existe en SQL Server | Se usa `NoAction` |
| Shadow database | `prisma migrate dev` crea una base temporal | El login de desarrollo `crm_dev` pertenece al rol de servidor `dbcreator` |
| Nombre de instancia | Prisma se conecta por TCP | `SQLEXPRESS` con TCP/IP habilitado y puerto fijo 1433 |
| Driver adapter (Prisma 7) | El cliente exige `@prisma/adapter-mssql`, que usa el paquete `mssql` (tedious) y **no soporta autenticación integrada de Windows** del usuario actual | Login SQL dedicado en modo mixto (`crm_dev` en desarrollo, `crm_app` en producción). `DATABASE_URL` sigue siendo la única fuente de verdad: `src/lib/prisma.js` la traduce a la configuración del adapter |
| Generador (Prisma 7) | `prisma-client-js` está deprecado; el generador `prisma-client` emite TypeScript | Se usa `prisma-client` con salida en `src/generated/prisma` (ignorada por Git) y se importa desde JavaScript con el *type stripping* nativo de Node ≥ 22.18 |
| `.env` | La CLI de Prisma 7 no carga `.env` automáticamente | `prisma.config.mjs` importa `dotenv/config` |
| `@db.DateTime2(p)` | Prisma no acepta precisión en `DateTime2` | Se usa `DATETIME2` con la precisión por defecto (7) |
| `@db.NVarChar(n)` | Prisma por defecto usa `NVARCHAR(1000)` para `String` | Se declara la longitud explícita en cada campo |
| Migraciones con SQL manual | CHECK, índices filtrados y collation no se expresan en `schema.prisma` | Se editan los archivos `migration.sql` antes de aplicar; Prisma no los revierte porque no introspecta esos objetos |

## 2. Diagrama entidad-relación (lógico)

```
 Role 1──N User N──M Permission (RolePermission)
             │
             ├──1:N RefreshToken
             ├──1:N Notification
             ├──0..1:N AuditLog (actor)
             │
   ┌─────────┴──────────── owner / createdBy ───────────────────────────────┐
   │                                                                        │
 Company 0..1──N Contact                                                    │
   │0..1              │0..1                                                 │
   │                  │                                                     │
   └──── Client ──────┘   (Client.companyId UNIQUE  |  Client.primaryContactId)
           │1
           │
           N
       Opportunity N──1 PipelineStage
           │1                 ▲
           N                  │ from/to
    OpportunityStageHistory ──┘

 LeadSource 0..1──N Lead ──converted──▶ Client / Contact / Opportunity / Company

 Activity ──0..1──▶ Company | Contact | Client | Lead | Opportunity   (varias a la vez)
 Note     ──1────▶ Company | Contact | Client | Lead | Opportunity   (exactamente una)
 Setting (clave-valor)
```

## 3. Tablas

Leyenda: `NN` NOT NULL · `UX` único · `IX` índice · `FX` índice filtrado · `CK` check · `FK` foránea (`NA` = NO ACTION, `CAS` = CASCADE).

### 3.1 Seguridad y usuarios

#### Role

| Columna | Tipo | Restricciones |
|---|---|---|
| id | INT IDENTITY | PK |
| name | NVARCHAR(50) | NN, `UX_Role_name` |
| description | NVARCHAR(255) | |
| isSystem | BIT | NN, default 0 — Admin/Manager/Vendedor: no borrables ni renombrables |
| createdAt, updatedAt | DATETIME2(3) | NN |

#### Permission

| Columna | Tipo | Restricciones |
|---|---|---|
| id | INT IDENTITY | PK |
| code | NVARCHAR(100) | NN, `UX_Permission_code` (ej. `clients:read_all`) |
| module | NVARCHAR(50) | NN, `IX_Permission_module` |
| description | NVARCHAR(255) | |

#### RolePermission (N:M)

| Columna | Tipo | Restricciones |
|---|---|---|
| roleId | INT | NN, FK → Role (CAS) |
| permissionId | INT | NN, FK → Permission (CAS) |
| | | PK (roleId, permissionId); `IX_RolePermission_permissionId` |

#### User

| Columna | Tipo | Restricciones |
|---|---|---|
| id | INT IDENTITY | PK |
| email | NVARCHAR(255) | NN, `UX_User_email` |
| passwordHash | NVARCHAR(255) | NN — bcrypt; nunca se serializa |
| firstName | NVARCHAR(100) | NN |
| lastName | NVARCHAR(100) | NN |
| phone | NVARCHAR(30) | |
| roleId | INT | NN, FK → Role (NA), `IX_User_roleId` |
| managerId | INT | FK → User (NA), `IX_User_managerId` — reservado para equipos |
| isActive | BIT | NN, default 1, `IX_User_isActive` |
| mustChangePassword | BIT | NN, default 0 |
| failedLoginAttempts | INT | NN, default 0 |
| lockedUntil | DATETIME2(3) | |
| lastLoginAt | DATETIME2(3) | |
| createdAt, updatedAt | DATETIME2(3) | NN |

#### RefreshToken

| Columna | Tipo | Restricciones |
|---|---|---|
| id | INT IDENTITY | PK |
| userId | INT | NN, FK → User (CAS), `IX_RefreshToken_userId` |
| tokenHash | NVARCHAR(128) | NN, `UX_RefreshToken_tokenHash` — SHA-256 hex del token opaco |
| expiresAt | DATETIME2(3) | NN, `IX_RefreshToken_expiresAt` (limpieza) |
| revokedAt | DATETIME2(3) | |
| replacedById | INT | FK → RefreshToken (NA) — cadena de rotación |
| userAgent | NVARCHAR(255) | |
| ipAddress | NVARCHAR(45) | |
| createdAt | DATETIME2(3) | NN |

### 3.2 Directorio

#### Company

| Columna | Tipo | Restricciones |
|---|---|---|
| id | INT IDENTITY | PK |
| name | NVARCHAR(200) | NN, `IX_Company_name` |
| legalName | NVARCHAR(200) | |
| taxId | NVARCHAR(50) | `FX_Company_taxId` UNIQUE WHERE `taxId IS NOT NULL AND deletedAt IS NULL` |
| industry | NVARCHAR(100) | `IX_Company_industry` |
| website | NVARCHAR(255) | |
| email | NVARCHAR(255) | |
| phone | NVARCHAR(30) | |
| addressLine | NVARCHAR(255) | |
| city | NVARCHAR(100) | `IX_Company_city` |
| state | NVARCHAR(100) | |
| country | NVARCHAR(100) | |
| postalCode | NVARCHAR(20) | |
| employeesRange | NVARCHAR(20) | `CK_Company_employeesRange` IN ('1-10','11-50','51-200','201-500','501-1000','1000+') |
| description | NVARCHAR(MAX) | |
| createdById | INT | NN, FK → User (NA) |
| createdAt, updatedAt | DATETIME2(3) | NN |
| deletedAt | DATETIME2(3) | `IX_Company_deletedAt` |

#### Contact

| Columna | Tipo | Restricciones |
|---|---|---|
| id | INT IDENTITY | PK |
| firstName | NVARCHAR(100) | NN |
| lastName | NVARCHAR(100) | NN |
| email | NVARCHAR(255) | `FX_Contact_email` UNIQUE WHERE `email IS NOT NULL AND deletedAt IS NULL` |
| phone | NVARCHAR(30) | |
| mobile | NVARCHAR(30) | |
| jobTitle | NVARCHAR(100) | |
| department | NVARCHAR(100) | |
| companyId | INT | FK → Company (NA), `IX_Contact_companyId` |
| isPrimary | BIT | NN, default 0 |
| linkedinUrl | NVARCHAR(255) | |
| createdById | INT | NN, FK → User (NA) |
| createdAt, updatedAt | DATETIME2(3) | NN |
| deletedAt | DATETIME2(3) | |
| | | `IX_Contact_lastName_firstName` |

### 3.3 Comercial

#### Client

| Columna | Tipo | Restricciones |
|---|---|---|
| id | INT IDENTITY | PK |
| type | NVARCHAR(20) | NN, `CK_Client_type` IN ('COMPANY','INDIVIDUAL') |
| companyId | INT | FK → Company (NA), `FX_Client_companyId` UNIQUE WHERE `companyId IS NOT NULL AND deletedAt IS NULL` |
| primaryContactId | INT | FK → Contact (NA), `IX_Client_primaryContactId` |
| status | NVARCHAR(20) | NN, default 'ACTIVE', `CK_Client_status` IN ('ACTIVE','INACTIVE','CHURNED') |
| ownerId | INT | FK → User (NA) |
| segment | NVARCHAR(50) | |
| clientSince | DATE | NN, default CAST(SYSUTCDATETIME() AS DATE) |
| summary | NVARCHAR(MAX) | descripción general |
| createdById | INT | NN, FK → User (NA) |
| createdAt, updatedAt | DATETIME2(3) | NN |
| deletedAt | DATETIME2(3) | |
| | | `CK_Client_target`: `companyId IS NOT NULL OR primaryContactId IS NOT NULL` |
| | | `CK_Client_type_target`: `(type='COMPANY' AND companyId IS NOT NULL) OR (type='INDIVIDUAL' AND primaryContactId IS NOT NULL)` |
| | | `IX_Client_ownerId_status` (ownerId, status) |

#### LeadSource

| Columna | Tipo | Restricciones |
|---|---|---|
| id | INT IDENTITY | PK |
| name | NVARCHAR(100) | NN, `UX_LeadSource_name` |
| isActive | BIT | NN, default 1 |
| sortOrder | INT | NN, default 0 |

#### Lead

| Columna | Tipo | Restricciones |
|---|---|---|
| id | INT IDENTITY | PK |
| firstName | NVARCHAR(100) | NN |
| lastName | NVARCHAR(100) | NN |
| email | NVARCHAR(255) | `IX_Lead_email` |
| phone | NVARCHAR(30) | |
| companyName | NVARCHAR(200) | texto libre |
| companyId | INT | FK → Company (NA), `IX_Lead_companyId` |
| jobTitle | NVARCHAR(100) | |
| sourceId | INT | FK → LeadSource (NA), `IX_Lead_sourceId` |
| status | NVARCHAR(20) | NN, default 'NEW', `CK_Lead_status` IN ('NEW','CONTACTED','QUALIFIED','UNQUALIFIED','CONVERTED','LOST') |
| ownerId | INT | FK → User (NA) |
| estimatedValue | DECIMAL(18,2) | `CK_Lead_estimatedValue` >= 0 |
| description | NVARCHAR(MAX) | |
| lostReason | NVARCHAR(500) | |
| convertedAt | DATETIME2(3) | |
| convertedClientId | INT | FK → Client (NA) |
| convertedContactId | INT | FK → Contact (NA) |
| convertedOpportunityId | INT | FK → Opportunity (NA) |
| createdById | INT | NN, FK → User (NA) |
| createdAt, updatedAt | DATETIME2(3) | NN |
| deletedAt | DATETIME2(3) | |
| | | `IX_Lead_status_ownerId` (status, ownerId), `IX_Lead_createdAt` |

#### PipelineStage

| Columna | Tipo | Restricciones |
|---|---|---|
| id | INT IDENTITY | PK |
| name | NVARCHAR(100) | NN, `UX_PipelineStage_name` |
| sortOrder | INT | NN |
| defaultProbability | INT | NN, `CK_PipelineStage_probability` BETWEEN 0 AND 100 |
| isWon | BIT | NN, default 0 |
| isLost | BIT | NN, default 0 |
| isActive | BIT | NN, default 1 |
| color | NVARCHAR(20) | |
| createdAt, updatedAt | DATETIME2(3) | NN |
| | | `CK_PipelineStage_wonlost`: NOT (isWon = 1 AND isLost = 1) |

#### Opportunity

| Columna | Tipo | Restricciones |
|---|---|---|
| id | INT IDENTITY | PK |
| name | NVARCHAR(200) | NN |
| clientId | INT | NN, FK → Client (NA), `IX_Opportunity_clientId` |
| contactId | INT | FK → Contact (NA), `IX_Opportunity_contactId` |
| stageId | INT | NN, FK → PipelineStage (NA) |
| ownerId | INT | NN, FK → User (NA) |
| amount | DECIMAL(18,2) | NN, default 0, `CK_Opportunity_amount` >= 0 |
| currency | CHAR(3) | NN, default 'USD' |
| probability | INT | NN, `CK_Opportunity_probability` BETWEEN 0 AND 100 |
| expectedCloseDate | DATE | |
| actualCloseDate | DATE | |
| description | NVARCHAR(MAX) | |
| lostReason | NVARCHAR(500) | |
| createdById | INT | NN, FK → User (NA) |
| createdAt, updatedAt | DATETIME2(3) | NN |
| deletedAt | DATETIME2(3) | |
| | | `IX_Opportunity_ownerId_stageId` (ownerId, stageId), `IX_Opportunity_stageId_expectedCloseDate` (stageId, expectedCloseDate), `IX_Opportunity_actualCloseDate` |

#### OpportunityStageHistory

| Columna | Tipo | Restricciones |
|---|---|---|
| id | INT IDENTITY | PK |
| opportunityId | INT | NN, FK → Opportunity (CAS) |
| fromStageId | INT | FK → PipelineStage (NA) |
| toStageId | INT | NN, FK → PipelineStage (NA) |
| changedById | INT | NN, FK → User (NA) |
| changedAt | DATETIME2(3) | NN |
| note | NVARCHAR(500) | |
| | | `IX_OpportunityStageHistory_opportunityId_changedAt` |

### 3.4 Seguimiento

#### Activity

| Columna | Tipo | Restricciones |
|---|---|---|
| id | INT IDENTITY | PK |
| type | NVARCHAR(20) | NN, `CK_Activity_type` IN ('CALL','EMAIL','MEETING','TASK','FOLLOW_UP'), `IX_Activity_type` |
| subject | NVARCHAR(200) | NN |
| description | NVARCHAR(MAX) | |
| status | NVARCHAR(20) | NN, default 'PENDING', `CK_Activity_status` IN ('PENDING','IN_PROGRESS','COMPLETED','CANCELLED') |
| priority | NVARCHAR(10) | NN, default 'MEDIUM', `CK_Activity_priority` IN ('LOW','MEDIUM','HIGH') |
| scheduledAt | DATETIME2(3) | fecha/hora en que ocurre |
| dueDate | DATETIME2(3) | vencimiento |
| completedAt | DATETIME2(3) | |
| durationMinutes | INT | `CK_Activity_duration` >= 0 |
| outcome | NVARCHAR(500) | |
| ownerId | INT | NN, FK → User (NA) |
| createdById | INT | NN, FK → User (NA) |
| companyId | INT | FK → Company (NA), `IX_Activity_companyId` |
| contactId | INT | FK → Contact (NA), `IX_Activity_contactId` |
| clientId | INT | FK → Client (NA), `IX_Activity_clientId` |
| leadId | INT | FK → Lead (NA), `IX_Activity_leadId` |
| opportunityId | INT | FK → Opportunity (NA), `IX_Activity_opportunityId` |
| createdAt, updatedAt | DATETIME2(3) | NN |
| | | `IX_Activity_ownerId_status_dueDate` (ownerId, status, dueDate) |
| | | `FX_Activity_open_dueDate` ON (dueDate) WHERE `status IN ('PENDING','IN_PROGRESS')` |

#### Note

| Columna | Tipo | Restricciones |
|---|---|---|
| id | INT IDENTITY | PK |
| content | NVARCHAR(MAX) | NN |
| authorId | INT | NN, FK → User (NA) |
| companyId | INT | FK → Company (NA), `FX_Note_companyId` WHERE NOT NULL |
| contactId | INT | FK → Contact (NA), `FX_Note_contactId` WHERE NOT NULL |
| clientId | INT | FK → Client (NA), `FX_Note_clientId` WHERE NOT NULL |
| leadId | INT | FK → Lead (NA), `FX_Note_leadId` WHERE NOT NULL |
| opportunityId | INT | FK → Opportunity (NA), `FX_Note_opportunityId` WHERE NOT NULL |
| isPinned | BIT | NN, default 0 |
| createdAt, updatedAt | DATETIME2(3) | NN |
| | | `CK_Note_single_parent`: `IIF(companyId IS NULL,0,1) + IIF(contactId IS NULL,0,1) + IIF(clientId IS NULL,0,1) + IIF(leadId IS NULL,0,1) + IIF(opportunityId IS NULL,0,1) = 1` |

### 3.5 Sistema

#### AuditLog (append-only)

| Columna | Tipo | Restricciones |
|---|---|---|
| id | BIGINT IDENTITY | PK |
| entityType | NVARCHAR(50) | NN |
| entityId | INT | NN |
| action | NVARCHAR(30) | NN, `CK_AuditLog_action` IN ('CREATE','UPDATE','DELETE','RESTORE','STATUS_CHANGE','STAGE_CHANGE','ASSIGN','CONVERT','LOGIN','LOGIN_FAILED','LOGOUT','PASSWORD_CHANGE','ROLE_CHANGE') |
| changes | NVARCHAR(MAX) | `CK_AuditLog_changes_json`: `changes IS NULL OR ISJSON(changes) = 1` |
| userId | INT | FK → User (NA) |
| ipAddress | NVARCHAR(45) | |
| createdAt | DATETIME2(3) | NN |
| | | `IX_AuditLog_entity` (entityType, entityId, createdAt DESC), `IX_AuditLog_userId_createdAt` |

Sin FK a las entidades auditadas (polimórfico): el log debe sobrevivir a cualquier borrado y no
bloquear operaciones. Es el único punto donde se acepta ese trade-off.

#### Notification

| Columna | Tipo | Restricciones |
|---|---|---|
| id | INT IDENTITY | PK |
| userId | INT | NN, FK → User (CAS) |
| type | NVARCHAR(50) | NN — 'ASSIGNED','ACTIVITY_DUE','ACTIVITY_OVERDUE','LEAD_CONVERTED','OPPORTUNITY_WON','OPPORTUNITY_LOST' |
| title | NVARCHAR(200) | NN |
| message | NVARCHAR(500) | |
| entityType | NVARCHAR(50) | |
| entityId | INT | |
| isRead | BIT | NN, default 0 |
| readAt | DATETIME2(3) | |
| createdAt | DATETIME2(3) | NN |
| | | `IX_Notification_userId_isRead_createdAt` (userId, isRead, createdAt DESC) |

#### Setting

| Columna | Tipo | Restricciones |
|---|---|---|
| key | NVARCHAR(100) | PK — `company_name`, `default_currency`, `timezone`, `date_format` |
| value | NVARCHAR(MAX) | NN |
| updatedById | INT | FK → User (NA) |
| updatedAt | DATETIME2(3) | NN |

## 4. Relaciones y cardinalidades

| Relación | Cardinalidad | FK | Acción al borrar | Regla |
|---|---|---|---|---|
| Role → User | 1 : N | `User.roleId` | NO ACTION | No se borra un rol con usuarios |
| Role ↔ Permission | N : M | `RolePermission` | CASCADE | — |
| User → User | 0..1 : N | `User.managerId` | NO ACTION | Reservado |
| User → RefreshToken | 1 : N | `RefreshToken.userId` | CASCADE | Usuarios no se borran; cascada por consistencia |
| User → Notification | 1 : N | `Notification.userId` | CASCADE | Ídem |
| User → Company/Contact/Client/Lead/Opportunity/Activity/Note (createdBy/author) | 1 : N | `createdById`/`authorId` | NO ACTION | — |
| User → Client/Lead (owner) | 0..1 : N | `ownerId` | NO ACTION | Nullable: registros sin asignar |
| User → Opportunity/Activity (owner) | 1 : N | `ownerId` | NO ACTION | Obligatorio |
| Company → Contact | 0..1 : N | `Contact.companyId` | NO ACTION | Contacto sin empresa permitido |
| Company ↔ Client | 0..1 : 0..1 | `Client.companyId` (único filtrado) | NO ACTION | Una empresa es cliente a lo sumo una vez (entre no archivados) |
| Contact → Client | 0..1 : N | `Client.primaryContactId` | NO ACTION | Obligatorio si `type = INDIVIDUAL` |
| Company → Lead | 0..1 : N | `Lead.companyId` | NO ACTION | Vínculo opcional a empresa existente |
| LeadSource → Lead | 0..1 : N | `Lead.sourceId` | NO ACTION | No se borra una fuente con leads |
| Lead → Client / Contact / Opportunity | 0..1 : 1 | `converted*Id` | NO ACTION | Punteros de conversión |
| Client → Opportunity | 1 : N | `Opportunity.clientId` | NO ACTION | Obligatorio |
| Contact → Opportunity | 0..1 : N | `Opportunity.contactId` | NO ACTION | Debe pertenecer al cliente (servicio) |
| PipelineStage → Opportunity | 1 : N | `Opportunity.stageId` | NO ACTION | No se borra una etapa con oportunidades |
| Opportunity → OpportunityStageHistory | 1 : N | `opportunityId` | CASCADE | Historial muere con la oportunidad (solo borrado físico administrativo) |
| PipelineStage → OpportunityStageHistory | 1 : N | `fromStageId`/`toStageId` | NO ACTION | — |
| Activity → Company/Contact/Client/Lead/Opportunity | 0..1 cada una | 5 FK nullable | NO ACTION | Puede vincular varias |
| Note → Company/Contact/Client/Lead/Opportunity | exactamente 1 | arco exclusivo (CK) | NO ACTION | — |

## 5. Índices y consultas que sirven

| Consulta frecuente | Índice |
|---|---|
| Login por email | `UX_User_email` |
| Refresh/rotación de token, limpieza de expirados | `UX_RefreshToken_tokenHash`, `IX_RefreshToken_expiresAt` |
| Listado y búsqueda de empresas | `IX_Company_name`, `IX_Company_city`, `IX_Company_industry`, `IX_Company_deletedAt` |
| Contactos de una empresa; búsqueda por apellido | `IX_Contact_companyId`, `IX_Contact_lastName_firstName` |
| Mis clientes / por estado | `IX_Client_ownerId_status` |
| ¿Esta empresa ya es cliente? | `FX_Client_companyId` |
| Leads por estado/responsable; nuevos leads del período | `IX_Lead_status_ownerId`, `IX_Lead_createdAt` |
| Kanban; pipeline abierto; forecast por fecha estimada | `IX_Opportunity_stageId_expectedCloseDate`, `IX_Opportunity_ownerId_stageId` |
| Ganadas/perdidas del período | `IX_Opportunity_actualCloseDate` |
| Oportunidades de un cliente | `IX_Opportunity_clientId` |
| Mis actividades pendientes y vencidas | `IX_Activity_ownerId_status_dueDate`, `FX_Activity_open_dueDate` |
| Timeline por entidad | FKs de `Activity` y `Note` + `IX_AuditLog_entity` |
| Campana de notificaciones | `IX_Notification_userId_isRead_createdAt` |
| Búsqueda global | Índices de nombre/email de cada tabla (prefijo `LIKE 'x%'` usa índice; `'%x%'` escanea — aceptable en v1; Full-Text Search es la extensión prevista) |

## 6. Reglas de integridad

| # | Regla | Dónde se aplica |
|---|---|---|
| I-01 | Usuarios nunca se borran físicamente | FK `NO ACTION` + no existe endpoint DELETE |
| I-02 | No desactivar ni degradar al último Admin activo | `users.service` (transacción con conteo) |
| I-03 | Un usuario no cambia su propio rol | `users.service` |
| I-04 | Roles del sistema no se borran ni renombran; rol con usuarios no se borra | `roles.service` + `isSystem` |
| I-05 | Lecturas excluyen `deletedAt IS NOT NULL` salvo `includeDeleted` con permiso | Services (helper `notDeleted()`) |
| I-06 | Company no se archiva con Client activo u oportunidades abiertas | `companies.service` |
| I-07 | Contact no se archiva si es `primaryContactId` de un Client activo | `contacts.service` |
| I-08 | Client no se archiva con oportunidades abiertas | `clients.service` |
| I-09 | Lead `CONVERTED` no se edita, archiva ni reconvierte | `leads.service` (relectura en transacción) |
| I-10 | Transiciones de lead válidas; `LOST`/`UNQUALIFIED` requieren motivo | `leads.service` + Zod |
| I-11 | Conversión atómica: Company (crear/vincular) → Contact → Client (crear o reutilizar por `companyId`) → Opportunity opcional → Lead marcado | `leads.service` `$transaction` |
| I-12 | `Opportunity.contactId` pertenece a la empresa del cliente o es su contacto principal | `opportunities.service` |
| I-13 | Cambio de etapa registra historial; ganada → prob 100 + `actualCloseDate`; perdida → prob 0 + `actualCloseDate` + `lostReason` | `opportunities.service` `$transaction` |
| I-14 | Oportunidad cerrada no se edita salvo reapertura (`opportunities:reopen`) | `opportunities.service` |
| I-15 | Oportunidades ganadas no se archivan | `opportunities.service` |
| I-16 | Exactamente una etapa `isWon` y una `isLost` activas | `pipelineStages.service` |
| I-17 | Etapa/fuente con registros no se borra (se desactiva) | Services + FK `NO ACTION` |
| I-18 | Note tiene exactamente un padre | `CK_Note_single_parent` + Zod |
| I-19 | Activity TASK/FOLLOW_UP requiere `dueDate` | Zod |
| I-20 | Valores de dominio (estados, tipos) | CHECK + Zod + constantes |
| I-21 | Unicidad de `User.email`, `Contact.email`, `Company.taxId`, `Client.companyId` (no archivados) | Índices únicos (filtrados) → `P2002` → 409 |

## 7. Datos iniciales (seed)

| Tabla | Datos |
|---|---|
| Role | Admin, Manager, Vendedor (`isSystem = 1`) |
| Permission | Catálogo completo (ver [security.md § 4.1](security.md#41-catálogo-de-permisos)) |
| RolePermission | Matriz por rol (ver [security.md § 4.2](security.md#42-matriz-de-roles)) |
| PipelineStage | Prospecto (10, #64748b), Contactado (25, #3b82f6), Propuesta (50, #8b5cf6), Negociación (75, #f59e0b), Ganada (100, isWon, #22c55e), Perdida (0, isLost, #ef4444) |
| LeadSource | Sitio web, Referido, Redes sociales, Llamada en frío, Evento, Email, Publicidad, Otro |
| Setting | `company_name`, `default_currency=USD`, `timezone=America/Argentina/Buenos_Aires`, `date_format=DD/MM/YYYY` |
| User | Admin inicial desde `SEED_ADMIN_*` con `mustChangePassword = 1` |

El seed es **idempotente** (`upsert` por clave natural) y no crea datos de negocio de ejemplo.
Un script separado `npm run db:seed:demo` (opcional, solo desarrollo) carga datos ficticios.

## 8. Preparación de SQL Server (desarrollo local)

Entorno detectado: SQL Server 2022 Express, instancia `SQLEXPRESS`, autenticación solo Windows,
TCP/IP deshabilitado, collation del servidor `Modern_Spanish_CI_AS`.

### 8.1 Habilitar TCP/IP (una sola vez, requiere administrador)

1. Abrir **SQL Server Configuration Manager** (`SQLServerManager16.msc`).
2. *Configuración de red de SQL Server → Protocolos de SQLEXPRESS → TCP/IP* → **Habilitado = Sí**.
3. Doble clic en TCP/IP → pestaña *Direcciones IP* → sección **IPAll**: dejar *Puertos dinámicos TCP* **vacío** y *Puerto TCP* = **1433**.
4. Reiniciar el servicio **SQL Server (SQLEXPRESS)**.
5. Verificar: `sqlcmd -S tcp:localhost,1433 -E -Q "SELECT @@SERVERNAME"`.

Si el firewall de Windows está activo y se accede desde otra máquina, permitir TCP 1433 (no necesario para localhost).

### 8.2 Habilitar modo mixto y crear el login de desarrollo (una sola vez)

El driver de la aplicación no admite autenticación integrada de Windows (ver § 1.1), por lo que
se usa un login SQL. Con una sesión de Windows con permisos de administrador de la instancia:

```bash
# Modo mixto (SQL Server y Windows). Requiere reiniciar el servicio (el mismo reinicio de § 8.1).
sqlcmd -S "localhost\SQLEXPRESS" -E -Q "EXEC xp_instance_regwrite N'HKEY_LOCAL_MACHINE', N'Software\Microsoft\MSSQLServer\MSSQLServer', N'LoginMode', REG_DWORD, 2"

# Login de desarrollo. Elegí una contraseña propia; solo va en server/.env.
# dbcreator es necesario para la shadow database de `prisma migrate dev`.
sqlcmd -S "localhost\SQLEXPRESS" -E -Q "CREATE LOGIN crm_dev WITH PASSWORD = 'TU_CONTRASEÑA', CHECK_POLICY = OFF; ALTER SERVER ROLE dbcreator ADD MEMBER crm_dev;"
```

### 8.3 Crear las bases con la collation correcta

Prisma crearía la base con la collation del servidor (sensible a acentos); por eso se crean antes:

```sql
CREATE DATABASE crm_dev  COLLATE Modern_Spanish_100_CI_AI;
CREATE DATABASE crm_test COLLATE Modern_Spanish_100_CI_AI;
```

`server/scripts/create-databases.sql` (ejecutable con `npm run db:create`) crea ambas bases y da
`db_owner` en ellas al login `crm_dev`.

### 8.4 Cadena de conexión

```
sqlserver://localhost:1433;database=crm_dev;user=crm_dev;password=TU_CONTRASEÑA;encrypt=true;trustServerCertificate=true
```

Si la contraseña contiene `;` o `=`, envolverla entre llaves: `password={p;ss=w}`.
En producción: login SQL dedicado con permisos mínimos y certificado válido (`trustServerCertificate=false`).

### 8.5 Verificación

```bash
sqlcmd -S tcp:localhost,1433 -U crm_dev -Q "SELECT DB_NAME(), SUSER_SNAME()"   # pide la contraseña
npm run db:generate && npm run db:migrate && npm run db:seed
```

## 9. Flujo de migraciones

| Entorno | Comando | Notas |
|---|---|---|
| Desarrollo | `npm run db:migrate -- --name <descripcion>` (= `prisma migrate dev`) | Genera SQL en `prisma/migrations/<timestamp>_<nombre>/migration.sql`. **Revisar y completar** el SQL con CHECK/índices filtrados cuando aplique antes de confirmar |
| Crear SQL sin aplicar | `prisma migrate dev --create-only` | Para editar el SQL manualmente y luego `migrate dev` |
| Test / CI | `prisma migrate deploy` sobre `crm_test` | En `globalSetup` de Vitest |
| Producción | `prisma migrate deploy` | Nunca `migrate dev` ni `db push` |
| Estado | `prisma migrate status` | Verifica migraciones pendientes |
| Reset (solo dev) | `prisma migrate reset` | Destructivo: pide confirmación |

Reglas:

1. Una migración por cambio lógico, con nombre descriptivo (`add_lead_conversion_fields`).
2. Nunca editar una migración ya aplicada en otro entorno; crear una nueva.
3. Las migraciones se versionan en Git junto con el cambio de `schema.prisma`.
4. Cambios destructivos (drop de columna con datos) requieren migración en dos pasos (añadir → migrar datos → eliminar) y backup previo.

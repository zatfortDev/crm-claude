BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Role] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(50) NOT NULL,
    [description] NVARCHAR(255),
    [isSystem] BIT NOT NULL CONSTRAINT [Role_isSystem_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Role_createdAt_df] DEFAULT SYSUTCDATETIME(),
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Role_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UX_Role_name] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[Permission] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(100) NOT NULL,
    [module] NVARCHAR(50) NOT NULL,
    [description] NVARCHAR(255),
    CONSTRAINT [Permission_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UX_Permission_code] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[RolePermission] (
    [roleId] INT NOT NULL,
    [permissionId] INT NOT NULL,
    CONSTRAINT [RolePermission_pkey] PRIMARY KEY CLUSTERED ([roleId],[permissionId])
);

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] INT NOT NULL IDENTITY(1,1),
    [email] NVARCHAR(255) NOT NULL,
    [passwordHash] NVARCHAR(255) NOT NULL,
    [firstName] NVARCHAR(100) NOT NULL,
    [lastName] NVARCHAR(100) NOT NULL,
    [phone] NVARCHAR(30),
    [roleId] INT NOT NULL,
    [managerId] INT,
    [isActive] BIT NOT NULL CONSTRAINT [User_isActive_df] DEFAULT 1,
    [mustChangePassword] BIT NOT NULL CONSTRAINT [User_mustChangePassword_df] DEFAULT 0,
    [failedLoginAttempts] INT NOT NULL CONSTRAINT [User_failedLoginAttempts_df] DEFAULT 0,
    [lockedUntil] DATETIME2,
    [lastLoginAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT SYSUTCDATETIME(),
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UX_User_email] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[RefreshToken] (
    [id] INT NOT NULL IDENTITY(1,1),
    [userId] INT NOT NULL,
    [tokenHash] NVARCHAR(128) NOT NULL,
    [expiresAt] DATETIME2 NOT NULL,
    [revokedAt] DATETIME2,
    [replacedById] INT,
    [userAgent] NVARCHAR(255),
    [ipAddress] NVARCHAR(45),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [RefreshToken_createdAt_df] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [RefreshToken_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UX_RefreshToken_tokenHash] UNIQUE NONCLUSTERED ([tokenHash])
);

-- CreateTable
CREATE TABLE [dbo].[Company] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(200) NOT NULL,
    [legalName] NVARCHAR(200),
    [taxId] NVARCHAR(50),
    [industry] NVARCHAR(100),
    [website] NVARCHAR(255),
    [email] NVARCHAR(255),
    [phone] NVARCHAR(30),
    [addressLine] NVARCHAR(255),
    [city] NVARCHAR(100),
    [state] NVARCHAR(100),
    [country] NVARCHAR(100),
    [postalCode] NVARCHAR(20),
    [employeesRange] NVARCHAR(20),
    [description] NVARCHAR(max),
    [createdById] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Company_createdAt_df] DEFAULT SYSUTCDATETIME(),
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [Company_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Contact] (
    [id] INT NOT NULL IDENTITY(1,1),
    [firstName] NVARCHAR(100) NOT NULL,
    [lastName] NVARCHAR(100) NOT NULL,
    [email] NVARCHAR(255),
    [phone] NVARCHAR(30),
    [mobile] NVARCHAR(30),
    [jobTitle] NVARCHAR(100),
    [department] NVARCHAR(100),
    [companyId] INT,
    [isPrimary] BIT NOT NULL CONSTRAINT [Contact_isPrimary_df] DEFAULT 0,
    [linkedinUrl] NVARCHAR(255),
    [createdById] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Contact_createdAt_df] DEFAULT SYSUTCDATETIME(),
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [Contact_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Client] (
    [id] INT NOT NULL IDENTITY(1,1),
    [type] NVARCHAR(20) NOT NULL,
    [companyId] INT,
    [primaryContactId] INT,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [Client_status_df] DEFAULT 'ACTIVE',
    [ownerId] INT,
    [segment] NVARCHAR(50),
    [clientSince] DATE NOT NULL CONSTRAINT [Client_clientSince_df] DEFAULT CAST(SYSUTCDATETIME() AS DATE),
    [summary] NVARCHAR(max),
    [createdById] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Client_createdAt_df] DEFAULT SYSUTCDATETIME(),
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [Client_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[LeadSource] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(100) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [LeadSource_isActive_df] DEFAULT 1,
    [sortOrder] INT NOT NULL CONSTRAINT [LeadSource_sortOrder_df] DEFAULT 0,
    CONSTRAINT [LeadSource_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UX_LeadSource_name] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[Lead] (
    [id] INT NOT NULL IDENTITY(1,1),
    [firstName] NVARCHAR(100) NOT NULL,
    [lastName] NVARCHAR(100) NOT NULL,
    [email] NVARCHAR(255),
    [phone] NVARCHAR(30),
    [companyName] NVARCHAR(200),
    [companyId] INT,
    [jobTitle] NVARCHAR(100),
    [sourceId] INT,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [Lead_status_df] DEFAULT 'NEW',
    [ownerId] INT,
    [estimatedValue] DECIMAL(18,2),
    [description] NVARCHAR(max),
    [lostReason] NVARCHAR(500),
    [convertedAt] DATETIME2,
    [convertedClientId] INT,
    [convertedContactId] INT,
    [convertedOpportunityId] INT,
    [createdById] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Lead_createdAt_df] DEFAULT SYSUTCDATETIME(),
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [Lead_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[PipelineStage] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(100) NOT NULL,
    [sortOrder] INT NOT NULL,
    [defaultProbability] INT NOT NULL,
    [isWon] BIT NOT NULL CONSTRAINT [PipelineStage_isWon_df] DEFAULT 0,
    [isLost] BIT NOT NULL CONSTRAINT [PipelineStage_isLost_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [PipelineStage_isActive_df] DEFAULT 1,
    [color] NVARCHAR(20),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [PipelineStage_createdAt_df] DEFAULT SYSUTCDATETIME(),
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [PipelineStage_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UX_PipelineStage_name] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[Opportunity] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(200) NOT NULL,
    [clientId] INT NOT NULL,
    [contactId] INT,
    [stageId] INT NOT NULL,
    [ownerId] INT NOT NULL,
    [amount] DECIMAL(18,2) NOT NULL CONSTRAINT [Opportunity_amount_df] DEFAULT 0,
    [currency] CHAR(3) NOT NULL CONSTRAINT [Opportunity_currency_df] DEFAULT 'USD',
    [probability] INT NOT NULL,
    [expectedCloseDate] DATE,
    [actualCloseDate] DATE,
    [description] NVARCHAR(max),
    [lostReason] NVARCHAR(500),
    [createdById] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Opportunity_createdAt_df] DEFAULT SYSUTCDATETIME(),
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [Opportunity_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[OpportunityStageHistory] (
    [id] INT NOT NULL IDENTITY(1,1),
    [opportunityId] INT NOT NULL,
    [fromStageId] INT,
    [toStageId] INT NOT NULL,
    [changedById] INT NOT NULL,
    [changedAt] DATETIME2 NOT NULL CONSTRAINT [OpportunityStageHistory_changedAt_df] DEFAULT SYSUTCDATETIME(),
    [note] NVARCHAR(500),
    CONSTRAINT [OpportunityStageHistory_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Activity] (
    [id] INT NOT NULL IDENTITY(1,1),
    [type] NVARCHAR(20) NOT NULL,
    [subject] NVARCHAR(200) NOT NULL,
    [description] NVARCHAR(max),
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [Activity_status_df] DEFAULT 'PENDING',
    [priority] NVARCHAR(10) NOT NULL CONSTRAINT [Activity_priority_df] DEFAULT 'MEDIUM',
    [scheduledAt] DATETIME2,
    [dueDate] DATETIME2,
    [completedAt] DATETIME2,
    [durationMinutes] INT,
    [outcome] NVARCHAR(500),
    [ownerId] INT NOT NULL,
    [createdById] INT NOT NULL,
    [companyId] INT,
    [contactId] INT,
    [clientId] INT,
    [leadId] INT,
    [opportunityId] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Activity_createdAt_df] DEFAULT SYSUTCDATETIME(),
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Activity_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Note] (
    [id] INT NOT NULL IDENTITY(1,1),
    [content] NVARCHAR(max) NOT NULL,
    [authorId] INT NOT NULL,
    [companyId] INT,
    [contactId] INT,
    [clientId] INT,
    [leadId] INT,
    [opportunityId] INT,
    [isPinned] BIT NOT NULL CONSTRAINT [Note_isPinned_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Note_createdAt_df] DEFAULT SYSUTCDATETIME(),
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Note_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AuditLog] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [entityType] NVARCHAR(50) NOT NULL,
    [entityId] INT NOT NULL,
    [action] NVARCHAR(30) NOT NULL,
    [changes] NVARCHAR(max),
    [userId] INT,
    [ipAddress] NVARCHAR(45),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AuditLog_createdAt_df] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [AuditLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Notification] (
    [id] INT NOT NULL IDENTITY(1,1),
    [userId] INT NOT NULL,
    [type] NVARCHAR(50) NOT NULL,
    [title] NVARCHAR(200) NOT NULL,
    [message] NVARCHAR(500),
    [entityType] NVARCHAR(50),
    [entityId] INT,
    [isRead] BIT NOT NULL CONSTRAINT [Notification_isRead_df] DEFAULT 0,
    [readAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Notification_createdAt_df] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [Notification_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Setting] (
    [key] NVARCHAR(100) NOT NULL,
    [value] NVARCHAR(max) NOT NULL,
    [updatedById] INT,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Setting_pkey] PRIMARY KEY CLUSTERED ([key])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Permission_module] ON [dbo].[Permission]([module]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_RolePermission_permissionId] ON [dbo].[RolePermission]([permissionId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_User_roleId] ON [dbo].[User]([roleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_User_managerId] ON [dbo].[User]([managerId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_User_isActive] ON [dbo].[User]([isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_RefreshToken_userId] ON [dbo].[RefreshToken]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_RefreshToken_expiresAt] ON [dbo].[RefreshToken]([expiresAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Company_name] ON [dbo].[Company]([name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Company_industry] ON [dbo].[Company]([industry]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Company_city] ON [dbo].[Company]([city]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Company_deletedAt] ON [dbo].[Company]([deletedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Contact_companyId] ON [dbo].[Contact]([companyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Contact_lastName_firstName] ON [dbo].[Contact]([lastName], [firstName]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Client_primaryContactId] ON [dbo].[Client]([primaryContactId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Client_ownerId_status] ON [dbo].[Client]([ownerId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Lead_email] ON [dbo].[Lead]([email]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Lead_companyId] ON [dbo].[Lead]([companyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Lead_sourceId] ON [dbo].[Lead]([sourceId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Lead_status_ownerId] ON [dbo].[Lead]([status], [ownerId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Lead_createdAt] ON [dbo].[Lead]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Opportunity_clientId] ON [dbo].[Opportunity]([clientId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Opportunity_contactId] ON [dbo].[Opportunity]([contactId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Opportunity_ownerId_stageId] ON [dbo].[Opportunity]([ownerId], [stageId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Opportunity_stageId_expectedCloseDate] ON [dbo].[Opportunity]([stageId], [expectedCloseDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Opportunity_actualCloseDate] ON [dbo].[Opportunity]([actualCloseDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_OpportunityStageHistory_opportunityId_changedAt] ON [dbo].[OpportunityStageHistory]([opportunityId], [changedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Activity_type] ON [dbo].[Activity]([type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Activity_companyId] ON [dbo].[Activity]([companyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Activity_contactId] ON [dbo].[Activity]([contactId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Activity_clientId] ON [dbo].[Activity]([clientId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Activity_leadId] ON [dbo].[Activity]([leadId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Activity_opportunityId] ON [dbo].[Activity]([opportunityId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Activity_ownerId_status_dueDate] ON [dbo].[Activity]([ownerId], [status], [dueDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FX_Note_companyId] ON [dbo].[Note]([companyId]) WHERE [companyId] IS NOT NULL;

-- CreateIndex
CREATE NONCLUSTERED INDEX [FX_Note_contactId] ON [dbo].[Note]([contactId]) WHERE [contactId] IS NOT NULL;

-- CreateIndex
CREATE NONCLUSTERED INDEX [FX_Note_clientId] ON [dbo].[Note]([clientId]) WHERE [clientId] IS NOT NULL;

-- CreateIndex
CREATE NONCLUSTERED INDEX [FX_Note_leadId] ON [dbo].[Note]([leadId]) WHERE [leadId] IS NOT NULL;

-- CreateIndex
CREATE NONCLUSTERED INDEX [FX_Note_opportunityId] ON [dbo].[Note]([opportunityId]) WHERE [opportunityId] IS NOT NULL;

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_AuditLog_entity] ON [dbo].[AuditLog]([entityType], [entityId], [createdAt] DESC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_AuditLog_userId_createdAt] ON [dbo].[AuditLog]([userId], [createdAt] DESC);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IX_Notification_userId_isRead_createdAt] ON [dbo].[Notification]([userId], [isRead], [createdAt] DESC);

-- AddForeignKey
ALTER TABLE [dbo].[RolePermission] ADD CONSTRAINT [RolePermission_roleId_fkey] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RolePermission] ADD CONSTRAINT [RolePermission_permissionId_fkey] FOREIGN KEY ([permissionId]) REFERENCES [dbo].[Permission]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_roleId_fkey] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_managerId_fkey] FOREIGN KEY ([managerId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RefreshToken] ADD CONSTRAINT [RefreshToken_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RefreshToken] ADD CONSTRAINT [RefreshToken_replacedById_fkey] FOREIGN KEY ([replacedById]) REFERENCES [dbo].[RefreshToken]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Company] ADD CONSTRAINT [Company_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Contact] ADD CONSTRAINT [Contact_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Contact] ADD CONSTRAINT [Contact_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Client] ADD CONSTRAINT [Client_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Client] ADD CONSTRAINT [Client_primaryContactId_fkey] FOREIGN KEY ([primaryContactId]) REFERENCES [dbo].[Contact]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Client] ADD CONSTRAINT [Client_ownerId_fkey] FOREIGN KEY ([ownerId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Client] ADD CONSTRAINT [Client_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Lead] ADD CONSTRAINT [Lead_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Lead] ADD CONSTRAINT [Lead_sourceId_fkey] FOREIGN KEY ([sourceId]) REFERENCES [dbo].[LeadSource]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Lead] ADD CONSTRAINT [Lead_ownerId_fkey] FOREIGN KEY ([ownerId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Lead] ADD CONSTRAINT [Lead_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Lead] ADD CONSTRAINT [Lead_convertedClientId_fkey] FOREIGN KEY ([convertedClientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Lead] ADD CONSTRAINT [Lead_convertedContactId_fkey] FOREIGN KEY ([convertedContactId]) REFERENCES [dbo].[Contact]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Lead] ADD CONSTRAINT [Lead_convertedOpportunityId_fkey] FOREIGN KEY ([convertedOpportunityId]) REFERENCES [dbo].[Opportunity]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Opportunity] ADD CONSTRAINT [Opportunity_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Opportunity] ADD CONSTRAINT [Opportunity_contactId_fkey] FOREIGN KEY ([contactId]) REFERENCES [dbo].[Contact]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Opportunity] ADD CONSTRAINT [Opportunity_stageId_fkey] FOREIGN KEY ([stageId]) REFERENCES [dbo].[PipelineStage]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Opportunity] ADD CONSTRAINT [Opportunity_ownerId_fkey] FOREIGN KEY ([ownerId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Opportunity] ADD CONSTRAINT [Opportunity_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OpportunityStageHistory] ADD CONSTRAINT [OpportunityStageHistory_opportunityId_fkey] FOREIGN KEY ([opportunityId]) REFERENCES [dbo].[Opportunity]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OpportunityStageHistory] ADD CONSTRAINT [OpportunityStageHistory_fromStageId_fkey] FOREIGN KEY ([fromStageId]) REFERENCES [dbo].[PipelineStage]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OpportunityStageHistory] ADD CONSTRAINT [OpportunityStageHistory_toStageId_fkey] FOREIGN KEY ([toStageId]) REFERENCES [dbo].[PipelineStage]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OpportunityStageHistory] ADD CONSTRAINT [OpportunityStageHistory_changedById_fkey] FOREIGN KEY ([changedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Activity] ADD CONSTRAINT [Activity_ownerId_fkey] FOREIGN KEY ([ownerId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Activity] ADD CONSTRAINT [Activity_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Activity] ADD CONSTRAINT [Activity_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Activity] ADD CONSTRAINT [Activity_contactId_fkey] FOREIGN KEY ([contactId]) REFERENCES [dbo].[Contact]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Activity] ADD CONSTRAINT [Activity_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Activity] ADD CONSTRAINT [Activity_leadId_fkey] FOREIGN KEY ([leadId]) REFERENCES [dbo].[Lead]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Activity] ADD CONSTRAINT [Activity_opportunityId_fkey] FOREIGN KEY ([opportunityId]) REFERENCES [dbo].[Opportunity]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Note] ADD CONSTRAINT [Note_authorId_fkey] FOREIGN KEY ([authorId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Note] ADD CONSTRAINT [Note_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[Company]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Note] ADD CONSTRAINT [Note_contactId_fkey] FOREIGN KEY ([contactId]) REFERENCES [dbo].[Contact]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Note] ADD CONSTRAINT [Note_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Note] ADD CONSTRAINT [Note_leadId_fkey] FOREIGN KEY ([leadId]) REFERENCES [dbo].[Lead]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Note] ADD CONSTRAINT [Note_opportunityId_fkey] FOREIGN KEY ([opportunityId]) REFERENCES [dbo].[Opportunity]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AuditLog] ADD CONSTRAINT [AuditLog_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Notification] ADD CONSTRAINT [Notification_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Setting] ADD CONSTRAINT [Setting_updatedById_fkey] FOREIGN KEY ([updatedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ---------------------------------------------------------------------------
-- SQL manual (no expresable en schema.prisma). Ver docs/database.md § 1.1 y § 3.
-- ---------------------------------------------------------------------------

-- Unicidad con NULL: índices únicos filtrados (SQL Server solo admite un NULL en índices únicos simples)
CREATE UNIQUE NONCLUSTERED INDEX [FX_Company_taxId] ON [dbo].[Company]([taxId]) WHERE [taxId] IS NOT NULL AND [deletedAt] IS NULL;
CREATE UNIQUE NONCLUSTERED INDEX [FX_Contact_email] ON [dbo].[Contact]([email]) WHERE [email] IS NOT NULL AND [deletedAt] IS NULL;
CREATE UNIQUE NONCLUSTERED INDEX [FX_Client_companyId] ON [dbo].[Client]([companyId]) WHERE [companyId] IS NOT NULL AND [deletedAt] IS NULL;

-- Actividades abiertas por vencimiento (recordatorios y "vencidas")
CREATE NONCLUSTERED INDEX [FX_Activity_open_dueDate] ON [dbo].[Activity]([dueDate]) WHERE [status] IN ('PENDING', 'IN_PROGRESS');

-- Dominios de valores (el conector SQL Server de Prisma no soporta enums)
ALTER TABLE [dbo].[Company] ADD CONSTRAINT [CK_Company_employeesRange] CHECK ([employeesRange] IS NULL OR [employeesRange] IN ('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'));
ALTER TABLE [dbo].[Client] ADD CONSTRAINT [CK_Client_type] CHECK ([type] IN ('COMPANY', 'INDIVIDUAL'));
ALTER TABLE [dbo].[Client] ADD CONSTRAINT [CK_Client_status] CHECK ([status] IN ('ACTIVE', 'INACTIVE', 'CHURNED'));
ALTER TABLE [dbo].[Lead] ADD CONSTRAINT [CK_Lead_status] CHECK ([status] IN ('NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED', 'LOST'));
ALTER TABLE [dbo].[Activity] ADD CONSTRAINT [CK_Activity_type] CHECK ([type] IN ('CALL', 'EMAIL', 'MEETING', 'TASK', 'FOLLOW_UP'));
ALTER TABLE [dbo].[Activity] ADD CONSTRAINT [CK_Activity_status] CHECK ([status] IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'));
ALTER TABLE [dbo].[Activity] ADD CONSTRAINT [CK_Activity_priority] CHECK ([priority] IN ('LOW', 'MEDIUM', 'HIGH'));
ALTER TABLE [dbo].[AuditLog] ADD CONSTRAINT [CK_AuditLog_action] CHECK ([action] IN ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'STATUS_CHANGE', 'STAGE_CHANGE', 'ASSIGN', 'CONVERT', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGE', 'ROLE_CHANGE'));

-- Rangos numéricos
ALTER TABLE [dbo].[Lead] ADD CONSTRAINT [CK_Lead_estimatedValue] CHECK ([estimatedValue] IS NULL OR [estimatedValue] >= 0);
ALTER TABLE [dbo].[PipelineStage] ADD CONSTRAINT [CK_PipelineStage_probability] CHECK ([defaultProbability] BETWEEN 0 AND 100);
ALTER TABLE [dbo].[PipelineStage] ADD CONSTRAINT [CK_PipelineStage_wonlost] CHECK (NOT ([isWon] = 1 AND [isLost] = 1));
ALTER TABLE [dbo].[Opportunity] ADD CONSTRAINT [CK_Opportunity_amount] CHECK ([amount] >= 0);
ALTER TABLE [dbo].[Opportunity] ADD CONSTRAINT [CK_Opportunity_probability] CHECK ([probability] BETWEEN 0 AND 100);
ALTER TABLE [dbo].[Activity] ADD CONSTRAINT [CK_Activity_duration] CHECK ([durationMinutes] IS NULL OR [durationMinutes] >= 0);

-- Integridad estructural
ALTER TABLE [dbo].[Client] ADD CONSTRAINT [CK_Client_target] CHECK ([companyId] IS NOT NULL OR [primaryContactId] IS NOT NULL);
ALTER TABLE [dbo].[Client] ADD CONSTRAINT [CK_Client_type_target] CHECK (([type] = 'COMPANY' AND [companyId] IS NOT NULL) OR ([type] = 'INDIVIDUAL' AND [primaryContactId] IS NOT NULL));
ALTER TABLE [dbo].[Note] ADD CONSTRAINT [CK_Note_single_parent] CHECK (
    IIF([companyId] IS NULL, 0, 1) + IIF([contactId] IS NULL, 0, 1) + IIF([clientId] IS NULL, 0, 1)
    + IIF([leadId] IS NULL, 0, 1) + IIF([opportunityId] IS NULL, 0, 1) = 1);
ALTER TABLE [dbo].[AuditLog] ADD CONSTRAINT [CK_AuditLog_changes_json] CHECK ([changes] IS NULL OR ISJSON([changes]) = 1);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

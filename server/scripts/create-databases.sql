-- Crea las bases de desarrollo y test con la collation del proyecto y concede acceso
-- al login de aplicación. Ejecutar con un login sysadmin (npm run db:create).
-- Collation Modern_Spanish_100_CI_AI: insensible a mayúsculas y acentos, orden español.
SET NOCOUNT ON;

IF DB_ID('crm_dev') IS NULL
    CREATE DATABASE crm_dev COLLATE Modern_Spanish_100_CI_AI;
IF DB_ID('crm_test') IS NULL
    CREATE DATABASE crm_test COLLATE Modern_Spanish_100_CI_AI;
GO

-- Usuario de base para el login crm_dev (creado previamente por el administrador).
IF SUSER_ID('crm_dev') IS NOT NULL
BEGIN
    USE crm_dev;
    IF DATABASE_PRINCIPAL_ID('crm_dev') IS NULL CREATE USER crm_dev FOR LOGIN crm_dev;
    ALTER ROLE db_owner ADD MEMBER crm_dev;

    USE crm_test;
    IF DATABASE_PRINCIPAL_ID('crm_dev') IS NULL CREATE USER crm_dev FOR LOGIN crm_dev;
    ALTER ROLE db_owner ADD MEMBER crm_dev;
END
GO

SELECT name, collation_name FROM sys.databases WHERE name IN ('crm_dev', 'crm_test');
GO

// Punto de entrada: arranca el servidor HTTP y gestiona el apagado ordenado.
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma, checkDatabaseConnection } from './lib/prisma.js';

const app = createApp();

async function start() {
  try {
    await checkDatabaseConnection();
    logger.info('Conexión con SQL Server verificada');
  } catch (err) {
    logger.error(
      { err },
      'No se pudo conectar con SQL Server. Revisá DATABASE_URL (docs/database.md § 8)',
    );
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      `API escuchando en http://localhost:${env.PORT}`,
    );
  });
  server.requestTimeout = 30_000;

  const shutdown = async (signal) => {
    logger.info({ signal }, 'Apagando servidor...');
    server.close(async () => {
      await prisma.$disconnect();
      logger.info('Servidor detenido');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Promesa rechazada sin manejar');
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Excepción no capturada');
    process.exit(1);
  });
}

start();

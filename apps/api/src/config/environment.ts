const productionSecretNames = [
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'CUSTOMER_JWT_ACCESS_SECRET',
  'CUSTOMER_JWT_REFRESH_SECRET',
  'CONFIG_ENCRYPTION_KEY',
] as const;

export function validateEnvironment(environment: NodeJS.ProcessEnv = process.env): void {
  const port = Number(environment.API_PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('API_PORT must be an integer between 1 and 65535');
  const initializedDataSource = String(project.database.mode);
  const dataSource = environment.DATA_SOURCE ?? initializedDataSource;
  if (dataSource !== 'memory' && dataSource !== 'prisma')
    throw new Error('DATA_SOURCE must be either memory or prisma');
  if (environment.NODE_ENV === 'production') {
    if (dataSource !== 'prisma') throw new Error('DATA_SOURCE must be prisma in production');
    if (!environment.DATABASE_URL) throw new Error('DATABASE_URL is required in production');
    for (const name of productionSecretNames) {
      if (!environment[name] || environment[name].length < 32)
        throw new Error(`${name} must contain at least 32 characters in production`);
    }
    if (!environment.ADMIN_ORIGIN || !environment.WEB_ORIGIN)
      throw new Error('ADMIN_ORIGIN and WEB_ORIGIN are required in production');
  }
  if (!environment.DATA_SOURCE && initializedDataSource === 'prisma')
    throw new Error('DATA_SOURCE is required for an initialized Prisma project');
  if (dataSource !== initializedDataSource)
    throw new Error(
      `DATA_SOURCE ${dataSource} does not match initialized project database mode ${initializedDataSource}`,
    );
}
import { project } from '../generated/project.js';

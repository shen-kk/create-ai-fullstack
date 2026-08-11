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
  if (project.database.mode !== 'prisma') throw new Error('The generated project must use Prisma');
  if (!environment.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (environment.NODE_ENV === 'production') {
    for (const name of productionSecretNames) {
      if (!environment[name] || environment[name].length < 32)
        throw new Error(`${name} must contain at least 32 characters in production`);
    }
    if (!environment.ADMIN_ORIGIN || !environment.WEB_ORIGIN)
      throw new Error('ADMIN_ORIGIN and WEB_ORIGIN are required in production');
  }
}
import { project } from '../generated/project.js';

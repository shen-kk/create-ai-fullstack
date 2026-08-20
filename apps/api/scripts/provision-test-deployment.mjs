import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const environmentId = process.argv[2] ?? 'cmsqxm6ql000gvhaweotmassr';
const prisma = new PrismaClient();
const cryptoKey = createHash('sha256')
  .update(process.env.CONFIG_ENCRYPTION_KEY ?? 'development-config-key-change-me')
  .digest();

function decrypt(value) {
  if (!value) return {};
  const payload = Buffer.from(value, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', cryptoKey, payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString());
}
function encrypt(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', cryptoKey, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}
function secret() {
  return randomBytes(32).toString('base64url');
}

const environment = await prisma.deployEnvironment.findUnique({ where: { id: environmentId } });
if (!environment) throw new Error(`环境不存在：${environmentId}`);
const current = decrypt(environment.encryptedSecrets);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('请先在项目根目录 .env.template-dev 配置 DATABASE_URL');
const values = {
  ...current,
  databaseUrl,
  jwtAccessSecret: current.jwtAccessSecret ?? secret(),
  jwtRefreshSecret: current.jwtRefreshSecret ?? secret(),
  configEncryptionKey: current.configEncryptionKey ?? secret(),
  customerJwtAccessSecret: current.customerJwtAccessSecret ?? secret(),
  customerJwtRefreshSecret: current.customerJwtRefreshSecret ?? secret(),
};
const publicApiBaseUrl = environment.apiUrl ?? `http://${environment.host}:3001/api`;
await prisma.deployEnvironment.update({
  where: { id: environmentId },
  data: {
    encryptedSecrets: encrypt(values),
    environmentValues: {
      ...(environment.environmentValues ?? {}),
      PUBLIC_API_BASE_URL: publicApiBaseUrl,
    },
  },
});
console.log(`已为环境“${environment.name}”补齐部署变量（${Object.keys(values).length} 项），API 地址：${publicApiBaseUrl}`);
await prisma.$disconnect();

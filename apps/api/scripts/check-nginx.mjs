import { createDecipheriv, createHash } from 'node:crypto';
import { Client } from 'ssh2';
import { PrismaClient } from '@prisma/client';

const environmentId = process.argv[2] ?? 'cmsqxm6ql000gvhaweotmassr';
const prisma = new PrismaClient();
const environment = await prisma.deployEnvironment.findUnique({ where: { id: environmentId } });
if (!environment) throw new Error(`环境不存在：${environmentId}`);
const key = createHash('sha256')
  .update(process.env.CONFIG_ENCRYPTION_KEY ?? 'development-config-key-change-me')
  .digest();
const payload = Buffer.from(environment.encryptedSecrets, 'base64');
const decipher = createDecipheriv('aes-256-gcm', key, payload.subarray(0, 12));
decipher.setAuthTag(payload.subarray(12, 28));
const secrets = JSON.parse(Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString());
const client = new Client();
const command = [
  'echo "=== systemctl status nginx ==="; systemctl status nginx --no-pager -l || true',
  'echo "=== nginx -t ==="; nginx -t 2>&1 || true',
  'echo "=== journalctl nginx ==="; journalctl -u nginx -n 80 --no-pager 2>&1 || true',
  'echo "=== ports 80/443 ==="; ss -ltnp 2>/dev/null | grep -E ":(80|443)\\b" || true',
  'echo "=== docker nginx ==="; docker ps -a --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}" | grep -i nginx || true',
  'echo "=== nginx processes and pid files ==="; ps -ef | grep -E "[n]ginx" || true; find /www/server/nginx /run -maxdepth 3 -type f -name "*.pid" -print -exec sh -c "echo --- $1; cat $1" _ {} \\; 2>/dev/null || true',
  'echo "=== repair stale pid and start nginx ==="; if ! pgrep -x nginx >/dev/null 2>&1; then rm -f /www/server/nginx/logs/nginx.pid; fi; timeout 15 systemctl start nginx || true; systemctl status nginx --no-pager -l || true',
].join(' ; ');
await new Promise((resolve, reject) => {
  client
    .on('ready', () => client.exec(command, (error, stream) => {
      if (error) return reject(error);
      stream.on('data', (data) => process.stdout.write(data));
      stream.stderr.on('data', (data) => process.stdout.write(data));
      stream.on('close', () => { client.end(); resolve(); });
    }))
    .on('error', reject)
    .connect({
      host: environment.host,
      port: environment.sshPort,
      username: environment.sshUser,
      password: secrets.sshPassword,
      privateKey: secrets.sshPrivateKey,
      readyTimeout: 15000,
    });
});
await prisma.$disconnect();

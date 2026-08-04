import { connect as connectTcp } from 'node:net';
import { connect as connectTls } from 'node:tls';

export async function checkRedisConnection(item, timeoutMs = 5000) {
  const target = new URL(item.values.url);
  if (!['redis:', 'rediss:'].includes(target.protocol))
    throw new Error('Redis URL 必须使用 redis:// 或 rediss://');
  await new Promise((resolve, reject) => {
    const socket =
      target.protocol === 'rediss:'
        ? connectTls({ host: target.hostname, port: Number(target.port || 6380) })
        : connectTcp({ host: target.hostname, port: Number(target.port || 6379) });
    const timer = setTimeout(() => socket.destroy(new Error('Redis 连接超时')), timeoutMs);
    let response = '';
    const finish = (error) => {
      clearTimeout(timer);
      socket.destroy();
      error ? reject(error) : resolve();
    };
    socket.setEncoding('utf8');
    socket.once('error', (error) => finish(error));
    socket.on('data', (chunk) => {
      response += chunk;
      if (response.includes('+PONG')) finish();
      else if (response.includes('-ERR') || response.includes('-WRONGPASS'))
        finish(new Error('Redis 鉴权失败'));
    });
    socket.once('connect', () => {
      const password = item.secrets.password || decodeURIComponent(target.password);
      const username = decodeURIComponent(target.username);
      const commands = [];
      if (password) {
        const parts = username ? ['AUTH', username, password] : ['AUTH', password];
        commands.push(
          `*${parts.length}\r\n${parts.map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`).join('')}`,
        );
      }
      commands.push('*1\r\n$4\r\nPING\r\n');
      socket.write(commands.join(''));
    });
  });
}

import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import test from 'node:test';
import { checkRedisConnection } from './infrastructure-checks.mjs';

test('accepts a Redis endpoint that authenticates and answers PONG', async () => {
  const server = createServer((socket) => {
    let source = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      source += chunk;
      if (source.includes('AUTH')) socket.write('+OK\r\n');
      if (source.includes('PING')) socket.write('+PONG\r\n');
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    await checkRedisConnection(
      {
        values: { url: `redis://127.0.0.1:${address.port}` },
        secrets: { password: 'correct-secret' },
      },
      1000,
    );
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test('rejects a Redis endpoint that reports invalid credentials', async () => {
  const server = createServer((socket) =>
    socket.once('data', () => socket.write('-WRONGPASS\r\n')),
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    await assert.rejects(
      checkRedisConnection(
        {
          values: { url: `redis://127.0.0.1:${address.port}` },
          secrets: { password: 'wrong-secret' },
        },
        1000,
      ),
      /鉴权失败/,
    );
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

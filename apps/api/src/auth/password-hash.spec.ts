import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

import { verifyScryptPassword } from './password-hash.js';

const scryptAsync = promisify(scrypt);

describe('verifyScryptPassword', () => {
  it('verifies the encoded format written by the database seed', async () => {
    const salt = randomBytes(16);
    const hash = (await scryptAsync('correct-password', salt, 64)) as Buffer;
    const encoded = `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
    await expect(verifyScryptPassword('correct-password', encoded)).resolves.toBe(true);
    await expect(verifyScryptPassword('wrong-password', encoded)).resolves.toBe(false);
  });

  it('rejects unsupported or malformed hashes', async () => {
    await expect(verifyScryptPassword('password', 'plaintext')).resolves.toBe(false);
  });
});

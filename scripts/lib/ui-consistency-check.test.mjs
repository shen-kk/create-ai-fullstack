import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('skips UI roots removed by feature composition', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ui-check-disabled-web-'));
  try {
    const script = fileURLToPath(new URL('../ui-consistency-check.mjs', import.meta.url));
    const output = execFileSync(process.execPath, [script], {
      cwd: directory,
      encoding: 'utf8',
    });
    assert.match(output, /UI 一致性检查通过/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

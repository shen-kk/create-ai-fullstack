import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import {
  renderProjectContext,
  renderRuntimeProject,
  validateProjectConfig,
} from './lib/template-config.mjs';

const root = new URL('../', import.meta.url);
try {
  const config = JSON.parse(await readFile(new URL('project.config.json', root), 'utf8'));
  const errors = validateProjectConfig(config);
  if (errors.length) throw new Error(errors.join('；'));
  await writeFile(new URL('docs/ai/PROJECT.md', root), renderProjectContext(config), 'utf8');
  await writeFile(
    new URL('apps/admin/src/generated/project.ts', root),
    renderRuntimeProject(config),
    'utf8',
  );
  await writeFile(
    new URL('apps/api/src/generated/project.ts', root),
    renderRuntimeProject(config),
    'utf8',
  );
  console.log('[DONE] AI 项目记忆已与 project.config.json 同步。');
} catch (error) {
  console.error(`[FAIL] 同步失败：${error instanceof Error ? error.message : '未知错误'}`);
  process.exitCode = 1;
}

import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import {
  coreOwnership,
  featureCatalog,
  modulesForFeatures,
  resolveFeatures,
} from '../packages/create-ai-fullstack/lib/features.mjs';
import { validateProjectConfig } from './lib/template-config.mjs';

const root = new URL('../', import.meta.url);
const config = JSON.parse(await readFile(new URL('project.config.json', root), 'utf8'));
const errors = validateProjectConfig(config);
const owners = new Map();
const semanticOwners = new Map();
for (const [category, values] of Object.entries(coreOwnership))
  for (const value of values) semanticOwners.set(`${category}:${value}`, 'core');
for (const feature of featureCatalog) {
  for (const path of feature.ownedPaths ?? []) {
    const previous = owners.get(path);
    if (previous) errors.push(`路径 ${path} 同时归属于 ${previous} 和 ${feature.id}`);
    owners.set(path, feature.id);
  }
  for (const dependency of feature.requires)
    if (!featureCatalog.some((candidate) => candidate.id === dependency))
      errors.push(`${feature.id} 依赖不存在的功能 ${dependency}`);
  for (const [category, values] of Object.entries(feature.ownership ?? {}))
    for (const value of values) {
      const key = `${category}:${value}`;
      const previous = semanticOwners.get(key);
      if (previous) errors.push(`${category} ${value} 同时归属于 ${previous} 和 ${feature.id}`);
      semanticOwners.set(key, feature.id);
    }
}
const resolved = resolveFeatures(config.features ?? []);
const expectedModules = modulesForFeatures(resolved);
for (const [name, enabled] of Object.entries(expectedModules))
  if (config.modules?.[name] !== enabled) errors.push(`modules.${name} 与功能依赖图不一致`);

const exists = async (path) => {
  try {
    await access(new URL(path, root), constants.F_OK);
    return true;
  } catch {
    return false;
  }
};
for (const feature of featureCatalog)
  for (const path of feature.ownedPaths ?? []) {
    const pathExists = await exists(path);
    const enabled = resolved.includes(feature.id);
    if (enabled !== pathExists)
      errors.push(
        enabled
          ? `启用 ${feature.label} 但归属路径不存在：${path}`
          : `未启用 ${feature.label} 但归属路径仍存在：${path}`,
      );
  }

if (errors.length) {
  for (const error of errors) console.error(`[FAIL] ${error}`);
  process.exitCode = 1;
} else
  console.log(
    `[PASS] 功能清单有效：${resolved.join(', ') || '基础平台（未启用用户端）'}；${owners.size} 个路径和 ${semanticOwners.size} 个语义项具有唯一归属。`,
  );

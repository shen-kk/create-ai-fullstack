import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import process from 'node:process';
import {
  featureCatalog,
  modulesForFeatures,
  resolveFeatures,
} from '../packages/create-ai-fullstack/lib/features.mjs';
import {
  renderAdminFeatureRoutes,
  renderApiFeatureModules,
  renderProjectContext,
  renderRuntimeProject,
  validateProjectConfig,
} from './lib/template-config.mjs';

const root = new URL('../', import.meta.url);
const argument = (name) =>
  process.argv
    .slice(2)
    .find((item) => item.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const name = argument('name') ?? 'admin-project';
const displayName = argument('display-name') ?? name;
const packageScope = argument('scope') ?? `@${name}`;
const requestedFeatures = (argument('features') ?? '').split(',').filter(Boolean);
const features = resolveFeatures(requestedFeatures);
const dryRun = process.argv.includes('--dry-run');
const writeJson = async (path, value) =>
  writeFile(new URL(path, root), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const removeComposeService = async (path, service) => {
  const url = new URL(path, root);
  const source = await readFile(url, 'utf8');
  const pattern = new RegExp(`\\n  ${service}:\\r?\\n[\\s\\S]*?(?=\\n  [A-Za-z0-9_-]+:\\r?\\n|$)`);
  await writeFile(url, source.replace(pattern, ''), 'utf8');
};

const replaceWorkspaceScope = async (nextScope) => {
  const contractsPackage = JSON.parse(
    await readFile(new URL('packages/contracts/package.json', root), 'utf8'),
  );
  const currentScope = String(contractsPackage.name).split('/')[0];
  if (currentScope === nextScope) return;
  const allowed = /\.(?:ts|vue|json|html|mjs|yaml|yml|md)$/;
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (['.git', 'node_modules', 'dist', '.nuxt', '.output'].includes(entry.name)) continue;
      const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
      if (entry.isDirectory()) await visit(url);
      else if (allowed.test(entry.name)) {
        const source = await readFile(url, 'utf8');
        if (source.includes(`${currentScope}/`))
          await writeFile(url, source.replaceAll(`${currentScope}/`, `${nextScope}/`), 'utf8');
      }
    }
  };
  await visit(root);
};

const config = {
  $schema: './project.config.schema.json',
  schemaVersion: 2,
  template: {
    name: 'adminback-template',
    version: '0.2.0',
    repository: 'https://github.com/shen-kk/create-ai-fullstack',
  },
  project: { name, packageScope, displayName, description: `${displayName} 全栈项目` },
  runtime: { packageManager: 'pnpm', adminPort: 3000, apiPort: 3001, webPort: 3002 },
  database: { mode: 'prisma', engine: 'postgresql', orm: 'prisma' },
  localization: { defaultLocale: 'zh-CN', supportedLocales: ['zh-CN'] },
  ui: {
    web: {
      businessComponents: 'shadcn-vue',
      motion: 'vueuse-motion',
      orchestration: 'gsap',
      designStandard: 'apple-linear-vercel',
    },
  },
  features,
  modules: modulesForFeatures(features),
  providers: { objectStorage: features.includes('customerAvatar') ? 'resource_library' : 'none' },
};
const errors = validateProjectConfig(config);
if (errors.length) throw new Error(`项目配置无效：${errors.join('；')}`);
if (dryRun) {
  console.log(JSON.stringify(config, null, 2));
  process.exit(0);
}

await writeFile(
  new URL('project.config.json', root),
  `${JSON.stringify(config, null, 2)}\n`,
  'utf8',
);
await writeFile(
  new URL('apps/admin/src/generated/feature-routes.ts', root),
  renderAdminFeatureRoutes(config),
  'utf8',
);
await writeFile(
  new URL('apps/api/src/generated/feature-modules.ts', root),
  renderApiFeatureModules(config),
  'utf8',
);
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
if (features.includes('customerWeb'))
  await writeFile(
    new URL('apps/web/app/generated/project.ts', root),
    renderRuntimeProject(config),
    'utf8',
  );
for (const feature of featureCatalog) {
  if (features.includes(feature.id)) continue;
  for (const path of feature.ownedPaths ?? []) {
    await rm(new URL(path, root), { recursive: true, force: true });
    console.log(`[CUT] ${feature.label}：${path}`);
  }
}
if (!features.includes('customerWeb'))
  await removeComposeService('docker-compose.production.yml', 'web');
if (!features.includes('deploymentCenter')) {
  const rootPackage = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  delete rootPackage.scripts['dev:worker'];
  await writeJson('package.json', rootPackage);
  const apiPackage = JSON.parse(await readFile(new URL('apps/api/package.json', root), 'utf8'));
  delete apiPackage.scripts['start:worker'];
  delete apiPackage.scripts['dev:worker'];
  delete apiPackage.dependencies.ssh2;
  delete apiPackage.devDependencies['@types/ssh2'];
  await writeJson('apps/api/package.json', apiPackage);
}
await replaceWorkspaceScope(packageScope);
console.log(`[DONE] 已组合功能：${features.join(', ') || '仅核心功能'}`);

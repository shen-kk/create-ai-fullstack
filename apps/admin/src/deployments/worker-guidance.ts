export const deploymentWorkerStartGuidance = {
  development: 'pnpm run dev:worker',
  production: 'pnpm --filter @template/api run build\npnpm --filter @template/api run start:worker',
  pm2: 'pm2 start apps/api/dist/src/worker-main.js --name aiforge-deploy-worker\npm2 save',
} as const;

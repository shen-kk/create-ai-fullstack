import { describe, expect, it } from 'vitest';
import { deploymentWorkerStartGuidance } from '../src/deployments/worker-guidance';

describe('deployment worker start guidance', () => {
  it('uses the repository worker scripts for development and production', () => {
    expect(deploymentWorkerStartGuidance.development).toBe('pnpm run dev:worker');
    expect(deploymentWorkerStartGuidance.production).toContain(
      'pnpm --filter @template/api run start:worker',
    );
  });

  it('keeps the production worker alive under its own PM2 process', () => {
    expect(deploymentWorkerStartGuidance.pm2).toContain('aiforge-deploy-worker');
    expect(deploymentWorkerStartGuidance.pm2).toContain('worker-main.js');
    expect(deploymentWorkerStartGuidance.pm2).toContain('pm2 save');
  });
});

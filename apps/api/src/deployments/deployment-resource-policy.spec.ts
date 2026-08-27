import { describe, expect, it } from 'vitest';
import {
  deploymentBuildCommand,
  deploymentBuildHeapMb,
  deploymentMinimumAvailableMb,
  deploymentResourceCheckCommand,
} from './deployment-resource-policy.js';

describe('deployment resource policy', () => {
  it('uses safe defaults and rejects out-of-range settings', () => {
    expect(deploymentBuildHeapMb(undefined)).toBe(768);
    expect(deploymentBuildHeapMb('128')).toBe(768);
    expect(deploymentBuildHeapMb('1024')).toBe(1024);
    expect(deploymentMinimumAvailableMb('not-a-number')).toBe(1536);
    expect(deploymentMinimumAvailableMb('2048')).toBe(2048);
  });

  it('checks combined available memory and swap before building', () => {
    const command = deploymentResourceCheckCommand(1536);

    expect(command).toContain('minimum_kb=1572864');
    expect(command).toContain('MemAvailable');
    expect(command).toContain('SwapFree');
    expect(command).toContain('至少需要 1536 MB');
  });

  it('caps Node heap while preserving the configured command as one shell argument', () => {
    expect(deploymentBuildCommand("pnpm --filter 'my app' build", 768)).toBe(
      "env NODE_OPTIONS='--max-old-space-size=768' sh -c 'pnpm --filter '\\''my app'\\'' build'",
    );
  });
});

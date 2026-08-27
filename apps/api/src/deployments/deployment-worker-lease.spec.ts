import { describe, expect, it } from 'vitest';
import {
  deploymentCommandTimeoutMs,
  deploymentWorkerHeartbeatMs,
  deploymentWorkerLeaseMs,
  deploymentWorkerLegacyStaleMs,
} from './deployment-worker-lease.js';

describe('deployment worker lease policy', () => {
  it('uses safe defaults and rejects leases that are too short', () => {
    expect(deploymentWorkerLeaseMs(undefined)).toBe(30_000);
    expect(deploymentWorkerLeaseMs('5000')).toBe(30_000);
    expect(deploymentWorkerLeaseMs('60000')).toBe(60_000);
    expect(deploymentWorkerHeartbeatMs(30_000)).toBe(10_000);
  });

  it('keeps legacy recovery and command timeout independently configurable', () => {
    expect(deploymentWorkerLegacyStaleMs(undefined)).toBe(7_200_000);
    expect(deploymentWorkerLegacyStaleMs('900000')).toBe(900_000);
    expect(deploymentCommandTimeoutMs(undefined)).toBe(1_800_000);
    expect(deploymentCommandTimeoutMs('120000')).toBe(120_000);
  });
});

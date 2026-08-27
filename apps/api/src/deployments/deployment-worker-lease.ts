export function deploymentWorkerLeaseMs(configuredValue: string | undefined): number {
  const configured = Number(configuredValue);
  return Number.isFinite(configured) && configured >= 15_000 ? configured : 30_000;
}

export function deploymentWorkerHeartbeatMs(leaseMs: number): number {
  return Math.max(2_000, Math.floor(leaseMs / 3));
}

export function deploymentWorkerLegacyStaleMs(configuredValue: string | undefined): number {
  const configured = Number(configuredValue);
  return Number.isFinite(configured) && configured > 0 ? configured : 2 * 60 * 60 * 1000;
}

export function deploymentCommandTimeoutMs(configuredValue: string | undefined): number {
  const configured = Number(configuredValue);
  return Number.isFinite(configured) && configured >= 1_000 ? configured : 30 * 60 * 1000;
}

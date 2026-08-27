const stepErrorCodes: Record<string, string> = {
  prepare: 'DEPLOYMENT_SSH_FAILED',
  checkout: 'DEPLOYMENT_GIT_FAILED',
  install: 'DEPLOYMENT_INSTALL_FAILED',
  build: 'DEPLOYMENT_BUILD_FAILED',
  migrate: 'DEPLOYMENT_MIGRATION_FAILED',
  switch: 'DEPLOYMENT_SWITCH_FAILED',
  restart: 'DEPLOYMENT_RESTART_FAILED',
  health: 'DEPLOYMENT_HEALTH_CHECK_FAILED',
  finalize: 'DEPLOYMENT_FINALIZE_FAILED',
};

export function deploymentErrorCode(step: string | null, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message === 'DEPLOYMENT_COMMAND_TIMEOUT') return 'DEPLOYMENT_COMMAND_TIMEOUT';
  if (message.startsWith('DEPLOYMENT_SNAPSHOT_')) return message;
  return (step && stepErrorCodes[step]) || 'DEPLOYMENT_EXECUTION_FAILED';
}

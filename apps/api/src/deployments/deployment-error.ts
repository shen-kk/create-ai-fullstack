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
  if (message === 'DEPLOYMENT_SECRETS_REENTRY_REQUIRED') return message;
  if (message.startsWith('DEPLOYMENT_SNAPSHOT_')) return message;
  return (step && stepErrorCodes[step]) || 'DEPLOYMENT_EXECUTION_FAILED';
}

export function deploymentErrorMessage(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);
  if (message === 'DEPLOYMENT_SECRETS_REENTRY_REQUIRED')
    return '部署敏感配置无法解密，请确认 API 与 Worker 使用相同的 CONFIG_ENCRYPTION_KEY；旧密钥无法恢复时，请重新填写并保存相关资源密钥。';
  return null;
}

const packagesByTask = Object.freeze({
  dev: ['@template/admin', '@template/api'],
  build: ['@template/admin', '@template/api'],
  lint: ['@template/admin', '@template/api', '@template/contracts'],
  typecheck: ['@template/admin', '@template/api'],
  test: ['@template/admin', '@template/api', '@template/contracts'],
});

export function enabledPackages(config, task) {
  const baseline = packagesByTask[task];
  if (!baseline) throw new Error(`未知任务：${task}`);
  return config.modules.userWeb && config.modules.customerAuthentication
    ? [...baseline, '@template/web']
    : [...baseline];
}

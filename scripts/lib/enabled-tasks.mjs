const packageNamesByTask = Object.freeze({
  dev: ['admin', 'api'],
  build: ['admin', 'api'],
  lint: ['admin', 'api', 'contracts'],
  typecheck: ['admin', 'api'],
  test: ['admin', 'api', 'contracts'],
});

export function enabledPackages(config, task) {
  const packageNames = packageNamesByTask[task];
  if (!packageNames) throw new Error(`未知任务：${task}`);
  const scope = config.project.packageScope;
  const baseline = packageNames.map((name) => `${scope}/${name}`);
  return config.modules.userWeb && config.modules.customerAuthentication
    ? [...baseline, `${scope}/web`]
    : [...baseline];
}

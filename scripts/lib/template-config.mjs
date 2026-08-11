export const coreModules = Object.freeze({
  authentication: true,
  adminUsers: true,
  rolesAndPermissions: true,
  auditLogs: true,
  serviceConfig: true,
});

export function presetModules(preset) {
  if (preset === 'standard')
    return {
      ...coreModules,
      customerAuthentication: false,
      userWeb: false,
      objectStorage: true,
      redis: true,
      sms: false,
      email: true,
      payment: false,
    };
  return {
    ...coreModules,
    customerAuthentication: false,
    userWeb: false,
    objectStorage: true,
    redis: false,
    sms: false,
    email: false,
    payment: false,
  };
}

export function validateProjectConfig(config) {
  const errors = [];
  if (config?.schemaVersion !== 1) errors.push('schemaVersion 必须为 1');
  try {
    new URL(config?.template?.repository);
  } catch {
    errors.push('template.repository 必须是有效 URL');
  }
  if (!/^[a-z][a-z0-9-]{1,62}$/.test(config?.project?.name ?? ''))
    errors.push('project.name 格式无效');
  if (!/^@[a-z][a-z0-9-]{1,62}$/.test(config?.project?.packageScope ?? ''))
    errors.push('project.packageScope 格式无效');
  const adminPort = config?.runtime?.adminPort,
    apiPort = config?.runtime?.apiPort,
    webPort = config?.runtime?.webPort;
  if (!Number.isInteger(adminPort) || adminPort < 1024 || adminPort > 65535)
    errors.push('runtime.adminPort 无效');
  if (!Number.isInteger(apiPort) || apiPort < 1024 || apiPort > 65535)
    errors.push('runtime.apiPort 无效');
  if (!Number.isInteger(webPort) || webPort < 1024 || webPort > 65535)
    errors.push('runtime.webPort 无效');
  if (new Set([adminPort, apiPort, webPort]).size !== 3)
    errors.push('Admin、API 与 Web 端口不能相同');
  if (config?.database?.mode !== 'prisma')
    errors.push('database.mode 必须为 prisma，模板不支持内存模式');
  if (
    config?.localization?.defaultLocale !== 'zh-CN' ||
    !config?.localization?.supportedLocales?.includes('zh-CN')
  )
    errors.push('当前版本默认语言必须为 zh-CN');
  if (
    config?.ui?.web?.businessComponents !== 'shadcn-vue' ||
    config?.ui?.web?.motion !== 'vueuse-motion' ||
    config?.ui?.web?.orchestration !== 'gsap' ||
    config?.ui?.web?.designStandard !== 'apple-linear-vercel'
  )
    errors.push('用户端 UI 必须使用 shadcn-vue 业务组件与 VueUse Motion 动效层');
  if (config?.database?.engine !== 'postgresql' || config?.database?.orm !== 'prisma')
    errors.push('Prisma 模式当前只支持 PostgreSQL');
  for (const [name, enabled] of Object.entries(coreModules))
    if (config?.modules?.[name] !== enabled) errors.push(`核心模块 ${name} 必须启用`);
  if (config?.modules?.userWeb !== config?.modules?.customerAuthentication)
    errors.push('userWeb 与 customerAuthentication 必须同时启用或停用');
  if (config?.modules?.userWeb && (!config?.modules?.sms || !config?.modules?.redis))
    errors.push('启用用户端身份时必须同时启用 sms 与 redis');
  if (
    config?.modules?.objectStorage &&
    (!config?.providers?.objectStorage || config.providers.objectStorage === 'none')
  )
    errors.push('启用对象存储时必须声明服务商');
  return errors;
}

export function parseEnv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=');
        return index < 0 ? [line, ''] : [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

export function renderProjectContext(config) {
  const enabled = Object.entries(config.modules)
    .filter(([, value]) => value)
    .map(([name]) => `- \`${name}\``)
    .join('\n');
  const disabled =
    Object.entries(config.modules)
      .filter(([, value]) => !value)
      .map(([name]) => `- \`${name}\``)
      .join('\n') || '- 无';
  return `# 当前项目声明（自动生成）

> 本文件由 \`pnpm template:init\` 根据 \`project.config.json\` 生成。不要手工修改；需要调整能力时重新运行初始化命令。

## 项目

- 英文标识：\`${config.project.name}\`
- 显示名称：${config.project.displayName}
- 包命名空间：\`${config.project.packageScope}\`
- 用途：${config.project.description || '未填写'}
- 模板版本：\`${config.template.version}\`
- 模板仓库：${config.template.repository}

## 运行与数据

- 后台端口：\`${config.runtime.adminPort}\`
- API 端口：\`${config.runtime.apiPort}\`
- 用户端口：\`${config.runtime.webPort}\`
- 数据模式：\`${config.database.mode}\`
- 数据库：\`${config.database.engine}\`
- ORM：\`${config.database.orm}\`
- 默认语言：\`${config.localization.defaultLocale}\`
- 用户端业务组件：\`${config.ui.web.businessComponents}\`
- 用户端动效：\`${config.ui.web.motion}\`
- 用户端动画编排：\`${config.ui.web.orchestration}\`
- 用户端设计标准：\`${config.ui.web.designStandard}\`
- 默认对象存储：\`${config.providers.objectStorage}\`

## 已启用能力

${enabled}

## 未启用能力

${disabled}

## AI 实现约束

- 开始开发前以 \`project.config.json\` 和本文件确认项目边界。
- 不得使用未启用能力；如需求需要，应先更新项目声明并说明影响。
- 密码、数据库连接串和服务密钥只存在于环境变量或加密配置中，不得写入本文档。
- 用户端身份与后台管理员身份必须保持隔离；具体项目不得绕过 API 直接访问数据层。
`;
}

export function provisionCommands(config) {
  if (config.database.mode !== 'prisma' || config.database.engine !== 'postgresql')
    throw new Error('当前只支持 PostgreSQL + Prisma 自动部署');
  const scope = config.project.packageScope;
  return [
    ['--filter', `${scope}/contracts`, 'build'],
    ['--filter', `${scope}/api`, 'db:generate'],
    ['--filter', `${scope}/api`, 'exec', 'prisma', 'migrate', 'deploy'],
    ['--filter', `${scope}/api`, 'db:seed'],
  ];
}

export function renderRuntimeProject(config) {
  return `// 此文件由 pnpm template:init / template:sync 自动生成，请勿手工修改。\nexport const project = ${JSON.stringify({ name: config.project.name, packageScope: config.project.packageScope, displayName: config.project.displayName, description: config.project.description, runtime: config.runtime, database: config.database, localization: config.localization, ui: config.ui, modules: config.modules, providers: config.providers }, null, 2)} as const;\n`;
}

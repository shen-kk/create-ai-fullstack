export const coreModules = Object.freeze({
  authentication: true,
  adminUsers: true,
  rolesAndPermissions: true,
  auditLogs: true,
  serviceConfig: true,
});

export const coreOwnership = Object.freeze({
  apiModules: [
    'DatabaseModule',
    'AuthModule',
    'UsersModule',
    'AuditModule',
    'HealthModule',
    'IntegrationsModule',
  ],
  prismaModels: [
    'User',
    'Role',
    'Permission',
    'UserRole',
    'RolePermission',
    'RefreshSession',
    'AuditLog',
    'IntegrationConfig',
    'ServiceResource',
    'ServiceFeatureBinding',
    'MessageTemplate',
  ],
  permissions: [
    'menu.dashboard',
    'menu.users',
    'menu.roles',
    'menu.audit',
    'menu.system',
    'menu.integrations',
  ],
  environment: [
    'DATABASE_URL',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'CONFIG_ENCRYPTION_KEY',
    'DEV_ADMIN_PHONE',
    'DEV_ADMIN_PASSWORD',
  ],
});

export const featureCatalog = Object.freeze([
  {
    id: 'customerWeb',
    label: '用户端基础应用',
    hint: 'Nuxt 用户端、用户账号、会话、个人中心和后台用户管理',
    group: '用户端',
    requires: [],
    modules: {
      userWeb: true,
      customerAuthentication: true,
      redis: true,
      email: true,
      sms: true,
    },
    ownedPaths: [
      'apps/web',
      'apps/api/src/customer-auth',
      'apps/admin/src/api/customers.ts',
      'apps/admin/src/api/verification.ts',
      'apps/admin/src/views/CustomersView.vue',
      'apps/admin/src/views/VerificationDeliveriesView.vue',
    ],
    sharedCapabilities: ['verification', 'messaging'],
    ownership: {
      apiModules: ['CustomerAuthModule'],
      prismaModels: [
        'Customer',
        'CustomerAuthSetting',
        'VerificationCode',
        'CustomerRefreshSession',
      ],
      permissions: [
        'menu.customers',
        'customers.read',
        'customers.write',
        'menu.verification',
        'verification.read',
      ],
      environment: ['CUSTOMER_JWT_ACCESS_SECRET', 'CUSTOMER_JWT_REFRESH_SECRET'],
      featureBindings: [
        'customer.login.email',
        'customer.login.sms',
        'customer.password.email',
        'customer.password.sms',
        'customer.contact.email',
        'customer.contact.sms',
      ],
    },
  },
  {
    id: 'customerAvatar',
    label: '用户头像上传',
    hint: '用户端头像上传和对象存储绑定',
    group: '用户端',
    requires: ['customerWeb'],
    modules: { objectStorage: true },
    sharedCapabilities: ['objectStorage'],
    ownership: {
      apiCapabilities: ['customer-avatar-upload'],
      featureBindings: ['customer.avatar'],
    },
  },
  {
    id: 'deploymentCenter',
    label: '部署中心',
    hint: '部署项目、环境、Worker、实时日志和回滚',
    group: '平台能力',
    requires: [],
    modules: { deploymentCenter: true },
    ownedPaths: [
      'apps/api/src/deployments',
      'apps/api/src/worker-main.ts',
      'apps/admin/src/api/deployments.ts',
      'apps/admin/src/views/DeploymentProjectsView.vue',
      'apps/admin/src/views/DeploymentProjectFormView.vue',
      'apps/admin/src/views/DeploymentsView.vue',
      'apps/admin/src/views/DeploymentEnvironmentFormView.vue',
      'apps/admin/src/views/DeploymentHistoryView.vue',
      'apps/admin/src/views/DeploymentRunView.vue',
    ],
    ownership: {
      apiModules: ['DeploymentsModule', 'DeploymentWorkerModule'],
      prismaModels: [
        'DeployProject',
        'DeployEnvironment',
        'DeployRun',
        'DeployStep',
        'DeployLog',
        'DeployRelease',
      ],
      permissions: [
        'menu.deployments',
        'deployments.read',
        'deployments.manage',
        'deployments.execute',
      ],
      environment: ['DEPLOY_WORKER_ENABLED'],
    },
  },
]);

const byId = new Map(featureCatalog.map((feature) => [feature.id, feature]));

export function resolveFeatures(selectedIds) {
  const resolved = new Set();
  const visit = (id, chain = []) => {
    const feature = byId.get(id);
    if (!feature) throw new Error(`未知功能：${id}`);
    if (chain.includes(id)) throw new Error(`功能依赖出现循环：${[...chain, id].join(' -> ')}`);
    if (resolved.has(id)) return;
    for (const dependency of feature.requires) visit(dependency, [...chain, id]);
    resolved.add(id);
  };
  for (const id of selectedIds) visit(id);
  return [...resolved];
}

export function modulesForFeatures(selectedIds) {
  const modules = {
    ...coreModules,
    customerAuthentication: false,
    userWeb: false,
    objectStorage: false,
    redis: false,
    sms: false,
    email: false,
    payment: false,
    deploymentCenter: false,
  };
  for (const id of resolveFeatures(selectedIds))
    Object.assign(modules, byId.get(id)?.modules ?? {});
  return modules;
}

export function featureById(id) {
  return byId.get(id);
}

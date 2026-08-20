import { createRouter, createWebHistory } from 'vue-router';
import { getCurrentUser, restoreSession } from '../auth/session';
import { project } from '../generated/project';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('../views/DashboardView.vue'),
      meta: { title: '工作台', permissions: ['menu.dashboard'] },
    },
    {
      path: '/users',
      component: () => import('../views/UsersView.vue'),
      meta: { title: '管理员', permissions: ['menu.users', 'users.read'] },
    },
    ...(project.modules.userWeb && project.modules.customerAuthentication
      ? [
          {
            path: '/customers',
            component: () => import('../views/CustomersView.vue'),
            meta: { title: '用户端用户', permissions: ['menu.customers', 'customers.read'] },
          },
          {
            path: '/verification-deliveries',
            component: () => import('../views/VerificationDeliveriesView.vue'),
            meta: { title: '验证码记录', permissions: ['menu.verification', 'verification.read'] },
          },
        ]
      : []),
    {
      path: '/logs',
      component: () => import('../views/AuditLogsView.vue'),
      meta: { title: '操作日志', permissions: ['menu.audit', 'audit.read'] },
    },
    {
      path: '/roles',
      component: () => import('../views/RolesView.vue'),
      meta: { title: '角色权限', permissions: ['menu.roles', 'roles.manage'] },
    },
    {
      path: '/system',
      component: () => import('../views/SystemView.vue'),
      meta: { title: '系统信息', permissions: ['menu.system', 'system.read'] },
    },
    {
      path: '/profile',
      component: () => import('../views/ProfileView.vue'),
      meta: { title: '个人中心' },
    },
    {
      path: '/integrations',
      redirect: '/integrations/resources',
      meta: { title: '服务配置', permissions: ['menu.integrations', 'integrations.manage'] },
    },
    {
      path: '/integrations/resources',
      component: () => import('../views/IntegrationsView.vue'),
      meta: { title: '服务资源', permissions: ['menu.integrations', 'integrations.manage'] },
    },
    {
      path: '/integrations/bindings',
      component: () => import('../views/IntegrationsView.vue'),
      meta: { title: '功能绑定', permissions: ['menu.integrations', 'integrations.manage'] },
    },
    {
      path: '/integrations/templates',
      component: () => import('../views/IntegrationsView.vue'),
      meta: { title: '消息模板', permissions: ['menu.integrations', 'integrations.manage'] },
    },
    ...(project.modules.deploymentCenter
      ? [
          {
            path: '/deployments',
            component: () => import('../views/DeploymentProjectsView.vue'),
            meta: { title: '部署中心', permissions: ['menu.deployments', 'deployments.read'] },
          },
          {
            path: '/deployments/projects',
            redirect: '/deployments',
            meta: { title: '部署项目', permissions: ['menu.deployments', 'deployments.read'] },
          },
          {
            path: '/deployments/projects/new',
            component: () => import('../views/DeploymentProjectFormView.vue'),
            meta: {
              title: '新增部署项目',
              permissions: ['menu.deployments', 'deployments.manage'],
            },
          },
          {
            path: '/deployments/projects/:id/edit',
            component: () => import('../views/DeploymentProjectFormView.vue'),
            meta: {
              title: '编辑部署项目',
              permissions: ['menu.deployments', 'deployments.manage'],
            },
          },
          {
            path: '/deployments/projects/:projectId',
            component: () => import('../views/DeploymentsView.vue'),
            meta: { title: '项目环境', permissions: ['menu.deployments', 'deployments.read'] },
          },
          {
            path: '/deployments/new',
            component: () => import('../views/DeploymentEnvironmentFormView.vue'),
            meta: {
              title: '新增部署环境',
              permissions: ['menu.deployments', 'deployments.manage'],
            },
          },
          {
            path: '/deployments/history',
            component: () => import('../views/DeploymentHistoryView.vue'),
            meta: { title: '部署记录', permissions: ['menu.deployments', 'deployments.read'] },
          },
          {
            path: '/deployments/:id/edit',
            component: () => import('../views/DeploymentEnvironmentFormView.vue'),
            meta: {
              title: '编辑部署环境',
              permissions: ['menu.deployments', 'deployments.manage'],
            },
          },
          {
            path: '/deployments/runs/:runId',
            component: () => import('../views/DeploymentRunView.vue'),
            meta: { title: '部署进度', permissions: ['menu.deployments', 'deployments.read'] },
          },
        ]
      : []),
    {
      path: '/login',
      component: () => import('../views/LoginView.vue'),
      meta: { title: '登录', public: true },
    },
    {
      path: '/403',
      component: () => import('../views/ForbiddenView.vue'),
      meta: { title: '没有权限' },
    },
    {
      path: '/:pathMatch(.*)*',
      component: () => import('../views/NotFoundView.vue'),
      meta: { title: '页面不存在' },
    },
  ],
});

window.addEventListener('template-auth-expired', () => {
  if (router.currentRoute.value.meta.public) return;
  void router.replace({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } });
});

router.beforeEach(async (to) => {
  if (to.meta.public) return true;
  if (!(await restoreSession())) return { path: '/login', query: { redirect: to.fullPath } };
  const required = Array.isArray(to.meta.permissions)
    ? to.meta.permissions.filter((item): item is string => typeof item === 'string')
    : [];
  const granted = new Set(getCurrentUser()?.permissions ?? []);
  if (required.some((permission) => !granted.has(permission))) return { path: '/403' };
  return true;
});

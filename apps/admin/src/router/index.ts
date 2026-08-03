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
      component: () => import('../views/IntegrationsView.vue'),
      meta: { title: '服务配置', permissions: ['menu.integrations', 'integrations.manage'] },
    },
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

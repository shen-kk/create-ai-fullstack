// 此文件由项目组合器 / template:sync 自动生成，请勿手工修改。
import type { RouteRecordRaw } from 'vue-router';

export const featureRoutes: RouteRecordRaw[] = [
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
    meta: { title: '新增部署项目', permissions: ['menu.deployments', 'deployments.manage'] },
  },
  {
    path: '/deployments/projects/:id/edit',
    component: () => import('../views/DeploymentProjectFormView.vue'),
    meta: { title: '编辑部署项目', permissions: ['menu.deployments', 'deployments.manage'] },
  },
  {
    path: '/deployments/projects/:projectId',
    component: () => import('../views/DeploymentsView.vue'),
    meta: { title: '项目环境', permissions: ['menu.deployments', 'deployments.read'] },
  },
  {
    path: '/deployments/new',
    component: () => import('../views/DeploymentEnvironmentFormView.vue'),
    meta: { title: '新增部署环境', permissions: ['menu.deployments', 'deployments.manage'] },
  },
  {
    path: '/deployments/history',
    component: () => import('../views/DeploymentHistoryView.vue'),
    meta: { title: '部署记录', permissions: ['menu.deployments', 'deployments.read'] },
  },
  {
    path: '/deployments/:id/edit',
    component: () => import('../views/DeploymentEnvironmentFormView.vue'),
    meta: { title: '编辑部署环境', permissions: ['menu.deployments', 'deployments.manage'] },
  },
  {
    path: '/deployments/runs/:runId',
    component: () => import('../views/DeploymentRunView.vue'),
    meta: { title: '部署进度', permissions: ['menu.deployments', 'deployments.read'] },
  },
];

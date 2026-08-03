<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { AuthUser } from '@template/contracts';
import { getCurrentUser, logout } from './auth/session';
import AppIcon from './components/AppIcon.vue';
import { project } from './generated/project';

const sidebarOpen = ref(false);
const route = useRoute();
const router = useRouter();
const currentUser = ref<AuthUser | null>(getCurrentUser());
const pageTitle = computed(() => String(route.meta.title ?? '管理后台'));
const initials = computed(() => currentUser.value?.name.slice(0, 2).toUpperCase() || 'AD');
watch(
  () => route.fullPath,
  () => {
    currentUser.value = getCurrentUser();
  },
);
async function signOut(): Promise<void> {
  await logout();
  currentUser.value = null;
  await router.replace('/login');
}

interface MenuItem {
  label: string;
  path: string;
  badge: string;
  implemented: boolean;
  permissions: string[];
  icon: 'home' | 'users' | 'shield' | 'logs' | 'system';
  enabled?: boolean;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    label: '概览',
    items: [
      {
        label: '工作台',
        path: '/',
        badge: '',
        implemented: true,
        permissions: ['menu.dashboard'],
        icon: 'home',
      },
    ],
  },
  {
    label: '用户运营',
    items: [
      {
        label: '用户端用户',
        path: '/customers',
        badge: '',
        implemented: true,
        enabled: project.modules.userWeb && project.modules.customerAuthentication,
        permissions: ['menu.customers', 'customers.read'],
        icon: 'users',
      },
      {
        label: '验证码记录',
        path: '/verification-deliveries',
        badge: '',
        implemented: true,
        enabled: project.modules.userWeb && project.modules.customerAuthentication,
        permissions: ['menu.verification', 'verification.read'],
        icon: 'logs',
      },
    ],
  },
  {
    label: '系统管理',
    items: [
      {
        label: '管理员',
        path: '/users',
        badge: '',
        implemented: true,
        permissions: ['menu.users', 'users.read'],
        icon: 'users',
      },
      {
        label: '角色权限',
        path: '/roles',
        badge: '',
        implemented: true,
        permissions: ['menu.roles', 'roles.manage'],
        icon: 'shield',
      },
      {
        label: '操作日志',
        path: '/logs',
        badge: '',
        implemented: true,
        permissions: ['menu.audit', 'audit.read'],
        icon: 'logs',
      },
      {
        label: '系统信息',
        path: '/system',
        badge: '',
        implemented: true,
        permissions: ['menu.system', 'system.read'],
        icon: 'system',
      },
      {
        label: '服务配置',
        path: '/integrations',
        badge: '',
        implemented: true,
        permissions: ['menu.integrations', 'integrations.manage'],
        icon: 'system',
      },
    ],
  },
];
function canAccess(item: MenuItem): boolean {
  if (item.enabled === false) return false;
  const granted = new Set(currentUser.value?.permissions ?? []);
  return item.permissions.every((permission) => granted.has(permission));
}
</script>

<template>
  <router-view v-if="route.meta.public" />
  <div v-else class="admin-shell">
    <button
      class="mobile-overlay"
      :class="{ visible: sidebarOpen }"
      aria-label="关闭导航"
      @click="sidebarOpen = false"
    />

    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="brand">
        <span class="brand-mark">{{ project.displayName.slice(0, 1).toUpperCase() }}</span>
        <span
          ><strong>{{ project.displayName }}</strong
          ><small>运营管理平台</small></span
        >
      </div>

      <nav aria-label="主导航">
        <section v-for="group in menuGroups" :key="group.label" class="menu-group">
          <p class="menu-label">{{ group.label }}</p>
          <template v-for="item in group.items" :key="item.path">
            <router-link
              v-if="item.implemented && canAccess(item)"
              :to="item.path"
              class="menu-item"
              @click="sidebarOpen = false"
            >
              <AppIcon :name="item.icon" />
              <span>{{ item.label }}</span>
              <span v-if="item.badge" class="menu-badge">{{ item.badge }}</span>
            </router-link>
            <span
              v-else-if="!item.implemented"
              class="menu-item disabled"
              :title="`${item.label}模块待接入`"
            >
              <span class="menu-dot" />
              <span>{{ item.label }}</span>
              <span v-if="item.badge" class="menu-badge">{{ item.badge }}</span>
            </span>
          </template>
        </section>
      </nav>

      <div class="sidebar-footer">
        <router-link to="/profile" class="sidebar-profile" title="个人中心"
          ><div class="avatar">
            <img v-if="currentUser?.avatarUrl" :src="currentUser.avatarUrl" alt="" /><span v-else>{{
              initials
            }}</span>
          </div>
          <div>
            <strong>{{ currentUser?.name || '管理员' }}</strong
            ><small>{{ currentUser?.phone || '未加载身份' }}</small>
          </div></router-link
        >
        <button class="logout-button" aria-label="退出登录" title="退出登录" @click="signOut">
          <AppIcon name="logout" />
        </button>
      </div>
    </aside>

    <section class="workspace">
      <header class="topbar">
        <button class="mobile-menu-button" aria-label="打开导航" @click="sidebarOpen = true">
          ☰
        </button>
        <div class="breadcrumb">
          <span>{{ project.displayName }}</span
          ><b>/</b><strong>{{ pageTitle }}</strong>
        </div>
      </header>

      <main class="page-content"><router-view /></main>
    </section>
  </div>
</template>

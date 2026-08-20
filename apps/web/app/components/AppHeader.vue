<script setup lang="ts">
const route = useRoute();
const { customer, logout } = useCustomerSession();
const menuOpen = ref(false);
const accountOpen = ref(false);
watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false;
    accountOpen.value = false;
  },
);
async function signOut(): Promise<void> {
  try {
    await logout();
  } finally {
    accountOpen.value = false;
    await navigateTo('/');
  }
}
</script>

<template>
  <header class="site-header">
    <div class="header-inner">
      <AppLogo />
      <button
        class="menu-button"
        type="button"
        :aria-expanded="menuOpen"
        aria-label="切换导航"
        @click="menuOpen = !menuOpen"
      >
        <span /><span />
      </button>
      <nav :class="['site-nav', { open: menuOpen }]" aria-label="主导航">
        <NuxtLink to="/">使用指南</NuxtLink>
        <a href="/#architecture">项目组成</a>
        <a href="/#quick-start">快速开始</a>
        <a href="/#configuration">服务配置</a>
        <template v-if="customer">
          <div class="account-menu" :class="{ open: accountOpen }">
            <button
              class="account-trigger"
              type="button"
              :aria-expanded="accountOpen"
              aria-haspopup="menu"
              @click="accountOpen = !accountOpen"
            >
              <span class="avatar-mini"
                ><img v-if="customer.avatarUrl" :src="customer.avatarUrl" alt="" /><template
                  v-else
                  >{{ customer.name.slice(0, 1) }}</template
                ></span
              >
              <span class="account-trigger-copy"
                ><strong>{{ customer.name }}</strong
                ><small>个人账号</small></span
              >
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg>
            </button>
            <div class="account-dropdown" role="menu">
              <div class="account-dropdown-head">
                <span class="account-avatar-large"
                  ><img v-if="customer.avatarUrl" :src="customer.avatarUrl" alt="" /><template
                    v-else
                    >{{ customer.name.slice(0, 1) }}</template
                  ></span
                >
                <div>
                  <strong>{{ customer.name }}</strong
                  ><small>{{ customer.phone || customer.email || '未绑定账号' }}</small>
                </div>
                <i title="账号正常" />
              </div>
              <div class="account-dropdown-links">
                <NuxtLink to="/profile" role="menuitem">
                  <svg viewBox="0 0 24 24">
                    <path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
                  </svg>
                  <span><strong>个人中心</strong><small>资料与安全设置</small></span
                  ><b>›</b>
                </NuxtLink>
                <button type="button" role="menuitem" @click="signOut">
                  <svg viewBox="0 0 24 24"><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" /></svg>
                  <span><strong>退出登录</strong><small>安全结束当前会话</small></span>
                </button>
              </div>
            </div>
          </div>
        </template>
        <template v-else>
          <NuxtLink to="/login">登录</NuxtLink>
          <Button as-child size="sm"><NuxtLink to="/login">开始使用</NuxtLink></Button>
        </template>
      </nav>
    </div>
  </header>
</template>

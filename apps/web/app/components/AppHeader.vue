<script setup lang="ts">
const route = useRoute();
const { customer, logout } = useCustomerSession();
const menuOpen = ref(false);
watch(
  () => route.fullPath,
  () => (menuOpen.value = false),
);
async function signOut(): Promise<void> {
  await logout();
  await navigateTo('/');
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
        <NuxtLink to="/">产品</NuxtLink>
        <a href="/#capabilities">能力</a>
        <a href="/#principles">原则</a>
        <template v-if="customer">
          <NuxtLink class="nav-profile" to="/profile">
            <span class="avatar-mini">{{ customer.name.slice(0, 1) }}</span>
            {{ customer.name }}
          </NuxtLink>
          <button class="nav-quiet" type="button" @click="signOut">退出</button>
        </template>
        <template v-else>
          <NuxtLink to="/login">登录</NuxtLink>
          <Button as-child size="sm"><NuxtLink to="/register">开始使用</NuxtLink></Button>
        </template>
      </nav>
    </div>
  </header>
</template>

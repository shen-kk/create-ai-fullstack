<script setup lang="ts">
import AppFooter from './components/AppFooter.vue';
import AppHeader from './components/AppHeader.vue';
import { project } from './generated/project';
const { restore } = useCustomerSession();
onMounted(() => {
  if (project.modules.userWeb && project.modules.customerAuthentication) void restore();
});
</script>

<template>
  <div v-if="project.modules.userWeb && project.modules.customerAuthentication" class="app-shell">
    <AppHeader />
    <AppToast />
    <NuxtRouteAnnouncer />
    <NuxtPage />
    <AppFooter />
  </div>
  <main v-else class="module-disabled">
    <p class="eyebrow"><span /> OPTIONAL MODULE</p>
    <h1>用户端未启用</h1>
    <p>需要使用用户端时，请重新运行初始化命令并选择“启用用户端”。</p>
  </main>
</template>

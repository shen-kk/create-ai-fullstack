<script setup lang="ts">
import { useRouter } from 'vue-router';
const router = useRouter();
</script>
<template>
  <section class="not-found panel">
    <p class="eyebrow">403 · FORBIDDEN</p>
    <strong>没有访问权限</strong>
    <p>当前账号缺少进入此模块所需的权限。如有需要，请联系管理员调整角色。</p>
    <button class="primary-button" @click="router.push('/')">返回工作台</button>
  </section>
</template>

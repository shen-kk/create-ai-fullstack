<script setup lang="ts">
import { useRouter } from 'vue-router';
const router = useRouter();
</script>
<template>
  <section class="not-found panel">
    <p class="eyebrow">404 · NOT FOUND</p>
    <strong>页面不存在</strong>
    <p>你访问的地址不存在，或该模块尚未加入当前项目。</p>
    <button class="primary-button" @click="router.push('/')">返回工作台</button>
  </section>
</template>

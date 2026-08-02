<script setup lang="ts">
import type { HealthResponse } from '@template/contracts';

const config = useRuntimeConfig();
const { data: health, error } = await useFetch<HealthResponse>('/health', {
  baseURL: config.public.apiBaseUrl,
});

useSeoMeta({
  title: 'AI Friendly Template',
  description: '面向 AI 协作开发的全栈项目模板',
});
</script>

<template>
  <main class="container">
    <p class="eyebrow">AI-FRIENDLY MONOREPO</p>
    <h1>让项目规范成为<br /><span>AI 可读取的长期记忆</span></h1>
    <p class="lead">后台、用户端、API 与共享契约已经建立清晰边界。</p>
    <section class="status" aria-live="polite">
      <strong>API 状态</strong>
      <span v-if="health" class="ok">● {{ health.status }}</span>
      <span v-else-if="error" class="error">● unavailable</span>
      <span v-else>检查中…</span>
    </section>
  </main>
</template>

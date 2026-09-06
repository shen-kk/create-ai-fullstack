<script setup lang="ts">
import { project } from '../generated/project';
</script>

<template>
  <NuxtLink class="brand" to="/" aria-label="返回首页">
    <span class="brand-mark" aria-hidden="true"><i /><i /></span>
    <span>{{ project.displayName }}</span>
  </NuxtLink>
</template>

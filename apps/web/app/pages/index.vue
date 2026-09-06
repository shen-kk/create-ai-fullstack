<script setup lang="ts">
import { project } from '../generated/project';

const { customer } = useCustomerSession();
const requestUrl = useRequestURL();
const canonicalUrl = new URL('/', requestUrl.origin).toString();

useSeoMeta({
  title: project.displayName,
  description: project.description,
  ogTitle: project.displayName,
  ogDescription: project.description,
  ogUrl: canonicalUrl,
});
useHead({ link: [{ rel: 'canonical', href: canonicalUrl }] });
</script>

<template>
  <main class="home-page">
    <section class="home-entry section-wrap">
      <p class="eyebrow"><span /> WELCOME</p>
      <h1>{{ project.displayName }}</h1>
      <p>{{ project.description }}</p>
      <Button as-child size="lg">
        <NuxtLink :to="customer ? '/profile' : '/login'">
          {{ customer ? '进入个人中心' : '登录或创建账号' }}
        </NuxtLink>
      </Button>
    </section>
  </main>
</template>

<script setup lang="ts">
import type { HealthResponse } from '@template/contracts';
import MotionHeroStage from '../components/motion/HeroStage.vue';
import MotionReveal from '../components/motion/MotionReveal.vue';

const config = useRuntimeConfig();
const { data: health } = await useFetch<HealthResponse>('/health', {
  baseURL: config.public.apiBaseUrl,
  timeout: 3500,
});
useSeoMeta({
  title: '澄序 · 现代用户端项目模板',
  description: '具备独立身份、SSR、SEO、设计系统与可靠会话的现代用户端项目模板。',
  ogTitle: '澄序 · 现代用户端项目模板',
  ogDescription: '从可靠、克制且精致的基础开始构建产品。',
});
</script>

<template>
  <main>
    <section class="hero section-wrap">
      <div class="hero-copy">
        <div class="hero-badge"><i /> AI-ready product foundation <span>2026</span></div>
        <h1>把复杂留给系统，<br /><em>把清晰交给用户。</em></h1>
        <p class="hero-lead">
          一套面向真实产品的用户端基础。身份、会话、设计系统与工程规范已经就绪，让团队从第一天就保持一致。
        </p>
        <div class="hero-actions">
          <Button as-child size="lg"
            ><NuxtLink to="/register">创建项目账号 <span>↗</span></NuxtLink></Button
          >
          <Button as-child size="lg" variant="outline"
            ><a href="#capabilities">探索基础能力</a></Button
          >
        </div>
        <div class="trust-row">
          <span :class="['live-dot', { online: health }]" /> API
          {{ health ? '运行正常' : '暂不可用' }} <i /> SSR 首屏渲染 <i /> 响应式设计
        </div>
      </div>
      <MotionHeroStage />
    </section>

    <section class="logo-strip section-wrap" aria-label="设计标准">
      <span>DESIGNED WITH THE DISCIPLINE OF</span>
      <b>Apple</b><b>Linear</b><b>Vercel</b><b>shadcn/vue</b>
    </section>

    <section id="capabilities" class="capabilities section-wrap">
      <div class="section-heading">
        <p class="eyebrow"><span /> PRODUCT FOUNDATION</p>
        <div>
          <h2>基础能力，<br />不应该成为重复工作。</h2>
          <p>每个模块都围绕真实业务边界构建，可以直接使用，也可以在不破坏约束的前提下继续扩展。</p>
        </div>
      </div>
      <div class="feature-grid">
        <MotionReveal
          v-for="(item, index) in [
            ['独立身份', '用户账号与后台管理员完全隔离，手机号注册登录，边界清晰。'],
            ['可靠会话', '短期令牌与 HttpOnly 刷新会话协作，支持轮换与设备撤销。'],
            ['SSR 与 SEO', '公开页面服务端渲染，语义结构和元信息纳入模板基线。'],
            ['响应式系统', '统一设计令牌覆盖桌面与移动端，并尊重减少动态效果。'],
          ]"
          :key="item[0]"
          :delay="index * 70"
        >
          <article>
            <b>0{{ index + 1 }}</b>
            <h3>{{ item[0] }}</h3>
            <p>{{ item[1] }}</p>
            <span>了解能力 ↗</span>
          </article>
        </MotionReveal>
      </div>
    </section>

    <section id="principles" class="principles section-wrap">
      <div class="principle-copy">
        <p class="eyebrow light"><span /> DESIGN PRINCIPLE</p>
        <blockquote>少一点界面噪音，<br /><em>多一点产品判断。</em></blockquote>
        <p>视觉为信息服务，动效为理解服务。任何装饰都不能凌驾于速度、可访问性和业务可靠性之上。</p>
        <Button as-child variant="outline" class="principle-button"
          ><NuxtLink to="/register">开始构建</NuxtLink></Button
        >
      </div>
      <div class="principle-panel" aria-hidden="true">
        <span>01</span><i /><b>Clarity<br />over noise.</b><small>清晰优先</small>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import type { HealthResponse } from '@template/contracts';
const config = useRuntimeConfig();
const { data: health } = await useFetch<HealthResponse>('/health', {
  baseURL: config.public.apiBaseUrl,
  timeout: 3500,
});
useSeoMeta({
  title: '澄序 · 用户端项目模板',
  description: '具备独立身份、SSR、SEO 与响应式体验的现代用户端项目模板。',
  ogTitle: '澄序 · 用户端项目模板',
  ogDescription: '从可靠基础开始构建你的产品。',
});
</script>

<template>
  <main>
    <section class="hero section-wrap">
      <div class="hero-copy">
        <p class="eyebrow"><span /> USER EXPERIENCE STARTER</p>
        <h1>从清晰的基础出发，<em>构建真正的产品。</em></h1>
        <p class="hero-lead">
          一个克制、可靠的用户端起点。身份、会话、个人资料和工程规范已经就绪，把精力留给真正独特的业务。
        </p>
        <div class="hero-actions">
          <NuxtLink class="button" to="/register">创建账号 <span>→</span></NuxtLink
          ><a class="text-link" href="#capabilities">查看基础能力 <span>↓</span></a>
        </div>
        <div class="trust-row">
          <span :class="['live-dot', { online: health }]" /> API
          {{ health ? '运行正常' : '暂不可用' }}<i />SSR 首屏渲染<i />移动端适配
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="orb orb-one" />
        <div class="orb orb-two" />
        <div class="glass-card">
          <span>WELCOME</span><strong>把复杂留在系统里，<br />把简单交给用户。</strong>
          <div class="card-line" />
          <div class="card-meta"><b>01</b><small>清晰 · 一致 · 可信</small></div>
        </div>
      </div>
    </section>
    <section id="capabilities" class="capabilities section-wrap">
      <div class="section-heading">
        <p class="eyebrow"><span /> FOUNDATION</p>
        <h2>不是演示页面，<br />是可以继续生长的基础。</h2>
      </div>
      <div class="feature-grid">
        <article>
          <b>01</b>
          <h3>独立用户身份</h3>
          <p>用户端账号与后台管理员完全隔离，手机号注册登录，权限边界更清晰。</p>
        </article>
        <article>
          <b>02</b>
          <h3>可靠会话</h3>
          <p>短期访问令牌配合 HttpOnly 刷新会话，支持恢复、轮换与安全退出。</p>
        </article>
        <article>
          <b>03</b>
          <h3>SSR 与 SEO</h3>
          <p>公开页面默认服务端渲染，语义化结构、元信息和弱网状态已经纳入模板。</p>
        </article>
        <article>
          <b>04</b>
          <h3>响应式体验</h3>
          <p>从大屏到手机保持统一的视觉秩序，不依赖笨重 UI 框架。</p>
        </article>
      </div>
    </section>
    <section id="about" class="statement section-wrap">
      <p>模板原则</p>
      <blockquote>不预设你的业务，<br /><em>只把每个产品都需要的基础做好。</em></blockquote>
      <NuxtLink class="button button-light" to="/register">开始使用</NuxtLink>
    </section>
  </main>
</template>

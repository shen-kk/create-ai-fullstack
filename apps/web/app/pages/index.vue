<script setup lang="ts">
import type { HealthResponse } from '@template/contracts';
import { project } from '../generated/project';

const config = useRuntimeConfig();
const { data: health } = await useFetch<HealthResponse>('/health', {
  baseURL: config.public.apiBaseUrl,
  timeout: 3500,
});
const commands = [
  'npm create aiforge@latest my-project',
  'cd my-project',
  'pnpm install',
  'pnpm dev',
];
const applications = [
  [
    '01',
    '后台管理 Admin',
    '管理员、角色权限、审计日志、服务资源和部署环境。',
    `http://localhost:${project.runtime.adminPort}`,
  ],
  [
    '02',
    'API 服务',
    '鉴权、业务规则、Prisma 数据访问与统一错误响应。',
    `http://localhost:${project.runtime.apiPort}/api`,
  ],
  [
    '03',
    '用户端 Web',
    '首次登录自动开户、个人中心、SSR 与响应式设计基础。',
    `http://localhost:${project.runtime.webPort}`,
  ],
];
const steps = [
  ['创建项目', '运行创建命令，进入交互式初始化向导。'],
  ['填写数据库', '提供项目启动必需的 PostgreSQL 信息。'],
  ['选择应用', '按需要启用用户端；Admin、API 与部署中心是基础能力。'],
  ['启动开发', '安装依赖并启动项目，开始三端联调。'],
];
const resources = [
  'SQL 数据库',
  'Redis',
  '对象存储',
  '短信',
  '邮件',
  '支付',
  'Git 仓库',
  'Linux 服务器',
];

useSeoMeta({
  title: 'Aiforge 使用指南 · AI 友好的全栈项目模板',
  description: '了解如何创建、初始化和开发包含后台管理、API 与用户端的 Aiforge 全栈项目。',
  ogTitle: 'Aiforge 使用指南',
  ogDescription: '从初始化到三端开发，一页了解 AI 友好的全栈项目模板。',
});
</script>

<template>
  <main class="guide-page">
    <section class="guide-hero section-wrap">
      <div class="guide-hero-copy">
        <div class="hero-badge"><i /> Aiforge Documentation <span>v0.1</span></div>
        <h1>一套让 AI 和开发者<br /><em>都容易理解的全栈基础。</em></h1>
        <p>
          Aiforge 包含后台管理、API 服务和可选用户端，并将工程边界、组件规范、权限、安全和 AI
          协作上下文一起交付。
        </p>
        <div class="hero-actions">
          <Button as-child size="lg"><a href="#quick-start">开始使用</a></Button>
          <Button as-child size="lg" variant="outline"><a href="#architecture">了解三端</a></Button>
        </div>
      </div>
      <aside class="guide-command-card" aria-label="快速创建命令">
        <div class="guide-command-head"><span>快速创建</span><i :class="{ online: health }" /></div>
        <pre><code><template v-for="(command, index) in commands" :key="command"><span>$</span> {{ command }}<br v-if="index < commands.length - 1" /></template></code></pre>
        <footer>
          <span :class="['live-dot', { online: health }]" />API
          {{ health ? '连接正常' : '暂不可用' }}
        </footer>
      </aside>
    </section>

    <nav class="guide-index section-wrap" aria-label="本页目录">
      <span>本页目录</span><a href="#architecture">项目组成</a><a href="#quick-start">快速开始</a>
      <a href="#workflow">初始化流程</a><a href="#experience">功能体验</a
      ><a href="#configuration">服务配置</a>
    </nav>

    <section id="architecture" class="guide-section section-wrap">
      <header class="guide-section-heading">
        <p class="eyebrow"><span /> PROJECT ARCHITECTURE</p>
        <h2>三个应用，边界清楚，<br />需要什么就启用什么。</h2>
        <p>前端不直接访问数据库；API 是业务与数据的唯一入口；跨端类型由共享契约统一维护。</p>
      </header>
      <div class="guide-app-grid">
        <article v-for="application in applications" :key="application[0]">
          <b>{{ application[0] }}</b>
          <h3>{{ application[1] }}</h3>
          <p>{{ application[2] }}</p>
          <code>{{ application[3] }}</code>
        </article>
      </div>
    </section>

    <section id="quick-start" class="guide-section guide-section-soft">
      <div class="section-wrap guide-split">
        <div class="guide-section-heading compact">
          <p class="eyebrow"><span /> QUICK START</p>
          <h2>四条命令，启动项目。</h2>
          <p>
            推荐使用 Node.js 22+、pnpm 和 PostgreSQL。初始化向导会生成项目声明、AI
            上下文和本地环境文件。
          </p>
        </div>
        <div class="guide-code-block">
          <div><span /><span /><span /><b>Terminal</b></div>
          <pre><code><template v-for="command in commands" :key="command">{{ command }}
</template>
pnpm template:doctor</code></pre>
        </div>
      </div>
    </section>

    <section id="workflow" class="guide-section section-wrap">
      <header class="guide-section-heading">
        <p class="eyebrow"><span /> INITIALIZATION</p>
        <h2>初始化向导会做什么？</h2>
        <p>配置在拉取完整模板之前完成。敏感信息只进入 Git 忽略的环境文件，不写入项目声明和文档。</p>
      </header>
      <ol class="guide-steps">
        <li v-for="(step, index) in steps" :key="step[0]">
          <span>{{ String(index + 1).padStart(2, '0') }}</span>
          <div>
            <h3>{{ step[0] }}</h3>
            <p>{{ step[1] }}</p>
          </div>
        </li>
      </ol>
    </section>

    <section id="experience" class="guide-section guide-experience section-wrap">
      <div class="guide-section-heading compact light-copy">
        <p class="eyebrow light"><span /> TRY THE FOUNDATION</p>
        <h2>直接体验用户基础功能。</h2>
        <p>这些页面使用真实 API 与独立用户身份，不与后台管理员账号混用。</p>
      </div>
      <div class="guide-experience-links">
        <NuxtLink to="/login"
          ><span>01</span><strong>注册账号</strong><small>手机号与验证码</small><b>↗</b></NuxtLink
        >
        <NuxtLink to="/login"
          ><span>02</span><strong>登录系统</strong><small>密码或验证码</small><b>↗</b></NuxtLink
        >
        <NuxtLink to="/profile"
          ><span>03</span><strong>个人中心</strong><small>资料、密码与设备</small><b>↗</b></NuxtLink
        >
      </div>
    </section>

    <section id="configuration" class="guide-section section-wrap guide-configuration">
      <header class="guide-section-heading">
        <p class="eyebrow"><span /> SERVICE RESOURCES</p>
        <h2>外部服务在后台统一管理。</h2>
        <p>初始化只要求 PostgreSQL。其他服务在后台按环境创建，在业务或部署环境中绑定使用。</p>
      </header>
      <div class="guide-resource-list">
        <span v-for="resource in resources" :key="resource">{{ resource }}</span>
      </div>
      <div class="guide-note">
        <strong>安全提示</strong>
        <p>
          密钥由 API 加密保存。不要把数据库连接、Token、私钥或服务商密钥写进源码、截图和 AI 对话。
        </p>
      </div>
    </section>
  </main>
</template>

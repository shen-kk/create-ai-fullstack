<script setup lang="ts">
import type { SystemInfoResponse } from '@template/contracts';
import { onMounted, ref } from 'vue';
import { getSystemInfo } from '../api/system';

const info = ref<SystemInfoResponse>();
const loading = ref(false);
const error = ref('');
const environmentLabels = {
  development: '开发环境',
  test: '测试环境',
  production: '生产环境',
} as const;
const dataSourceLabels = { memory: '内存预览模式', prisma: 'Prisma / PostgreSQL' } as const;
const formatUptime = (seconds: number): string =>
  `${Math.floor(seconds / 3600)} 小时 ${Math.floor((seconds % 3600) / 60)} 分钟`;
async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    info.value = await getSystemInfo();
  } catch {
    error.value = '系统信息加载失败，请检查 API 服务和访问权限。';
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>

<template>
  <div>
    <section class="page-heading">
      <div>
        <p class="eyebrow">系统 / 系统信息</p>
        <h1>系统信息</h1>
        <p>查看当前模板的真实运行环境与数据源，不展示密钥等敏感配置。</p>
      </div>
      <button class="secondary-button" :disabled="loading" @click="load">刷新</button>
    </section>
    <div v-if="loading" class="panel table-state">
      <span class="loading-ring" />正在读取运行信息…
    </div>
    <div v-else-if="error" class="panel table-state error-state">
      <strong>加载失败</strong>
      <p>{{ error }}</p>
    </div>
    <section v-else-if="info" class="system-grid">
      <article class="panel system-card">
        <span>服务</span><strong>{{ info.service }}</strong
        ><small>版本 {{ info.version }}</small>
      </article>
      <article class="panel system-card">
        <span>运行环境</span><strong>{{ environmentLabels[info.environment] }}</strong
        ><small>{{ info.nodeVersion }}</small>
      </article>
      <article class="panel system-card">
        <span>数据源</span><strong>{{ dataSourceLabels[info.dataSource] }}</strong
        ><small>固定使用 PostgreSQL + Prisma</small>
      </article>
      <article class="panel system-card">
        <span>运行时长</span><strong>{{ formatUptime(info.uptimeSeconds) }}</strong
        ><small>API 进程正常运行</small>
      </article>
    </section>
    <section class="panel system-note">
      <h2>模板边界</h2>
      <p>
        这里只提供通用系统能力。订单、内容、商城等业务模块不会预置，需要在新项目初始化后按需添加。
      </p>
      <p>环境变量仅展示非敏感摘要，密码、Token、服务密钥不会返回到管理后台。</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { HealthResponse } from '@template/contracts';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getAuditLogs } from '../api/audit';
import { getHealth } from '../api/health';
import { getRoleOptions } from '../api/users';
import { getUsers } from '../api/users';
import { getCurrentUser } from '../auth/session';

const router = useRouter();
const granted = new Set(getCurrentUser()?.permissions ?? []);
const health = ref<HealthResponse>();
const checking = ref(true);
const error = ref('');
const userTotal = ref<number>();
const roleTotal = ref<number>();
const auditTotal = ref<number>();
const healthLabel = computed(() =>
  checking.value ? '检查中' : health.value ? '运行正常' : '未连接',
);
const cards = computed(() => [
  ...(granted.has('users.read')
    ? [{ label: '用户总数', value: userTotal.value, path: '/users', note: '来自用户管理接口' }]
    : []),
  ...(granted.has('roles.manage')
    ? [{ label: '角色总数', value: roleTotal.value, path: '/roles', note: '包含系统与自定义角色' }]
    : []),
  ...(granted.has('audit.read')
    ? [{ label: '审计记录', value: auditTotal.value, path: '/logs', note: '不可删除的操作记录' }]
    : []),
]);

async function load(): Promise<void> {
  checking.value = true;
  error.value = '';
  health.value = undefined;
  const requests: Promise<void>[] = [
    getHealth().then((value) => {
      health.value = value;
    }),
  ];
  if (granted.has('users.read'))
    requests.push(
      getUsers({ page: 1, pageSize: 1 }).then((value) => {
        userTotal.value = value.total;
      }),
    );
  if (granted.has('roles.manage'))
    requests.push(
      getRoleOptions().then((value) => {
        roleTotal.value = value.length;
      }),
    );
  if (granted.has('audit.read'))
    requests.push(
      getAuditLogs({ page: 1, pageSize: 1 }).then((value) => {
        auditTotal.value = value.total;
      }),
    );
  const results = await Promise.allSettled(requests);
  if (results.some((item) => item.status === 'rejected'))
    error.value = '部分数据加载失败，请检查 API 服务或当前账号权限。';
  checking.value = false;
}
function open(path: string): void {
  void router.push(path);
}
onMounted(load);
</script>

<template>
  <div class="dashboard">
    <section class="page-heading">
      <div>
        <p class="eyebrow">管理后台 / 工作台</p>
        <h1>工作台</h1>
        <p>这里只展示当前系统已有接口返回的真实数据。</p>
      </div>
      <button class="secondary-button" :disabled="checking" @click="load">刷新数据</button>
    </section>
    <p v-if="error" class="operation-notice" role="alert">{{ error }}</p>
    <section v-if="cards.length" class="metric-grid" aria-label="系统数据">
      <button
        v-for="card in cards"
        :key="card.path"
        class="metric-card metric-link"
        @click="open(card.path)"
      >
        <span>{{ card.label }}</span
        ><strong class="metric-value">{{ card.value ?? '—' }}</strong
        ><small>{{ card.note }} · 点击查看</small>
      </button>
    </section>
    <section class="dashboard-grid dashboard-real-grid">
      <article class="panel quick-panel">
        <header class="panel-header">
          <div>
            <h2>可用功能</h2>
            <p>仅显示当前账号有权访问的真实入口</p>
          </div>
        </header>
        <div class="quick-grid">
          <button v-if="granted.has('users.read')" @click="open('/users')">
            <b class="quick-icon blue">人</b><span>用户管理</span>
          </button>
          <button v-if="granted.has('roles.manage')" @click="open('/roles')">
            <b class="quick-icon green">权</b><span>角色权限</span>
          </button>
          <button v-if="granted.has('audit.read')" @click="open('/logs')">
            <b class="quick-icon amber">记</b><span>操作日志</span>
          </button>
          <button v-if="granted.has('system.read')" @click="open('/system')">
            <b class="quick-icon violet">系</b><span>系统信息</span>
          </button>
        </div>
      </article>
      <article class="panel service-panel">
        <header class="panel-header">
          <div>
            <h2>服务状态</h2>
            <p>由真实健康检查接口返回</p>
          </div>
          <button class="text-button" :disabled="checking" @click="load">重新检查</button>
        </header>
        <div class="service-row">
          <span class="service-icon">API</span>
          <div>
            <strong>核心接口服务</strong>
            <p>
              {{
                health?.timestamp
                  ? `检查时间：${new Date(health.timestamp).toLocaleString('zh-CN')}`
                  : '等待检查结果'
              }}
            </p>
          </div>
          <span class="status-pill" :class="{ offline: !checking && !health }"
            ><i />{{ healthLabel }}</span
          >
        </div>
      </article>
    </section>
  </div>
</template>

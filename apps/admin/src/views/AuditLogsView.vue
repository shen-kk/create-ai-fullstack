<script setup lang="ts">
import type { AuditLogSummary } from '@template/contracts';
import { onMounted, ref } from 'vue';
import { getAuditLogs } from '../api/audit';
import AppSelect from '../components/AppSelect.vue';
import AppPagination from '../components/AppPagination.vue';
import AppDialog from '../components/AppDialog.vue';
import { auditResultLabel } from '../status-labels';

const logs = ref<AuditLogSummary[]>([]);
const loading = ref(false);
const error = ref('');
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const keyword = ref('');
const selectedAction = ref('');
const selectedResource = ref('');
const selectedResult = ref<'' | 'success' | 'failure'>('');
const selectedLog = ref<AuditLogSummary | null>(null);
const actionLabels: Record<string, string> = {
  'user.create': '创建用户',
  'user.update': '修改资料',
  'user.status.change': '变更状态',
  'user.roles.assign': '分配角色',
  'role.create': '创建角色',
  'role.update': '修改角色权限',
  'integration.update': '修改服务配置',
  'integration.secret.read': '查看服务敏感配置',
  'deployment.environment.create': '创建部署环境',
  'deployment.environment.update': '修改部署环境',
  'deployment.secret.read': '查看部署敏感配置',
  'deployment.run.create': '创建部署任务',
  'deployment.rollback': '回滚部署版本',
};
const resourceLabels: Record<string, string> = {
  user: '后台用户', role: '角色', integration: '服务配置', deploy_environment: '部署环境', deploy_run: '部署任务',
};
const actionOptions = [
  { value: '', label: '全部操作' },
  ...Object.entries(actionLabels).map(([value, label]) => ({ value, label })),
];
const resourceOptions = [
  { value: '', label: '全部资源' },
  { value: 'user', label: '用户' },
  { value: 'role', label: '角色' },
  { value: 'integration', label: '服务配置' },
];
const resultOptions = [
  { value: '', label: '全部结果' },
  { value: 'success', label: '成功' },
  { value: 'failure', label: '失败' },
];
const formatDate = (value: string): string =>
  new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'medium' }).format(
    new Date(value),
  );
async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const result = await getAuditLogs({
      page: page.value,
      pageSize: pageSize.value,
      ...(keyword.value ? { keyword: keyword.value } : {}),
      ...(selectedAction.value ? { action: selectedAction.value } : {}),
      ...(selectedResource.value ? { resource: selectedResource.value } : {}),
      ...(selectedResult.value ? { result: selectedResult.value } : {}),
    });
    logs.value = result.items;
    total.value = result.total;
  } catch {
    error.value = '审计日志加载失败，请检查权限与 API 服务。';
  } finally {
    loading.value = false;
  }
}
function search(): void {
  page.value = 1;
  void load();
}
function reset(): void {
  keyword.value = '';
  selectedAction.value = '';
  selectedResource.value = '';
  selectedResult.value = '';
  page.value = 1;
  void load();
}
onMounted(load);
</script>
<template>
  <div>
    <section class="page-heading">
      <div>
        <p class="eyebrow">系统 / 操作日志</p>
        <h1>操作日志</h1>
        <p>追踪敏感写操作、操作者、请求 ID 与来源地址。</p>
      </div>
      <button class="secondary-button" :disabled="loading" @click="load">刷新</button>
    </section>
    <section class="panel filter-panel">
      <form class="audit-filter-form" @submit.prevent="search">
        <label
          ><span>关键词</span
          ><input v-model.trim="keyword" placeholder="请求 ID、资源 ID、操作者或 IP" /></label
        ><label
          ><span>操作</span
          ><AppSelect v-model="selectedAction" aria-label="操作" :options="actionOptions" /></label
        ><label
          ><span>资源</span
          ><AppSelect
            v-model="selectedResource"
            aria-label="资源"
            :options="resourceOptions" /></label
        ><label
          ><span>结果</span
          ><AppSelect v-model="selectedResult" aria-label="结果" :options="resultOptions"
        /></label>
        <div class="filter-actions">
          <button type="button" class="secondary-button" @click="reset">重置</button
          ><button class="primary-button">查询</button>
        </div>
      </form>
    </section>
    <section class="panel users-table-panel">
      <header class="table-header">
        <div>
          <h2>审计记录</h2>
          <p>共 {{ total }} 条</p>
        </div>
        <span class="template-badge">只读 · 不可删除</span>
      </header>
      <div v-if="loading" class="table-state"><span class="loading-ring" />正在加载…</div>
      <div v-else-if="error" class="operation-notice" role="alert">
        <strong>加载失败</strong>
        <p>{{ error }}</p>
      </div>
      <div v-else-if="!logs.length" class="table-state">
        <strong>没有匹配记录</strong>
        <p>尝试调整筛选条件，或执行用户、角色写操作。</p>
      </div>
      <div v-else class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>操作</th>
              <th>资源</th>
              <th>操作者</th>
              <th>结果</th>
              <th>详情</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in logs" :key="log.id">
              <td>{{ formatDate(log.createdAt) }}</td>
              <td>
                <strong>{{ actionLabels[log.action] || log.action }}</strong>
              </td>
              <td>{{ resourceLabels[log.resource] || log.resource }}</td>
              <td>{{ log.actorName || '系统' }}</td>
              <td>
                <span class="user-status" :class="log.result === 'success' ? 'active' : 'disabled'"
                  ><i />{{ auditResultLabel(log.result) }}</span
                >
              </td>
              <td><button class="link-button" @click="selectedLog = log">查看详情</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <AppPagination
        v-if="!loading && !error && total"
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="total"
        @change="load"
      />
    </section>
    <AppDialog v-if="selectedLog" :open="true" size="lg" eyebrow="操作日志详情" :title="actionLabels[selectedLog.action] || selectedLog.action" @close="selectedLog = null">
        <dl class="detail-grid"><dt>时间</dt><dd>{{ formatDate(selectedLog.createdAt) }}</dd><dt>操作者</dt><dd>{{ selectedLog.actorName || '系统' }}</dd><dt>操作者 ID</dt><dd><code>{{ selectedLog.actorId || '—' }}</code></dd><dt>资源</dt><dd>{{ resourceLabels[selectedLog.resource] || selectedLog.resource }} · {{ selectedLog.resourceId || '—' }}</dd><dt>请求 ID</dt><dd><code>{{ selectedLog.requestId || '—' }}</code></dd><dt>来源 IP</dt><dd>{{ selectedLog.ipAddress || '—' }}</dd><dt>原始动作</dt><dd><code>{{ selectedLog.action }}</code></dd></dl>
        <div class="code-container" aria-label="技术元数据"><div class="code-container__header">技术元数据</div><pre>{{ JSON.stringify(selectedLog.metadata || {}, null, 2) }}</pre></div>
    </AppDialog>
  </div>
</template>

<style scoped>
.link-button { border: 0; background: transparent; color: #5965d8; font-weight: 700; cursor: pointer; }
.link-button:hover { color: #3e49bd; text-decoration: underline; }
.detail-grid { display: grid; grid-template-columns: 110px 1fr; gap: 14px 18px; margin: 0; padding: 24px 30px; }
.detail-grid dt { color: #7a8496; font-size: 13px; }
.detail-grid dd { margin: 0; color: #273247; font-size: 14px; word-break: break-word; }
.code-container { margin-top: 4px; overflow: hidden; border: 1px solid #e1e6ef; border-radius: 10px; background: #f7f8fb; }
.code-container__header { padding: 10px 14px; border-bottom: 1px solid #e1e6ef; color: #65718a; font-size: 12px; font-weight: 700; }
.code-container pre { margin: 0; padding: 16px; max-height: 220px; overflow: auto; color: #536078; text-align: left; white-space: pre-wrap; word-break: break-word; font: 12px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace; }
</style>

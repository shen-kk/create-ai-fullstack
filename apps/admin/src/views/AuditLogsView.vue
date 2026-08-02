<script setup lang="ts">
import type { AuditLogSummary } from '@template/contracts';
import { computed, onMounted, ref } from 'vue';
import { getAuditLogs } from '../api/audit';
import AppSelect from '../components/AppSelect.vue';

const logs = ref<AuditLogSummary[]>([]);
const loading = ref(false);
const error = ref('');
const total = ref(0);
const page = ref(1);
const pageSize = 15;
const keyword = ref('');
const selectedAction = ref('');
const selectedResource = ref('');
const selectedResult = ref<'' | 'success' | 'failure'>('');
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));
const actionLabels: Record<string, string> = {
  'user.create': '创建用户',
  'user.update': '修改资料',
  'user.status.change': '变更状态',
  'user.roles.assign': '分配角色',
  'role.create': '创建角色',
  'role.update': '修改角色权限',
  'integration.update': '修改服务配置',
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
      pageSize,
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
function changePage(next: number): void {
  page.value = next;
  void load();
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
      <div v-else-if="error" class="table-state error-state">
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
              <th>请求 ID</th>
              <th>来源 IP</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in logs" :key="log.id">
              <td>{{ formatDate(log.createdAt) }}</td>
              <td>
                <strong>{{ actionLabels[log.action] || log.action }}</strong>
              </td>
              <td>{{ log.resource }} · {{ log.resourceId || '—' }}</td>
              <td>{{ log.actorId || '系统' }}</td>
              <td>
                <span class="user-status" :class="log.result === 'success' ? 'active' : 'disabled'"
                  ><i />{{ log.result }}</span
                >
              </td>
              <td>
                <code>{{ log.requestId || '—' }}</code>
              </td>
              <td>{{ log.ipAddress || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <footer v-if="!loading && !error && total" class="pagination">
        <span>第 {{ page }} / {{ totalPages }} 页</span>
        <div>
          <button :disabled="page <= 1" @click="changePage(page - 1)">上一页</button
          ><button :disabled="page >= totalPages" @click="changePage(page + 1)">下一页</button>
        </div>
      </footer>
    </section>
  </div>
</template>

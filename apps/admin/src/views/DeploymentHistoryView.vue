<script setup lang="ts">
import type { DeploymentEnvironmentSummary, DeploymentRunSummary } from '@template/contracts';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { listDeploymentEnvironments, listDeploymentRuns } from '../api/deployments';
import AppSelect from '../components/AppSelect.vue';
import { deploymentProjectPath } from '../deployments/view-model';

const router = useRouter();
const route = useRoute();
const sourceProjectId = computed(() =>
  typeof route.query.projectId === 'string' ? route.query.projectId : '',
);
const environments = ref<DeploymentEnvironmentSummary[]>([]);
const runs = ref<{ run: DeploymentRunSummary; environment: DeploymentEnvironmentSummary }[]>([]);
const loading = ref(true);
const error = ref('');
const statusText = {
  queued: '等待中',
  running: '执行中',
  succeeded: '已成功',
  failed: '已失败',
  cancelled: '已取消',
  rolling_back: '正在回滚',
  rolled_back: '已回滚',
} as const;
const statusFilter = ref('');
const environmentFilter = ref('');
const environmentOptions = computed(() => [
  { value: '', label: '全部环境' },
  ...environments.value.map((item) => ({ value: item.id, label: item.name })),
]);
const filteredRuns = computed(() =>
  runs.value.filter(
    ({ run, environment }) =>
      (!statusFilter.value || run.status === statusFilter.value) &&
      (!environmentFilter.value || environment.id === environmentFilter.value),
  ),
);
async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    environments.value = await listDeploymentEnvironments();
    const entries = await Promise.all(
      environments.value.map(async (environment) =>
        (await listDeploymentRuns(environment.id)).map((run) => ({ run, environment })),
      ),
    );
    runs.value = entries
      .flat()
      .sort((a, b) => new Date(b.run.createdAt).getTime() - new Date(a.run.createdAt).getTime());
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '部署记录加载失败';
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
        <p class="eyebrow">部署中心 / 部署记录</p>
        <h1>部署记录</h1>
        <p>统一查看所有环境的部署任务、版本和执行详情。</p>
      </div>
      <button
        class="secondary-button"
        @click="router.push(deploymentProjectPath(sourceProjectId || undefined))"
      >
        {{ sourceProjectId ? '返回环境' : '返回项目列表' }}
      </button>
    </section>
    <section class="panel history-filter">
      <label
        ><span>部署环境</span
        ><AppSelect v-model="environmentFilter" aria-label="部署环境" :options="environmentOptions"
      /></label>
      <label
        ><span>部署状态</span
        ><AppSelect
          v-model="statusFilter"
          aria-label="部署状态"
          :options="[
            { value: '', label: '全部状态' },
            { value: 'queued', label: '等待中' },
            { value: 'running', label: '执行中' },
            { value: 'succeeded', label: '已成功' },
            { value: 'failed', label: '已失败' },
            { value: 'cancelled', label: '已取消' },
          ]"
      /></label>
    </section>
    <div v-if="loading" class="panel table-state">
      <span class="loading-ring" />正在加载部署记录…
    </div>
    <div v-else-if="error" class="panel table-state error-state">
      {{ error }}<button class="secondary-button" @click="load">重试</button>
    </div>
    <section v-else-if="!filteredRuns.length" class="panel table-state">
      <strong>暂无部署记录</strong>
      <p>在部署环境中完成一次部署后，记录会显示在这里。</p>
    </section>
    <section v-else class="panel history-list">
      <article v-for="entry in filteredRuns" :key="entry.run.id" class="history-row">
        <div>
          <strong>{{ entry.environment.name }}</strong
          ><span>{{ entry.environment.projectName }} · {{ entry.run.gitRef }}</span>
        </div>
        <span class="status-pill" :class="entry.run.status">{{
          statusText[entry.run.status]
        }}</span>
        <span class="history-progress">{{ entry.run.progress }}%</span>
        <button class="secondary-button" @click="router.push(`/deployments/runs/${entry.run.id}`)">
          查看详情
        </button>
      </article>
    </section>
  </div>
</template>
<style scoped>
.history-filter {
  margin-bottom: 20px;
}
.history-filter {
  display: flex;
  gap: 16px;
}
.history-filter label {
  display: grid;
  width: 260px;
  gap: 8px;
}
.history-filter select {
  height: 42px;
  padding: 0 12px;
}
.history-list {
  padding: 0;
}
.history-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 70px auto;
  align-items: center;
  gap: 18px;
  padding: 18px 24px;
  border-bottom: 1px solid #edf0f4;
}
.history-row:last-child {
  border-bottom: 0;
}
.history-row div {
  display: grid;
  gap: 5px;
}
.history-row span {
  color: #64748b;
  font-size: 12px;
}
.history-progress {
  text-align: right;
}
@media (max-width: 720px) {
  .history-filter {
    flex-direction: column;
  }
  .history-filter label {
    width: 100%;
  }
  .history-row {
    grid-template-columns: 1fr;
  }
  .history-progress {
    text-align: left;
  }
}
</style>

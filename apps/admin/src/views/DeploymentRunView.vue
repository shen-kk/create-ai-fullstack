<script setup lang="ts">
import type { DeploymentLogEntry, DeploymentRunSummary } from '@template/contracts';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  cancelDeploymentRun,
  getDeploymentRun,
  listDeploymentLogs,
  streamDeploymentRun,
} from '../api/deployments';

const route = useRoute(),
  router = useRouter();
const runId = String(route.params.runId ?? '');
const run = ref<DeploymentRunSummary>(),
  logs = ref<DeploymentLogEntry[]>([]),
  loading = ref(true),
  error = ref(''),
  autoScroll = ref(true);
const terminal = ref<HTMLElement>();
const controller = new AbortController();
const statusText = {
  queued: '等待中',
  running: '执行中',
  succeeded: '已成功',
  failed: '已失败',
  cancelled: '已取消',
  rolling_back: '正在回滚',
  rolled_back: '已回滚',
} as const;
const active = computed(
  () => run.value && ['queued', 'running', 'rolling_back'].includes(run.value.status),
);
function append(next: DeploymentLogEntry[]): void {
  const known = new Set(logs.value.map((item) => item.id));
  logs.value.push(...next.filter((item) => !known.has(item.id)));
  if (autoScroll.value)
    requestAnimationFrame(() =>
      terminal.value?.scrollTo({ top: terminal.value.scrollHeight, behavior: 'smooth' }),
    );
}
async function load(): Promise<void> {
  try {
    const [current, entries] = await Promise.all([
      getDeploymentRun(runId),
      listDeploymentLogs(runId),
    ]);
    run.value = current;
    logs.value = entries;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '部署任务加载失败';
  } finally {
    loading.value = false;
  }
}
async function connect(): Promise<void> {
  try {
    await streamDeploymentRun(runId, controller.signal, (event) => {
      run.value = event.run;
      append(event.logs);
    });
  } catch (cause) {
    if (!controller.signal.aborted)
      error.value = `实时连接中断：${cause instanceof Error ? cause.message : '未知错误'}，刷新页面可重连`;
  }
}
async function cancel(): Promise<void> {
  if (!run.value) return;
  try {
    run.value = await cancelDeploymentRun(run.value.id);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '取消部署失败';
  }
}
onMounted(async () => {
  await load();
  void connect();
});
onBeforeUnmount(() => controller.abort());
</script>

<template>
  <div>
    <section class="page-heading">
      <div>
        <p class="eyebrow">部署中心 / 部署进度</p>
        <h1>部署任务</h1>
        <p v-if="run">
          {{ run.gitRef }} · {{ run.applications.join(' / ') }} · {{ run.createdAt }}
        </p>
      </div>
      <div class="heading-actions">
        <button class="secondary-button" @click="router.push('/deployments')">返回部署中心</button
        ><button v-if="active" class="danger-button" @click="cancel">取消部署</button>
      </div>
    </section>
    <div v-if="loading" class="panel table-state"><span class="loading-ring" />正在加载任务…</div>
    <p v-if="error" class="operation-notice" role="alert">{{ error }}</p>
    <template v-if="run">
      <section class="panel run-summary">
        <div>
          <span class="run-status" :class="run.status">{{ statusText[run.status] }}</span
          ><strong>{{ run.progress }}%</strong>
        </div>
        <div class="progress-track"><i :style="{ width: `${run.progress}%` }" /></div>
        <p>{{ run.currentStep ? `当前步骤：${run.currentStep}` : '等待执行器领取任务' }}</p>
        <div v-if="run.errorCode" class="run-error">
          <strong>{{ run.errorCode }}</strong
          ><span>{{ run.errorMessage }}</span>
        </div>
      </section>
      <section class="run-layout">
        <div class="panel step-panel">
          <h2>执行步骤</h2>
          <ol>
            <li v-for="step in run.steps" :key="step.id" :class="step.status">
              <span class="step-marker">{{
                step.status === 'succeeded'
                  ? '✓'
                  : step.status === 'failed'
                    ? '!'
                    : step.status === 'running'
                      ? '●'
                      : '○'
              }}</span>
              <div>
                <strong>{{ step.label }}</strong
                ><small>{{
                  step.message || (step.status === 'pending' ? '等待执行' : `${step.progress}%`)
                }}</small>
              </div>
            </li>
          </ol>
        </div>
        <div class="panel terminal-panel">
          <header>
            <div>
              <h2>实时终端</h2>
              <small>SSE 实时传输，日志已持久化并自动脱敏</small>
            </div>
            <label><input v-model="autoScroll" type="checkbox" />自动滚动</label>
          </header>
          <div ref="terminal" class="terminal">
            <p v-if="!logs.length">等待执行器输出…</p>
            <p v-for="entry in logs" :key="entry.id" :class="entry.level">
              <time>{{ new Date(entry.createdAt).toLocaleTimeString('zh-CN') }}</time
              ><span>{{ entry.message }}</span>
            </p>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.heading-actions {
  display: flex;
  gap: 10px;
}
.run-summary {
  padding: 24px;
  margin-bottom: 20px;
}
.run-summary > div:first-child {
  display: flex;
  justify-content: space-between;
}
.run-status {
  font-weight: 700;
}
.run-status.succeeded {
  color: #087443;
}
.run-status.failed,
.run-status.cancelled {
  color: #b42318;
}
.progress-track {
  height: 9px;
  background: #e9edf5;
  border-radius: 999px;
  overflow: hidden;
  margin: 16px 0;
}
.progress-track i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #5267f5, #7557e8);
  transition: width 0.35s ease;
}
.run-error {
  display: grid;
  gap: 4px;
  padding: 14px;
  border-radius: 12px;
  background: #fff1f0;
  color: #b42318;
}
.run-layout {
  display: grid;
  grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
  gap: 20px;
}
.step-panel,
.terminal-panel {
  padding: 22px;
}
.step-panel h2,
.terminal-panel h2 {
  margin: 0;
}
.step-panel ol {
  list-style: none;
  padding: 0;
  margin: 20px 0 0;
  display: grid;
  gap: 18px;
}
.step-panel li {
  display: flex;
  gap: 12px;
  color: #64748b;
}
.step-panel li.running {
  color: #3046c8;
}
.step-panel li.succeeded {
  color: #087443;
}
.step-panel li.failed {
  color: #b42318;
}
.step-marker {
  width: 20px;
}
.step-panel li div {
  display: grid;
  gap: 3px;
}
.terminal-panel header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.terminal {
  height: 440px;
  overflow: auto;
  background: #101522;
  color: #d5dbea;
  border-radius: 14px;
  padding: 16px;
  font:
    13px/1.65 ui-monospace,
    SFMono-Regular,
    Consolas,
    monospace;
}
.terminal p {
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 10px;
  margin: 0;
}
.terminal time {
  color: #718096;
}
.terminal .warn {
  color: #ffd166;
}
.terminal .error {
  color: #ff8c8c;
}
@media (max-width: 900px) {
  .run-layout {
    grid-template-columns: 1fr;
  }
}
</style>

<script setup lang="ts">
import type {
  DeploymentEnvironmentSummary,
  DeploymentReleaseSummary,
  DeploymentRunSummary,
  DeploymentWorkerStatus,
} from '@template/contracts';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  checkDeploymentGit,
  checkDeploymentServer,
  createDeploymentRun,
  getDeploymentWorkerStatus,
  listDeploymentEnvironments,
  listDeploymentReleases,
  listDeploymentRuns,
  rollbackDeploymentRelease,
} from '../api/deployments';
import DeploymentWorkerStatusPanel from '../components/DeploymentWorkerStatus.vue';

const router = useRouter();
const route = useRoute();
const projectId = computed(() =>
  typeof route.params.projectId === 'string'
    ? route.params.projectId
    : typeof route.query.projectId === 'string'
      ? route.query.projectId
      : '',
);
const environments = ref<DeploymentEnvironmentSummary[]>([]);
const runs = ref<Record<string, DeploymentRunSummary[]>>({});
const releases = ref<Record<string, DeploymentReleaseSummary[]>>({});
const workerStatus = ref<DeploymentWorkerStatus>();
const rollbackChoice = ref<{ environmentId: string; releaseId: string }>();
const checkResults = ref<
  Record<string, { status: 'success' | 'error'; title: string; lines: string[] }>
>({});
const loading = ref(true),
  refreshingWorker = ref(false),
  error = ref(''),
  notice = ref(''),
  workingId = ref('');
const statusText = { draft: '待检查', verified: '可部署', unreachable: '连接失败' } as const;
const deploymentErrorMessages: Record<string, string> = {
  DEPLOYMENT_SQL_RESOURCE_REQUIRED:
    '当前项目需要数据库，请编辑部署环境并绑定一个已启用的 SQL 资源。',
  DEPLOYMENT_REDIS_RESOURCE_REQUIRED:
    '当前项目需要 Redis，请编辑部署环境并绑定一个已启用的 Redis 资源。',
  DEPLOYMENT_RESOURCE_BINDING_INVALID: '绑定的服务资源不存在、类型不匹配或已停用，请检查环境配置。',
  DEPLOYMENT_SECRETS_REENTRY_REQUIRED:
    '部署敏感配置无法解密，请确认 API 与 Worker 使用相同的 CONFIG_ENCRYPTION_KEY；旧密钥无法恢复时，请重新填写并保存相关资源密钥。',
};
const deploymentError = (cause: unknown, fallback: string): string => {
  const code = cause instanceof Error ? cause.message : '';
  return deploymentErrorMessages[code] ?? (code || fallback);
};
const kindText = {
  development: '开发环境',
  test: '测试环境',
  staging: '预发布环境',
  production: '正式环境',
  custom: '自定义环境',
} as const;
const historicalReleases = (environmentId: string): DeploymentReleaseSummary[] =>
  (releases.value[environmentId] ?? []).filter((entry) => !entry.current).slice(0, 3);

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const [nextEnvironments, nextWorkerStatus] = await Promise.all([
      listDeploymentEnvironments(),
      getDeploymentWorkerStatus(),
    ]);
    workerStatus.value = nextWorkerStatus;
    environments.value = nextEnvironments.filter(
      (item) => !projectId.value || item.projectId === projectId.value,
    );
    await Promise.all(
      environments.value.map(async (item) => {
        const [nextRuns, nextReleases] = await Promise.all([
          listDeploymentRuns(item.id),
          listDeploymentReleases(item.id),
        ]);
        runs.value[item.id] = nextRuns;
        releases.value[item.id] = nextReleases;
      }),
    );
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '部署环境加载失败';
  } finally {
    loading.value = false;
  }
}
async function refreshWorkerStatus(): Promise<void> {
  refreshingWorker.value = true;
  notice.value = '';
  try {
    workerStatus.value = await getDeploymentWorkerStatus();
    notice.value = workerStatus.value.online
      ? 'Deploy Worker 已恢复在线。'
      : '检测完成，Deploy Worker 仍然离线。';
  } catch (cause) {
    notice.value = cause instanceof Error ? cause.message : 'Worker 状态检测失败';
  } finally {
    refreshingWorker.value = false;
  }
}
async function check(item: DeploymentEnvironmentSummary): Promise<void> {
  workingId.value = item.id;
  const lines: string[] = [];
  closeCheckResult(item.id);
  try {
    const git = await checkDeploymentGit(item.id);
    lines.push(
      ...git.checks.map(
        (entry) =>
          `${entry.status === 'passed' ? '通过' : '失败'} · ${entry.label}：${entry.message}`,
      ),
    );
    const server = await checkDeploymentServer(item.id);
    lines.push(
      ...server.checks.map(
        (entry) =>
          `${entry.status === 'passed' ? '通过' : '失败'} · ${entry.label}：${entry.message}`,
      ),
    );
    const success = git.success && server.success;
    checkResults.value = {
      ...checkResults.value,
      [item.id]: {
        status: success ? 'success' : 'error',
        title: success ? '环境检查通过' : '环境检查未通过',
        lines,
      },
    };
    await load();
  } catch (cause) {
    checkResults.value = {
      ...checkResults.value,
      [item.id]: {
        status: 'error',
        title: '环境检查未通过',
        lines: [...lines, deploymentError(cause, '配置检查失败')],
      },
    };
  } finally {
    workingId.value = '';
  }
}
function closeCheckResult(id: string): void {
  const next = { ...checkResults.value };
  delete next[id];
  checkResults.value = next;
}
async function deploy(item: DeploymentEnvironmentSummary): Promise<void> {
  if (!workerStatus.value?.online) {
    notice.value = 'Deploy Worker 离线，请先启动独立执行器再创建部署任务。';
    return;
  }
  workingId.value = item.id;
  try {
    const run = await createDeploymentRun(item.id, {});
    await router.push(`/deployments/runs/${run.id}`);
  } catch (cause) {
    notice.value = deploymentError(cause, '创建部署任务失败');
  } finally {
    workingId.value = '';
  }
}
async function rollback(): Promise<void> {
  if (!rollbackChoice.value) return;
  if (!workerStatus.value?.online) {
    notice.value = 'Deploy Worker 离线，请先启动独立执行器再创建回滚任务。';
    return;
  }
  workingId.value = rollbackChoice.value.environmentId;
  try {
    const run = await rollbackDeploymentRelease(
      rollbackChoice.value.environmentId,
      rollbackChoice.value.releaseId,
    );
    rollbackChoice.value = undefined;
    await router.push(`/deployments/runs/${run.id}`);
  } catch (cause) {
    notice.value = cause instanceof Error ? cause.message : '创建回滚任务失败';
  } finally {
    workingId.value = '';
  }
}
onMounted(load);
</script>

<template>
  <div>
    <section class="page-heading">
      <div>
        <p class="eyebrow">部署中心 / {{ projectId ? '项目环境' : '项目管理' }}</p>
        <h1>{{ projectId ? '项目环境' : '部署项目' }}</h1>
        <p>管理 Git、服务器、部署任务和可回滚版本。凭据只加密保存，不会明文回显。</p>
      </div>
      <div class="heading-actions">
        <button v-if="projectId" class="secondary-button" @click="router.push('/deployments')">
          返回项目</button
        ><button
          class="secondary-button"
          @click="
            router.push(
              projectId
                ? { path: '/deployments/history', query: { projectId } }
                : '/deployments/history',
            )
          "
        >
          部署记录</button
        ><button
          class="primary-button"
          @click="
            router.push(
              projectId ? { path: '/deployments/new', query: { projectId } } : '/deployments/new',
            )
          "
        >
          新增环境
        </button>
      </div>
    </section>
    <DeploymentWorkerStatusPanel
      v-if="workerStatus"
      :status="workerStatus"
      :refreshing="refreshingWorker"
      @refresh="refreshWorkerStatus"
    />
    <pre
      v-if="notice"
      :key="notice"
      class="operation-notice deployment-notice"
      :role="/失败|错误|不能|请检查|离线/.test(notice) ? 'alert' : 'status'"
      >{{ notice }}</pre>
    <div v-if="loading" class="panel table-state">
      <span class="loading-ring" />正在加载部署环境…
    </div>
    <div v-else-if="error" class="panel table-state error-state">
      {{ error }}<button class="secondary-button" @click="load">重试</button>
    </div>
    <section v-else-if="!environments.length" class="panel deployment-empty">
      <h2>{{ projectId ? '该项目还没有部署环境' : '还没有部署项目' }}</h2>
      <p>先添加 Git 仓库和 Linux 服务器信息，检查通过后才能部署。</p>
      <button class="primary-button" @click="router.push('/deployments/new')">
        创建第一个环境
      </button>
    </section>
    <section v-else class="deployment-grid">
      <article v-for="item in environments" :key="item.id" class="panel deployment-card">
        <header>
          <div>
            <span class="environment-kind">{{ kindText[item.kind] }}</span>
            <h2>{{ item.name }}</h2>
          </div>
          <span class="status-pill" :class="item.status"><i />{{ statusText[item.status] }}</span>
        </header>
        <dl>
          <div>
            <dt>部署项目</dt>
            <dd>{{ item.projectName }}</dd>
          </div>
          <div>
            <dt>Git</dt>
            <dd>{{ item.gitProvider }} · {{ item.gitRef }}</dd>
          </div>
          <div>
            <dt>服务器</dt>
            <dd>{{ item.sshUser }}@{{ item.host }}:{{ item.sshPort }}</dd>
          </div>
          <div>
            <dt>当前版本</dt>
            <dd>{{ releases[item.id]?.find((entry) => entry.current)?.version || '尚未部署' }}</dd>
          </div>
        </dl>
        <p class="latest-run">最近任务：{{ runs[item.id]?.[0]?.status || '暂无记录' }}</p>
        <section
          v-if="checkResults[item.id]"
          class="environment-check-result"
          :class="checkResults[item.id]?.status"
          :role="checkResults[item.id]?.status === 'error' ? 'alert' : 'status'"
        >
          <header>
            <strong>{{ checkResults[item.id]?.title }}</strong>
            <button type="button" aria-label="关闭检查结果" @click="closeCheckResult(item.id)">
              关闭
            </button>
          </header>
          <ul>
            <li v-for="line in checkResults[item.id]?.lines" :key="line">{{ line }}</li>
          </ul>
        </section>
        <div v-if="historicalReleases(item.id).length" class="release-list">
          <span>历史版本</span
          ><button
            v-for="release in historicalReleases(item.id)"
            :key="release.id"
            type="button"
            class="release-button"
            @click="rollbackChoice = { environmentId: item.id, releaseId: release.id }"
          >
            {{ release.version }} · {{ release.commitSha.slice(0, 8) }}
          </button>
        </div>
        <div v-if="rollbackChoice?.environmentId === item.id" class="rollback-confirm">
          <strong>确认回滚此环境？</strong><span>只回滚应用版本，不会自动回滚数据库。</span>
          <div>
            <button class="secondary-button" @click="rollbackChoice = undefined">取消</button
            ><button class="danger-button" :disabled="!workerStatus?.online" @click="rollback">
              确认回滚
            </button>
          </div>
        </div>
        <footer>
          <button class="secondary-button" @click="router.push(`/deployments/${item.id}/edit`)">
            编辑</button
          ><button class="secondary-button" :disabled="workingId === item.id" @click="check(item)">
            检查配置</button
          ><button
            class="primary-button"
            :disabled="item.status !== 'verified' || workingId === item.id || !workerStatus?.online"
            @click="deploy(item)"
          >
            部署
          </button>
        </footer>
      </article>
    </section>
  </div>
</template>

<style scoped>
.deployment-notice {
  white-space: pre-wrap;
}
.deployment-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 20px;
}
.deployment-card {
  padding: 24px;
}
.deployment-card header,
.deployment-card footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.deployment-history-link {
  width: 100%;
  margin-top: 14px;
  padding: 10px 0 0;
  color: #5262cf;
  background: transparent;
  border: 0;
  border-top: 1px solid #e8edf5;
}
.deployment-history {
  margin-top: 22px;
  padding: 0;
}
.deployment-history-list {
  display: grid;
}
.deployment-history-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 18px;
  padding: 16px 26px;
  border-top: 1px solid #edf0f4;
}
.deployment-history-item div {
  display: grid;
  gap: 5px;
}
.deployment-history-item span {
  color: #64748b;
  font-size: 12px;
}
@media (max-width: 720px) {
  .deployment-history-item {
    grid-template-columns: 1fr;
  }
}
.deployment-card h2 {
  margin: 6px 0 0;
}
.environment-kind {
  font-size: 12px;
  color: #64748b;
}
.deployment-card dl {
  display: grid;
  gap: 12px;
  margin: 22px 0;
}
.deployment-card dl div {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 12px;
}
.deployment-card dt {
  color: #64748b;
}
.deployment-card dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.latest-run {
  padding-top: 14px;
  border-top: 1px solid #e8edf5;
  color: #64748b;
}
.environment-check-result {
  display: grid;
  gap: 10px;
  margin: 14px 0;
  padding: 14px;
  border: 1px solid #b7dfca;
  border-radius: 12px;
  color: #17633d;
  background: #f2fbf6;
}
.environment-check-result.error {
  color: #8a2f2a;
  background: #fff7f6;
  border-color: #f2c6c3;
}
.environment-check-result header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.environment-check-result header button {
  padding: 2px 0;
  color: inherit;
  font-size: 12px;
  background: transparent;
  border: 0;
  cursor: pointer;
}
.environment-check-result ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding-left: 18px;
  color: inherit;
  font-size: 12px;
  line-height: 1.55;
}
.deployment-card footer {
  justify-content: flex-end;
}
.deployment-empty {
  text-align: center;
  padding: 64px 24px;
}
.status-pill.draft {
  color: #8a5a00;
}
.status-pill.verified {
  color: #087443;
}
.status-pill.unreachable {
  color: #b42318;
}
.release-list {
  display: grid;
  gap: 7px;
  margin: 14px 0;
}
.release-list > span {
  font-size: 12px;
  color: #64748b;
}
.release-button {
  text-align: left;
  border: 0;
  background: transparent;
  color: #4255c7;
  padding: 4px 0;
}
.rollback-confirm {
  display: grid;
  gap: 8px;
  padding: 14px;
  margin: 12px 0;
  border: 1px solid #f2c6c3;
  border-radius: 12px;
  background: #fff7f6;
}
.rollback-confirm span {
  font-size: 13px;
  color: #7a4240;
}
.rollback-confirm div {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
@media (max-width: 720px) {
  .deployment-grid {
    grid-template-columns: 1fr;
  }
  .deployment-card footer {
    flex-wrap: wrap;
  }
}
</style>

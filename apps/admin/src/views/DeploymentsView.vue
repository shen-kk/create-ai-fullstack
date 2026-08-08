<script setup lang="ts">
import type {
  DeployableApplication,
  DeploymentConnectionTestResult,
  DeploymentCnbTestResult,
  DeploymentEnvironmentKind,
  DeploymentRunSummary,
  DeploymentTargetSummary,
  UpsertDeploymentTargetRequest,
} from '@template/contracts';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import {
  createDeploymentTarget,
  getDeploymentRuns,
  getDeploymentTargets,
  startDeploymentRun,
  testDeploymentConnection,
  testDeploymentCnb,
  updateDeploymentTarget,
} from '../api/deployments';
import { apiBaseUrl } from '../api/base';
import AppSelect from '../components/AppSelect.vue';
import { project } from '../generated/project';

const targets = ref<DeploymentTargetSummary[]>([]);
const loading = ref(false);
const saving = ref(false);
const testingId = ref('');
const error = ref('');
const notice = ref('');
const editingId = ref<string>();
const dialogOpen = ref(false);
const checks = ref<Record<string, DeploymentConnectionTestResult>>({});
const cnbChecks = ref<Record<string, DeploymentCnbTestResult>>({});
const testingCnbId = ref('');
const selectedTarget = ref<DeploymentTargetSummary>();
const runs = ref<DeploymentRunSummary[]>([]);
const selectedRun = ref<DeploymentRunSummary>();
const runDialogOpen = ref(false);
const runVersion = ref('main');
const runApplications = ref<DeployableApplication[]>([]);
const deploying = ref(false);
const cnbStatus = ref<Record<string, unknown>>();
let runEvents: EventSource | undefined;
const progressLabel = computed(() => {
  const run = selectedRun.value;
  if (!run) return '等待选择部署记录';
  const finished = run.steps.filter((step) => step.status === 'succeeded').length;
  const percent = run.status === 'succeeded' ? 100 : Math.max(5, Math.round((finished / run.steps.length) * 100));
  const current = run.steps.find((step) => step.status === 'running');
  return `${percent}% · ${current?.label ?? (run.status === 'failed' ? '部署失败' : '等待下一步')}`;
});
const runProgress = computed(() => {
  const run = selectedRun.value;
  if (!run || !run.steps.length) return 0;
  if (run.status === 'succeeded') return 100;
  return Math.max(5, Math.round((run.steps.filter((step) => step.status === 'succeeded').length / run.steps.length) * 100));
});

const availableApplications = computed<Array<{ value: DeployableApplication; label: string }>>(
  () => [
    { value: 'admin', label: '后台管理' },
    { value: 'api', label: 'API 服务' },
    ...(project.modules.userWeb ? [{ value: 'web' as const, label: '用户端' }] : []),
  ],
);
const environmentOptions = [
  { value: 'development', label: '开发环境' },
  { value: 'test', label: '测试环境' },
  { value: 'staging', label: '预发布环境' },
  { value: 'production', label: '正式环境' },
  { value: 'custom', label: '自定义环境' },
];
const accessModeOptions = [
  { value: 'automatic_https', label: '自动配置域名和 HTTPS' },
  { value: 'existing_proxy', label: '使用已有反向代理' },
  { value: 'ip_port', label: '使用 IP 和端口访问' },
];
const environmentLabels: Record<DeploymentEnvironmentKind, string> = {
  development: '开发环境',
  test: '测试环境',
  staging: '预发布环境',
  production: '正式环境',
  custom: '自定义环境',
};
const statusLabels = { draft: '待验证', verified: '配置正常', unreachable: '连接失败' };
const appLabels = { admin: '后台', api: 'API', web: '用户端' };
const runStatusLabels = {
  queued: '等待中',
  building: '构建中',
  deploying: '部署中',
  succeeded: '已完成',
  failed: '失败',
  cancelled: '已取消',
  rolled_back: '已回滚',
};

const emptyForm = (): UpsertDeploymentTargetRequest => ({
  name: '',
  environment: 'test',
  applications: ['admin'],
  host: '',
  sshPort: 22,
  sshUser: 'deploy',
  deployPath: `/opt/apps/${project.name}`,
  accessMode: 'ip_port',
  adminUrl: '',
  apiUrl: '',
  webUrl: '',
  cnbRepository: '',
  cnbEvent: 'api_trigger_deploy',
  secrets: {},
});
const form = ref<UpsertDeploymentTargetRequest>(emptyForm());
const deploymentErrorMessages: Record<string, string> = {
  DEPLOYMENT_APPLICATION_URL_REQUIRED: '请先填写已选择应用的访问地址。',
  DEPLOYMENT_HTTPS_URL_REQUIRED: '自动 HTTPS 模式要求已选择应用使用 https:// 地址。',
  DEPLOYMENT_CNB_NOT_CONFIGURED: '请填写 CNB 仓库和访问令牌。',
  CNB_BUILD_TRIGGER_FAILED: 'CNB 构建触发失败，请检查仓库、触发事件和 Token 权限。',
  DEPLOYMENT_TARGET_NOT_VERIFIED: '请先通过服务器连接检查。',
  DEPLOYMENT_SSH_CREDENTIAL_REQUIRED: '请填写 SSH 私钥或 SSH 密码至少一种。',
  DEPLOYMENT_ALREADY_RUNNING: '该环境已有正在执行的部署任务。',
};
function deploymentErrorMessage(cause: unknown, fallback: string): string {
  const code = cause instanceof Error ? cause.message : '';
  return deploymentErrorMessages[code] || `${fallback}${code ? `（错误码：${code}）` : ''}`;
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    targets.value = await getDeploymentTargets();
  } catch (cause) {
    error.value = '部署环境加载失败，请检查 API、数据库迁移和当前权限。';
  } finally {
    loading.value = false;
  }
}
function openCreate(): void {
  editingId.value = undefined;
  form.value = emptyForm();
  dialogOpen.value = true;
}
function openEdit(target: DeploymentTargetSummary): void {
  editingId.value = target.id;
  form.value = {
    name: target.name,
    environment: target.environment,
    applications: [...target.applications],
    host: target.host,
    sshPort: target.sshPort,
    sshUser: target.sshUser,
    deployPath: target.deployPath,
    accessMode: target.accessMode,
    adminUrl: target.adminUrl ?? '',
    apiUrl: target.apiUrl ?? '',
    webUrl: target.webUrl ?? '',
    cnbRepository: target.cnbRepository ?? '',
    cnbEvent: target.cnbEvent,
    secrets: {},
  };
  dialogOpen.value = true;
}
function toggleApplication(application: DeployableApplication, checked: boolean): void {
  const values = new Set(form.value.applications);
  if (checked) values.add(application);
  else values.delete(application);
  form.value.applications = [...values];
}
async function save(): Promise<void> {
  saving.value = true;
  notice.value = '';
  try {
    if (editingId.value) await updateDeploymentTarget(editingId.value, form.value);
    else await createDeploymentTarget(form.value);
    dialogOpen.value = false;
    notice.value = '部署环境已安全保存。修改配置后必须重新测试连接才能部署。';
    await load();
  } catch (cause) {
    notice.value = deploymentErrorMessage(cause, '保存失败');
    notice.value = '保存失败，请检查应用、服务器地址、访问方式和必要凭据。';
  } finally {
    saving.value = false;
  }
}
async function testTarget(target: DeploymentTargetSummary): Promise<void> {
  testingId.value = target.id;
  notice.value = '';
  try {
    const result = await testDeploymentConnection(target.id);
    checks.value[target.id] = result;
    notice.value = result.success
      ? '服务器、SSH、Docker、磁盘和部署目录检查通过，现在可以部署。'
      : '连接检查未通过，请根据检查结果修改配置。';
    await load();
  } catch (cause) {
    notice.value = deploymentErrorMessage(cause, '无法执行连接检查');
    notice.value = '无法执行连接检查，请确认 API 可以访问目标服务器。';
  } finally {
    testingId.value = '';
  }
}
async function testCnb(target: DeploymentTargetSummary): Promise<void> {
  testingCnbId.value = target.id;
  notice.value = '';
  try {
    const result = await testDeploymentCnb(target.id);
    cnbChecks.value[target.id] = result;
    notice.value = result.success
      ? 'CNB 仓库、访问令牌和触发事件检查通过。'
      : 'CNB 配置检查未通过，请根据检查结果修正配置。';
  } catch (cause) {
    notice.value = deploymentErrorMessage(cause, '无法执行 CNB 配置检查');
  } finally {
    testingCnbId.value = '';
  }
}
async function showRuns(target: DeploymentTargetSummary): Promise<void> {
  selectedTarget.value = target;
  runs.value = await getDeploymentRuns(target.id);
}
function openRunDetail(run: DeploymentRunSummary): void {
  selectedRun.value = run;
  cnbStatus.value = undefined;
  if (run.cnbBuildId && selectedTarget.value) {
    void fetch(`${apiBaseUrl}/deployments/${encodeURIComponent(selectedTarget.value.id)}/runs/${encodeURIComponent(run.id)}/cnb-status`, { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : undefined))
      .then((value) => { cnbStatus.value = value; });
  }
  runEvents?.close();
  if (!selectedTarget.value || !['queued', 'building', 'deploying'].includes(run.status)) return;
  runEvents = new EventSource(
    `${apiBaseUrl}/deployments/${encodeURIComponent(selectedTarget.value.id)}/runs/${encodeURIComponent(run.id)}/events`,
  );
  runEvents.onmessage = (event) => {
    selectedRun.value = JSON.parse(event.data) as DeploymentRunSummary;
    if (!['queued', 'building', 'deploying'].includes(selectedRun.value.status)) runEvents?.close();
  };
  runEvents.onerror = () => runEvents?.close();
}
function openDeploy(target: DeploymentTargetSummary): void {
  selectedTarget.value = target;
  runVersion.value = 'main';
  runApplications.value = [...target.applications];
  runDialogOpen.value = true;
}
async function deploy(): Promise<void> {
  if (!selectedTarget.value) return;
  deploying.value = true;
  try {
    await startDeploymentRun(selectedTarget.value.id, {
      version: runVersion.value,
      applications: runApplications.value,
    });
    runDialogOpen.value = false;
    notice.value = '已提交 CNB 构建任务，可以在部署记录中查看进度。';
    await showRuns(selectedTarget.value);
  } catch (cause) {
    notice.value = deploymentErrorMessage(cause, '部署任务创建失败');
    notice.value = '部署任务创建失败，请确认环境已验证并已配置 CNB 仓库与令牌。';
  } finally {
    deploying.value = false;
  }
}
function formatDate(value: string | null): string {
  if (!value) return '尚未执行';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
onMounted(load);
onUnmounted(() => runEvents?.close());
</script>

<template>
  <div>
    <section class="page-heading">
      <div>
        <p class="eyebrow">系统管理 / 部署中心</p>
        <h1>部署中心</h1>
        <p>管理多个环境；只有初始化时启用的应用会出现在部署范围中。</p>
      </div>
      <div class="heading-actions">
        <button class="secondary-button" :disabled="loading" @click="load">刷新</button>
        <button class="primary-button" @click="openCreate">新增部署环境</button>
      </div>
    </section>

    <p v-if="notice" class="operation-notice" role="status">{{ notice }}</p>
    <div v-if="loading" class="panel table-state"><span class="loading-ring" />正在加载…</div>
    <div v-else-if="error" class="panel table-state error-state">{{ error }}</div>
    <section v-else-if="targets.length" class="deployment-grid">
      <article v-for="target in targets" :key="target.id" class="panel deployment-card">
        <header>
          <div>
            <span class="deployment-kind">{{ environmentLabels[target.environment] }}</span>
            <h2>{{ target.name }}</h2>
          </div>
          <span class="status-pill" :class="{ neutral: target.status !== 'verified' }">
            <i />{{ statusLabels[target.status] }}
          </span>
        </header>
        <div class="deployment-apps">
          <span v-for="application in target.applications" :key="application">{{
            appLabels[application]
          }}</span>
        </div>
        <dl>
          <div>
            <dt>目标服务器</dt>
            <dd>{{ target.sshUser }}@{{ target.host }}:{{ target.sshPort }}</dd>
          </div>
          <div>
            <dt>部署目录</dt>
            <dd>{{ target.deployPath }}</dd>
          </div>
          <div>
            <dt>最近验证</dt>
            <dd>{{ formatDate(target.lastVerifiedAt) }}</dd>
          </div>
          <div>
            <dt>构建仓库</dt>
            <dd>{{ target.cnbRepository || '尚未配置' }}</dd>
          </div>
        </dl>
        <div v-if="checks[target.id]" class="deployment-checks">
          <p
            v-for="check in checks[target.id]?.checks ?? []"
            :key="check.key"
            :class="check.status"
          >
            <b>{{ check.status === 'passed' ? '✓' : '×' }}</b
            ><span>{{ check.label }}</span
            ><small>{{ check.message }}</small>
          </p>
        </div>
        <div v-if="cnbChecks[target.id]" class="deployment-checks">
          <p
            v-for="check in cnbChecks[target.id]?.checks ?? []"
            :key="`cnb-${check.key}`"
            :class="check.status"
          >
            <b>{{ check.status === 'passed' ? '✓' : '×' }}</b>
            <span>{{ check.label }}</span>
            <small>{{ check.message }}</small>
          </p>
        </div>
        <footer>
          <button class="secondary-button" @click="openEdit(target)">编辑</button>
          <button
            class="secondary-button"
            :disabled="testingId === target.id"
            @click="testTarget(target)"
          >
            {{ testingId === target.id ? '检查中…' : '测试连接' }}
          </button>
          <button
            class="secondary-button"
            :disabled="testingCnbId === target.id"
            @click="testCnb(target)"
          >
            {{ testingCnbId === target.id ? '检查中…' : '检查 CNB' }}
          </button>
          <button class="secondary-button" @click="showRuns(target)">部署记录</button>
          <button
            class="primary-button"
            :disabled="target.status !== 'verified'"
            @click="openDeploy(target)"
          >
            构建并部署
          </button>
        </footer>
      </article>
    </section>
    <section v-else class="panel deployment-empty">
      <strong>还没有部署环境</strong>
      <p>第一次部署前，先添加服务器、访问方式与 CNB 构建配置。</p>
      <button class="primary-button" @click="openCreate">新增第一个环境</button>
    </section>

    <section v-if="selectedTarget && runs.length" class="panel deployment-runs">
      <header>
        <div>
          <p class="eyebrow">部署记录</p>
          <h2>{{ selectedTarget.name }}</h2>
        </div>
      </header>
      <article
        v-for="run in runs"
        :key="run.id"
        class="deployment-run-item"
        tabindex="0"
        @click="openRunDetail(run)"
        @keydown.enter="openRunDetail(run)"
      >
        <div>
          <strong>{{ run.version }}</strong
          ><small>{{ formatDate(run.createdAt) }}</small>
        </div>
        <div class="deployment-apps">
          <span v-for="application in run.applications" :key="application">{{
            appLabels[application]
          }}</span>
        </div>
        <span class="run-status" :class="run.status">{{ runStatusLabels[run.status] }}</span>
      </article>
    </section>

    <div v-if="selectedRun" class="dialog-backdrop">
      <section class="user-dialog deployment-run-detail" aria-labelledby="run-detail-title">
        <header>
          <div>
            <p class="eyebrow">部署记录详情</p>
            <h2 id="run-detail-title">{{ selectedRun.version }}</h2>
          </div>
          <button
            type="button"
            class="dialog-close"
            aria-label="关闭"
            @click="selectedRun = undefined"
          >
            ×
          </button>
        </header>
        <div class="run-detail-summary">
          <span
            >状态：<strong class="run-status" :class="selectedRun.status">{{
              runStatusLabels[selectedRun.status]
            }}</strong></span
          >
          <span
            >应用：{{ selectedRun.applications.map((item) => appLabels[item]).join('、') }}</span
          >
          <span>任务 ID：{{ selectedRun.id }}</span>
          <span>CNB 构建 ID：{{ selectedRun.cnbBuildId || '等待返回' }}</span>
          <span>创建时间：{{ formatDate(selectedRun.createdAt) }}</span>
          <span v-if="selectedRun.completedAt"
            >完成时间：{{ formatDate(selectedRun.completedAt) }}</span
          >
          <span v-if="selectedRun.errorCode" class="run-error"
            >错误：{{ selectedRun.errorCode }}</span
          >
        </div>
        <div class="deployment-progress" aria-live="polite">
          <div class="deployment-progress-head">
            <strong>当前进度</strong><span>{{ progressLabel }}</span>
          </div>
          <div class="deployment-progress-track"><span :style="{ width: `${runProgress}%` }" /></div>
        </div>
        <div v-if="cnbStatus" class="cnb-stage-summary">
          <strong>CNB 实时阶段</strong>
          <pre>{{ JSON.stringify(cnbStatus, null, 2) }}</pre>
        </div>
        <ol class="deployment-step-list">
          <li v-for="step in selectedRun.steps" :key="step.key" :class="step.status">
            <span class="step-marker">{{
              step.status === 'succeeded' ? '✓' : step.status === 'running' ? '•' : '·'
            }}</span>
            <div>
              <strong>{{ step.label }}</strong
              ><small>{{ step.status }}</small>
            </div>
          </li>
        </ol>
      </section>
    </div>

    <div v-if="dialogOpen" class="dialog-backdrop">
      <form class="user-dialog deployment-dialog" @submit.prevent="save">
        <header>
          <div>
            <p class="eyebrow">部署环境</p>
            <h2>{{ editingId ? '编辑环境' : '新增环境' }}</h2>
          </div>
          <button type="button" class="dialog-close" aria-label="关闭" @click="dialogOpen = false">
            ×
          </button>
        </header>
        <div class="dialog-scroll-content">
          <div class="deployment-form-grid">
            <label
              ><span>环境名称</span
              ><input v-model.trim="form.name" required placeholder="例如：正式环境"
            /></label>
            <label
              ><span>环境类型</span
              ><AppSelect
                v-model="form.environment"
                :options="environmentOptions"
                aria-label="环境类型"
            /></label>
          </div>
          <fieldset>
            <legend>部署应用</legend>
            <label
              v-for="application in availableApplications"
              :key="application.value"
              class="app-choice"
            >
              <input
                type="checkbox"
                :checked="form.applications.includes(application.value)"
                @change="
                  toggleApplication(application.value, ($event.target as HTMLInputElement).checked)
                "
              />
              <span>{{ application.label }}</span>
            </label>
          </fieldset>
          <div class="deployment-form-grid">
            <label
              ><span>服务器 IP 或域名</span
              ><input v-model.trim="form.host" required placeholder="server.example.com"
            /></label>
            <label
              ><span>SSH 端口</span
              ><input v-model.number="form.sshPort" required type="number" min="1" max="65535"
            /></label>
            <label><span>SSH 用户</span><input v-model.trim="form.sshUser" required /></label>
            <label><span>部署目录</span><input v-model.trim="form.deployPath" required /></label>
          </div>
          <label
            ><span>访问方式</span
            ><AppSelect
              v-model="form.accessMode"
              :options="accessModeOptions"
              aria-label="访问方式"
          /></label>
          <p v-if="form.accessMode === 'automatic_https'" class="permission-help">
            系统将部署 Caddy 并自动申请、续期 HTTPS 证书。域名必须提前解析到该服务器，且开放 80/443
            端口；系统不会自动修改 DNS。
          </p>
          <div class="deployment-form-grid">
            <label v-if="form.applications.includes('admin')"
              ><span>后台地址</span
              ><input v-model.trim="form.adminUrl" required placeholder="https://admin.example.com"
            /></label>
            <label
              ><span>API 地址</span
              ><input
                v-model.trim="form.apiUrl"
                :required="form.applications.includes('api')"
                :class="{ 'is-hidden': !form.applications.includes('api') }"
                placeholder="https://api.example.com"
            /></label>
            <label v-if="form.applications.includes('web')"
              ><span>用户端地址</span
              ><input v-model.trim="form.webUrl" required placeholder="https://www.example.com"
            /></label>
          </div>
          <fieldset>
            <legend>服务器凭据</legend>
            <label
              ><span>SSH 私钥</span
              ><textarea
                v-model="form.secrets.sshPrivateKey"
                rows="4"
                :placeholder="editingId ? '留空保留原私钥' : '推荐使用专用部署私钥'"
              />
            </label>
            <label
              ><span>SSH 密码</span
              ><input
                v-model="form.secrets.sshPassword"
                type="password"
                autocomplete="new-password"
                :placeholder="editingId ? '留空保留原密码' : '私钥与密码至少填写一种'"
            /></label>
          </fieldset>
          <fieldset>
            <legend>CNB 构建</legend>
            <div class="deployment-form-grid">
              <label
                ><span>仓库</span
                ><input v-model.trim="form.cnbRepository" required placeholder="组织/仓库"
              /></label>
              <label><span>触发事件</span><input v-model.trim="form.cnbEvent" required /></label>
            </div>
            <label
              ><span>CNB 访问令牌</span
              ><input
                v-model="form.secrets.cnbToken"
                type="password"
                autocomplete="new-password"
                :placeholder="editingId ? '留空保留原令牌' : '需要触发构建与读取制品权限'"
            /></label>
          </fieldset>
          <p class="permission-help">
            所有凭据由 API 加密保存，页面只能看到已配置字段名，无法读取明文。
          </p>
        </div>
        <footer>
          <button type="button" class="secondary-button" @click="dialogOpen = false">取消</button>
          <button class="primary-button" :disabled="saving">
            {{ saving ? '保存中…' : '保存并等待验证' }}
          </button>
        </footer>
      </form>
    </div>

    <div v-if="runDialogOpen && selectedTarget" class="dialog-backdrop">
      <form class="user-dialog deployment-run-dialog" @submit.prevent="deploy">
        <header>
          <div>
            <p class="eyebrow">构建并部署</p>
            <h2>{{ selectedTarget.name }}</h2>
          </div>
          <button
            type="button"
            class="dialog-close"
            aria-label="关闭"
            @click="runDialogOpen = false"
          >
            ×
          </button>
        </header>
        <label
          ><span>Git 分支、Tag 或 Commit</span
          ><input v-model.trim="runVersion" required placeholder="main 或 v1.0.0"
        /></label>
        <fieldset>
          <legend>本次部署应用</legend>
          <label
            v-for="application in selectedTarget.applications"
            :key="application"
            class="app-choice"
          >
            <input v-model="runApplications" type="checkbox" :value="application" />
            <span>{{ appLabels[application] }}</span>
          </label>
        </fieldset>
        <p class="permission-help">
          当前版本会先触发 CNB 构建并保存任务；远程 Deploy Agent
          接管完成前，任务只会显示“构建中”，不会错误标记为部署成功。只有检测到新 Prisma migration
          时才需要迁移数据库。
        </p>
        <footer>
          <button type="button" class="secondary-button" @click="runDialogOpen = false">
            取消
          </button>
          <button class="primary-button" :disabled="deploying || !runApplications.length">
            {{ deploying ? '正在提交…' : '确认部署' }}
          </button>
        </footer>
      </form>
    </div>
  </div>
</template>

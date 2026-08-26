<script setup lang="ts">
import type {
  DeploymentProjectSummary,
  DeploymentVariableDefinition,
  ServiceResourceSummary,
  UpsertDeploymentEnvironmentRequest,
} from '@template/contracts';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  createDeploymentEnvironment,
  getDeploymentEnvironment,
  getDeploymentEnvironmentSecrets,
  listDeploymentProjects,
  updateDeploymentEnvironment,
} from '../api/deployments';
import AppPasswordInput from '../components/AppPasswordInput.vue';
import AppSelect from '../components/AppSelect.vue';
import { getServiceResources } from '../api/integrations';

const route = useRoute(),
  router = useRouter();
const id = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''));
const saving = ref(false),
  loading = ref(Boolean(id.value)),
  error = ref(''),
  revealingSecrets = ref(false),
  secretsRevealed = ref(false);
const resources = ref<ServiceResourceSummary[]>([]);
const projects = ref<DeploymentProjectSummary[]>([]);
const selectedProject = computed(() =>
  projects.value.find((project) => project.id === form.value.projectId),
);
const projectOptions = computed(() =>
  projects.value.map((project) => ({ value: project.id, label: project.name })),
);
const projectVariables = computed(() => selectedProject.value?.variables ?? []);
const resourceOptions = (kind: ServiceResourceSummary['kind']) => [
  ...resources.value
    .filter((item) => item.kind === kind && item.enabled)
    .map((item) => ({
      value: item.id,
      label:
        kind === 'server' && item.values.deployRoot
          ? `${item.name} · ${item.values.deployRoot}`
          : item.name,
    })),
];
const form = ref<UpsertDeploymentEnvironmentRequest>({
  name: '',
  kind: 'test',
  projectId: '',
  serverResourceId: '',
  gitResourceId: '',
  gitProvider: 'github',
  repositoryUrl: '',
  gitRef: 'main',
  gitAuthMode: 'token',
  host: '',
  sshPort: 22,
  sshUser: 'deploy',
  sshAuthMode: 'private_key',
  deployPath: '',
  retainReleases: 5,
  values: {},
  secrets: {},
});
const kindOptions = [
  { value: 'development', label: '开发环境' },
  { value: 'test', label: '测试环境' },
  { value: 'staging', label: '预发布环境' },
  { value: 'production', label: '正式环境' },
  { value: 'custom', label: '自定义环境' },
];
const deploymentErrorMessages: Record<string, string> = {
  DEPLOYMENT_RESOURCE_BINDING_REQUIRED: '请先绑定部署服务器和 Git 仓库资源。',
  DEPLOYMENT_SQL_RESOURCE_REQUIRED: '当前项目需要 SQL 数据库，请先绑定 SQL 资源。',
  DEPLOYMENT_REDIS_RESOURCE_REQUIRED: '当前项目需要 Redis，请先绑定 Redis 资源。',
  DEPLOYMENT_RESOURCE_BINDING_INVALID: '绑定的服务资源不存在、类型不匹配或未启用。',
  DEPLOYMENT_CONFIGURATION_INVALID: '部署配置不完整，请检查实际部署路径和必填字段。',
  DEPLOYMENT_SECRETS_REENTRY_REQUIRED: '敏感配置无法解密，请重新填写并保存相关密钥。',
  DEPLOYMENT_WORKER_INTERRUPTED: '部署执行器中断，任务已自动失败，请重新部署。',
};
function deploymentError(cause: unknown, fallback: string): string {
  const code = cause instanceof Error ? cause.message : '';
  return deploymentErrorMessages[code] ?? (code || fallback);
}
watch(
  () => form.value.serverResourceId,
  (serverResourceId) => {
    if (id.value || form.value.deployPath || !serverResourceId) return;
    const server = resources.value.find((item) => item.id === serverResourceId);
    const deployRoot = server?.values.deployRoot;
    if (deployRoot) form.value.deployPath = deployRoot;
  },
);
function variableValue(variable: DeploymentVariableDefinition): string {
  return variable.secret
    ? (form.value.secrets.variables?.[variable.key] ?? '')
    : (form.value.values?.[variable.key] ?? '');
}
function updateVariable(variable: DeploymentVariableDefinition, value: string): void {
  if (variable.secret) {
    form.value.secrets.variables = { ...form.value.secrets.variables, [variable.key]: value };
  } else {
    form.value.values = { ...form.value.values, [variable.key]: value };
  }
}
function projectResourceKind(
  variable: DeploymentVariableDefinition,
): ServiceResourceSummary['kind'] | null {
  if (variable.resourceKind === 'sql' || variable.resourceKind === 'redis')
    return variable.resourceKind;
  return null;
}
async function load(): Promise<void> {
  if (!id.value) return;
  try {
    const item = await getDeploymentEnvironment(id.value);
    form.value = {
      name: item.name,
      kind: item.kind,
      projectId: item.projectId,
      gitProvider: item.gitProvider,
      repositoryUrl: item.repositoryUrl,
      gitRef: item.gitRef,
      gitAuthMode: item.gitAuthMode,
      host: item.host,
      sshPort: item.sshPort,
      sshUser: item.sshUser,
      sshAuthMode: item.sshAuthMode,
      deployPath: item.deployPath,
      adminUrl: item.adminUrl ?? '',
      apiUrl: item.apiUrl ?? '',
      webUrl: item.webUrl ?? '',
      healthCheckUrl: item.healthCheckUrl ?? '',
      retainReleases: item.retainReleases,
      serverResourceId: item.serverResourceId ?? '',
      gitResourceId: item.gitResourceId ?? '',
      sqlResourceId: item.sqlResourceId ?? '',
      redisResourceId: item.redisResourceId ?? '',
      values: item.values,
      secrets: {},
    };
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '环境加载失败';
  } finally {
    loading.value = false;
  }
}
async function save(): Promise<void> {
  if (!form.value.projectId) {
    error.value = '请选择部署项目';
    return;
  }
  if (!form.value.serverResourceId || !form.value.gitResourceId) {
    error.value = '请先绑定部署服务器和 Git 仓库资源。';
    return;
  }
  if (!form.value.deployPath.trim()) {
    error.value = '请填写当前环境的实际部署路径。';
    return;
  }
  saving.value = true;
  error.value = '';
  try {
    if (id.value) await updateDeploymentEnvironment(id.value, form.value);
    else await createDeploymentEnvironment(form.value);
    await router.push(`/deployments/projects/${form.value.projectId}`);
  } catch (cause) {
    error.value = deploymentError(cause, '保存失败，请检查必填字段');
  } finally {
    saving.value = false;
  }
}
async function revealSecrets(): Promise<void> {
  if (!id.value || secretsRevealed.value) return;
  revealingSecrets.value = true;
  error.value = '';
  try {
    form.value.secrets = await getDeploymentEnvironmentSecrets(id.value);
    secretsRevealed.value = true;
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : '';
    error.value = code === 'FORBIDDEN' || code.includes('403')
      ? '当前账号没有“查看敏感配置明文”权限。'
      : code === 'DEPLOYMENT_SECRETS_REENTRY_REQUIRED'
        ? '历史部署密钥已无法解密，请重新填写并保存。'
        : '密钥读取失败，请检查权限或 API。';
  } finally {
    revealingSecrets.value = false;
  }
}
onMounted(async () => {
  [resources.value, projects.value] = await Promise.all([
    getServiceResources().catch(() => []),
    listDeploymentProjects().catch(() => []),
  ]);
  const queryProjectId = typeof route.query.projectId === 'string' ? route.query.projectId : '';
  if (!id.value && queryProjectId && projects.value.some((item) => item.id === queryProjectId)) {
    form.value.projectId = queryProjectId;
  }
  await load();
});
</script>

<template>
  <div>
    <section class="page-heading">
      <div>
        <p class="eyebrow">部署中心 / 环境配置</p>
        <h1>{{ id ? '编辑环境' : '新增环境' }}</h1>
        <p>配置保存后需要分别检查 Git 和服务器，全部通过才允许部署。</p>
      </div>
      <button
        class="secondary-button"
        @click="router.push(`/deployments/projects/${form.projectId}`)"
      >
        返回列表
      </button>
    </section>
    <div v-if="loading" class="panel table-state"><span class="loading-ring" />正在加载…</div>
    <form v-else class="panel deployment-form" @submit.prevent="save">
      <p v-if="error" class="operation-notice" role="alert">{{ error }}</p>
      <fieldset>
        <legend>基本信息</legend>
        <div class="form-grid">
          <label class="wide"
            ><span>部署项目 <b class="required-mark">*</b></span
            ><AppSelect
              v-model="form.projectId"
              :options="projectOptions"
              aria-label="部署项目"
              placeholder="请选择已定义的部署项目"
          /></label>
          <label
            ><span>环境名称</span
            ><input v-model.trim="form.name" required placeholder="例如：正式环境" /></label
          ><label
            ><span>环境类型 <b class="required-mark">*</b></span
            ><AppSelect v-model="form.kind" :options="kindOptions" aria-label="环境类型"
          /></label>
        </div>
        <div v-if="selectedProject" class="project-summary">
          <div>
            <strong>{{ selectedProject.name }}</strong
            ><small>{{ selectedProject.description || '该环境将使用项目保存的构建规则。' }}</small>
          </div>
          <div class="unit-tags">
            <span v-for="unit in selectedProject.units" :key="unit.key">{{ unit.name }}</span>
          </div>
          <p>
            部署时默认执行以上全部单元；需要拆分部署时，应建立独立部署项目，而不是在环境中临时改变构建规则。
          </p>
        </div>
      </fieldset>
      <fieldset>
        <legend>服务资源绑定</legend>
        <div class="form-grid">
          <label
            ><span>部署服务器 <b class="required-mark">*</b></span
            ><AppSelect
              :model-value="form.serverResourceId ?? ''"
              @update:model-value="form.serverResourceId = $event"
              :options="resourceOptions('server')"
              aria-label="部署服务器"
          /></label>
          <label
            ><span>Git 仓库资源 <b class="required-mark">*</b></span
            ><AppSelect
              :model-value="form.gitResourceId ?? ''"
              @update:model-value="form.gitResourceId = $event"
              :options="resourceOptions('git')"
              aria-label="Git 仓库资源"
          /></label>
          <label class="wide"
            ><span>实际部署路径 <b class="required-mark">*</b></span
            ><input
              v-model.trim="form.deployPath"
              required
              placeholder="例如：/www/wwwroot/my-app"
          /></label>
          <label v-if="projectVariables.some((item) => item.resourceKind === 'sql')"
            ><span>SQL 数据库 <b class="required-mark">*</b></span
            ><AppSelect
              :model-value="form.sqlResourceId ?? ''"
              @update:model-value="form.sqlResourceId = $event"
              :options="resourceOptions('sql')"
              aria-label="SQL 数据库"
          /></label>
          <label v-if="projectVariables.some((item) => item.resourceKind === 'redis')"
            ><span>Redis <b class="required-mark">*</b></span
            ><AppSelect
              :model-value="form.redisResourceId ?? ''"
              @update:model-value="form.redisResourceId = $event"
              :options="resourceOptions('redis')"
              aria-label="Redis"
          /></label>
        </div>
        <p class="permission-help">
          所有部署资源必须先在“服务配置”中创建并校验，再绑定到当前环境。服务器资源中的默认路径仅作为模板建议，实际部署使用此环境填写的路径。
        </p>
        <p
          v-if="!resourceOptions('server').length || !resourceOptions('git').length"
          class="operation-notice"
          role="status"
        >
          当前缺少必需的服务器或 Git 资源，请先到“服务配置”创建并校验资源后再保存环境。
        </p>
      </fieldset>
      <fieldset v-if="projectVariables.length">
        <legend>项目运行变量</legend>
        <p class="permission-help">字段来自部署项目定义。敏感值加密保存，编辑时留空会保留原值。</p>
        <div class="form-grid">
          <label
            class="variable-field"
            v-for="variable in projectVariables.filter((item) => !projectResourceKind(item))"
            :key="variable.key"
          >
            <span class="field-label-text">
              {{ variable.label }}<b v-if="variable.required"> *</b>
              <small>{{ variable.key }}</small>
            </span>
            <AppPasswordInput
              v-if="variable.secret"
              :model-value="variableValue(variable)"
              @update:model-value="updateVariable(variable, $event)"
              @reveal="revealSecrets"
              :revealable="Boolean(id)"
              :revealing="revealingSecrets"
              :required="variable.required && !id"
              :placeholder="id ? '••••••••（已加密保存）' : '请输入敏感值'"
            />
            <input
              v-else
              :value="variableValue(variable)"
              @input="updateVariable(variable, ($event.target as HTMLInputElement).value)"
              :required="variable.required"
              :placeholder="variable.key"
            />
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend>访问与发布</legend>
        <div class="form-grid">
          <label v-if="selectedProject?.units.some((unit) => unit.key === 'admin')"
            ><span>后台地址</span
            ><input
              v-model.trim="form.adminUrl"
              type="url"
              placeholder="https://admin.example.com" /></label
          ><label v-if="selectedProject?.units.some((unit) => unit.key === 'api')"
            ><span>API 地址</span
            ><input
              v-model.trim="form.apiUrl"
              type="url"
              placeholder="https://api.example.com" /></label
          ><label v-if="selectedProject?.units.some((unit) => unit.key === 'web')"
            ><span>用户端地址</span
            ><input
              v-model.trim="form.webUrl"
              type="url"
              placeholder="https://example.com" /></label
          ><label
            ><span>健康检查地址</span
            ><input
              v-model.trim="form.healthCheckUrl"
              type="url"
              placeholder="https://api.example.com/api/health/ready" /></label
          ><label
            ><span>保留历史版本</span
            ><input v-model.number="form.retainReleases" type="number" min="1" max="20"
          /></label>
        </div>
      </fieldset>
      <p class="security-note">
        所有凭据由 API
        加密保存，默认不显示明文；只有拥有部署管理权限的管理员可以主动显示。编辑时凭据留空表示保留原值。
      </p>
      <footer>
        <button
          type="button"
          class="secondary-button"
          @click="router.push(`/deployments/projects/${form.projectId}`)"
        >
          取消</button
        ><button class="primary-button" :disabled="saving">
          {{ saving ? '保存中…' : '保存环境' }}
        </button>
      </footer>
    </form>
  </div>
</template>

<style scoped>
.deployment-form {
  padding: 28px;
  display: grid;
  gap: 24px;
}
.deployment-form fieldset {
  display: grid;
  gap: 18px;
  border: 1px solid #dfe6f1;
  border-radius: 16px;
  padding: 22px;
}
.deployment-form legend {
  padding: 0 8px;
  font-weight: 700;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}
.form-grid label,
.deployment-form > fieldset > label {
  display: grid;
  gap: 8px;
}
.wide {
  grid-column: 1/-1;
}
.deployment-form input,
.deployment-form textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #d7dfec;
  border-radius: 11px;
  padding: 12px 14px;
  font: inherit;
}
.deployment-form textarea {
  resize: vertical;
}
.project-summary {
  display: grid;
  gap: 12px;
  padding: 18px;
  border: 1px solid #dfe6f1;
  border-radius: 14px;
  background: #f8fafc;
}
.project-summary > div:first-child {
  display: grid;
  gap: 5px;
}
.project-summary small,
.project-summary p {
  color: #64748b;
}
.project-summary p {
  margin: 0;
  font-size: 13px;
}
.unit-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.unit-tags span {
  padding: 6px 10px;
  border-radius: 999px;
  background: #e9edff;
  color: #3f51cf;
  font-size: 13px;
  font-weight: 650;
}
.form-grid label > span small {
  display: block;
  margin-top: 3px;
  color: #94a3b8;
  font:
    500 11px/1.2 ui-monospace,
    monospace;
}
.field-label-text b {
  color: #d14343;
  font-weight: 700;
}
.required-mark {
  color: #d14343;
  font-weight: 700;
}
.security-note {
  padding: 14px 16px;
  border-radius: 12px;
  background: #f7f9fc;
  color: #64748b;
}
.deployment-form footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
@media (max-width: 760px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .wide {
    grid-column: auto;
  }
  .deployment-form {
    padding: 18px;
  }
}
</style>

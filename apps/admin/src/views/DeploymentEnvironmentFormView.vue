<script setup lang="ts">
import type { DeployApplication, UpsertDeploymentEnvironmentRequest } from '@template/contracts';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  createDeploymentEnvironment,
  getDeploymentEnvironment,
  getDeploymentEnvironmentSecrets,
  updateDeploymentEnvironment,
} from '../api/deployments';
import AppCheckbox from '../components/AppCheckbox.vue';
import AppSelect from '../components/AppSelect.vue';

const route = useRoute(),
  router = useRouter();
const id = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''));
const saving = ref(false),
  loading = ref(Boolean(id.value)),
  error = ref(''),
  revealingSecrets = ref(false),
  secretsRevealed = ref(false);
const form = ref<UpsertDeploymentEnvironmentRequest>({
  name: '',
  kind: 'test',
  applications: ['admin'],
  gitProvider: 'github',
  repositoryUrl: '',
  gitRef: 'main',
  gitAuthMode: 'token',
  host: '',
  sshPort: 22,
  sshUser: 'deploy',
  sshAuthMode: 'private_key',
  deployPath: '/opt/apps/aiforge',
  retainReleases: 5,
  secrets: {},
});
const kindOptions = [
  { value: 'development', label: '开发环境' },
  { value: 'test', label: '测试环境' },
  { value: 'staging', label: '预发布环境' },
  { value: 'production', label: '正式环境' },
  { value: 'custom', label: '自定义环境' },
];
const providerOptions = [
  { value: 'github', label: 'GitHub' },
  { value: 'gitlab', label: 'GitLab' },
  { value: 'cnb', label: 'CNB' },
  { value: 'gitee', label: 'Gitee' },
  { value: 'generic', label: '通用 Git' },
];
const gitAuthOptions = [
  { value: 'none', label: '公开仓库，无需认证' },
  { value: 'token', label: 'HTTPS 访问令牌' },
  { value: 'ssh_key', label: 'SSH 私钥' },
];
const sshAuthOptions = [
  { value: 'private_key', label: 'SSH 私钥（推荐）' },
  { value: 'password', label: 'SSH 密码' },
];
function toggleApplication(value: DeployApplication, checked: boolean): void {
  const selected = new Set(form.value.applications);
  checked ? selected.add(value) : selected.delete(value);
  form.value.applications = [...selected];
}
async function load(): Promise<void> {
  if (!id.value) return;
  try {
    const item = await getDeploymentEnvironment(id.value);
    form.value = {
      name: item.name,
      kind: item.kind,
      applications: item.applications,
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
      secrets: {},
    };
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '环境加载失败';
  } finally {
    loading.value = false;
  }
}
async function save(): Promise<void> {
  if (!form.value.applications.length) {
    error.value = '请至少选择一个部署应用';
    return;
  }
  saving.value = true;
  error.value = '';
  try {
    if (id.value) await updateDeploymentEnvironment(id.value, form.value);
    else await createDeploymentEnvironment(form.value);
    await router.push('/deployments');
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '保存失败，请检查必填字段';
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
    error.value = cause instanceof Error ? cause.message : '密钥读取失败，请确认管理员权限';
  } finally {
    revealingSecrets.value = false;
  }
}
onMounted(load);
</script>

<template>
  <div>
    <section class="page-heading">
      <div>
        <p class="eyebrow">部署中心 / 环境配置</p>
        <h1>{{ id ? '编辑环境' : '新增环境' }}</h1>
        <p>配置保存后需要分别检查 Git 和服务器，全部通过才允许部署。</p>
      </div>
      <button class="secondary-button" @click="router.push('/deployments')">返回列表</button>
    </section>
    <div v-if="loading" class="panel table-state"><span class="loading-ring" />正在加载…</div>
    <form v-else class="panel deployment-form" @submit.prevent="save">
      <p v-if="error" class="operation-notice" role="alert">{{ error }}</p>
      <fieldset>
        <legend>基本信息</legend>
        <div class="form-grid">
          <label
            ><span>环境名称</span
            ><input v-model.trim="form.name" required placeholder="例如：正式环境" /></label
          ><label
            ><span>环境类型</span
            ><AppSelect v-model="form.kind" :options="kindOptions" aria-label="环境类型"
          /></label>
        </div>
        <label
          ><span>部署应用</span>
          <div class="application-options">
            <AppCheckbox
              v-for="item in [
                ['admin', '后台管理'],
                ['api', 'API 服务'],
                ['web', '用户端'],
              ] as const"
              :key="item[0]"
              class="application-option"
              :model-value="form.applications.includes(item[0])"
              :label="item[1]"
              @update:model-value="toggleApplication(item[0], $event)"
            />
          </div></label
        >
      </fieldset>
      <fieldset>
        <legend>Git 仓库</legend>
        <div class="form-grid">
          <label
            ><span>Git 平台</span
            ><AppSelect
              v-model="form.gitProvider"
              :options="providerOptions"
              aria-label="Git 平台" /></label
          ><label
            ><span>认证方式</span
            ><AppSelect
              v-model="form.gitAuthMode"
              :options="gitAuthOptions"
              aria-label="Git 认证方式" /></label
          ><label class="wide"
            ><span>仓库地址</span
            ><input
              v-model.trim="form.repositoryUrl"
              required
              placeholder="https://github.com/org/repo.git" /></label
          ><label><span>分支或 Tag</span><input v-model.trim="form.gitRef" required /></label
          ><label v-if="form.gitAuthMode === 'token'"
            ><span>Git 访问令牌</span
            ><input
              v-model="form.secrets.gitToken"
              type="password"
              autocomplete="new-password"
              placeholder="留空保留原令牌" /></label
          ><label v-if="form.gitAuthMode === 'ssh_key'" class="wide"
            ><span>Git SSH 私钥</span
            ><textarea
              v-model="form.secrets.gitSshPrivateKey"
              rows="4"
              placeholder="留空保留原私钥"
            />
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend>Linux 服务器</legend>
        <div class="form-grid">
          <label
            ><span>服务器 IP 或域名</span
            ><input v-model.trim="form.host" required placeholder="server.example.com" /></label
          ><label
            ><span>SSH 端口</span
            ><input
              v-model.number="form.sshPort"
              type="number"
              min="1"
              max="65535"
              required /></label
          ><label><span>SSH 用户</span><input v-model.trim="form.sshUser" required /></label
          ><label
            ><span>SSH 认证方式</span
            ><AppSelect
              v-model="form.sshAuthMode"
              :options="sshAuthOptions"
              aria-label="SSH 认证方式" /></label
          ><label class="wide"
            ><span>部署根目录</span
            ><input
              v-model.trim="form.deployPath"
              required
              placeholder="/opt/apps/aiforge" /></label
          ><label v-if="form.sshAuthMode === 'password'" class="wide"
            ><span>SSH 密码</span
            ><input
              v-model="form.secrets.sshPassword"
              type="password"
              autocomplete="new-password"
              placeholder="留空保留原密码" /></label
          ><label v-else class="wide"
            ><span>SSH 私钥</span
            ><textarea v-model="form.secrets.sshPrivateKey" rows="5" placeholder="留空保留原私钥" />
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend>访问与发布</legend>
        <div v-if="id" class="secret-actions">
          <button type="button" class="secondary-button" :disabled="revealingSecrets" @click="revealSecrets">
            {{ revealingSecrets ? '读取中…' : secretsRevealed ? '已显示已保存密钥' : '显示已保存密钥（管理员）' }}
          </button>
        </div>
        <div class="form-grid">
          <label v-if="form.applications.includes('admin')"
            ><span>后台地址</span
            ><input
              v-model.trim="form.adminUrl"
              type="url"
              placeholder="https://admin.example.com" /></label
          ><label v-if="form.applications.includes('api')"
            ><span>API 地址</span
            ><input
              v-model.trim="form.apiUrl"
              type="url"
              placeholder="https://api.example.com" /></label
          ><label v-if="form.applications.includes('web')"
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
          /></label
          ><label v-if="form.applications.includes('api')" class="wide"
            ><span>数据库连接 DATABASE_URL</span
            ><input v-model="form.secrets.databaseUrl" :type="secretsRevealed ? 'text' : 'password'" required placeholder="postgresql://…" /></label
          ><label v-if="form.applications.includes('api')"
            ><span>后台 JWT Access 密钥</span
            ><input v-model="form.secrets.jwtAccessSecret" :type="secretsRevealed ? 'text' : 'password'" required placeholder="留空保留原密钥" /></label
          ><label v-if="form.applications.includes('api')"
            ><span>后台 JWT Refresh 密钥</span
            ><input v-model="form.secrets.jwtRefreshSecret" :type="secretsRevealed ? 'text' : 'password'" required placeholder="留空保留原密钥" /></label
          ><label v-if="form.applications.includes('api')"
            ><span>配置加密密钥</span
            ><input v-model="form.secrets.configEncryptionKey" :type="secretsRevealed ? 'text' : 'password'" required placeholder="留空保留原密钥" /></label
          ><label v-if="form.applications.includes('web')"
            ><span>用户端 JWT Access 密钥</span
            ><input v-model="form.secrets.customerJwtAccessSecret" :type="secretsRevealed ? 'text' : 'password'" required placeholder="留空保留原密钥" /></label
          ><label v-if="form.applications.includes('web')"
            ><span>用户端 JWT Refresh 密钥</span
            ><input v-model="form.secrets.customerJwtRefreshSecret" :type="secretsRevealed ? 'text' : 'password'" required placeholder="留空保留原密钥" /></label>
        </div>
      </fieldset>
      <p class="security-note">
        所有凭据由 API
        加密保存，默认不显示明文；只有拥有部署管理权限的管理员可以主动显示。编辑时凭据留空表示保留原值。
      </p>
      <footer>
        <button type="button" class="secondary-button" @click="router.push('/deployments')">
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
.application-options {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.application-option {
  min-width: 150px;
  padding: 16px;
  border: 1px solid #dfe6f1;
  border-radius: 13px;
  background: #f8fafc;
  color: #334155;
}
.application-option.checked {
  border-color: #5267f5;
  background: #eef1ff;
  color: #3046c8;
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

<script setup lang="ts">
import type {
  DeploymentUnitDefinition,
  DeploymentVariableDefinition,
  UpsertDeploymentProjectRequest,
} from '@template/contracts';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  createDeploymentProject,
  getDeploymentProject,
  updateDeploymentProject,
} from '../api/deployments';
import AppCheckbox from '../components/AppCheckbox.vue';
import AppSelect from '../components/AppSelect.vue';

const route = useRoute();
const router = useRouter();
const id = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''));
const loading = ref(Boolean(id.value));
const saving = ref(false);
const error = ref('');
const form = ref<UpsertDeploymentProjectRequest>({
  name: '',
  code: '',
  description: '',
  type: 'docker-compose',
  composeFile: 'docker-compose.production.yml',
  units: [],
  variables: [],
});
const typeOptions = [{ value: 'docker-compose', label: 'Docker Compose' }];
const resourceOptions = [
  { value: '', label: '普通变量，不绑定资源' },
  { value: 'sql', label: 'SQL 数据库' },
  { value: 'redis', label: 'Redis' },
  { value: 'object_storage', label: '对象存储' },
  { value: 'custom', label: '自定义服务资源' },
];

function addUnit(): void {
  form.value.units.push({
    key: '',
    name: '',
    service: '',
    migrationCommand: null,
    healthCheckUrl: null,
  });
}
function removeUnit(index: number): void {
  form.value.units.splice(index, 1);
}
function addVariable(): void {
  form.value.variables.push({
    key: '',
    label: '',
    required: false,
    secret: false,
    resourceKind: null,
  });
}
function removeVariable(index: number): void {
  form.value.variables.splice(index, 1);
}
async function load(): Promise<void> {
  if (!id.value) return;
  try {
    const project = await getDeploymentProject(id.value);
    form.value = {
      name: project.name,
      code: project.code,
      description: project.description ?? '',
      type: project.type,
      composeFile: project.composeFile,
      units: structuredClone(project.units),
      variables: structuredClone(project.variables),
    };
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '部署项目加载失败';
  } finally {
    loading.value = false;
  }
}
async function save(): Promise<void> {
  error.value = '';
  if (!form.value.units.length) {
    error.value = '请至少添加一个部署单元。';
    return;
  }
  saving.value = true;
  try {
    if (id.value) await updateDeploymentProject(id.value, form.value);
    else await createDeploymentProject(form.value);
    await router.push('/deployments/projects');
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '部署项目保存失败';
  } finally {
    saving.value = false;
  }
}
onMounted(load);
</script>

<template>
  <div>
    <section class="page-heading">
      <div>
        <p class="eyebrow">部署中心 / 项目定义</p>
        <h1>{{ id ? '编辑部署项目' : '新增部署项目' }}</h1>
        <p>这里保存构建规则，不填写 Git、数据库、服务器或其他密钥。</p>
      </div>
      <button class="secondary-button" type="button" @click="router.push('/deployments/projects')">
        返回列表
      </button>
    </section>
    <div v-if="loading" class="panel table-state"><span class="loading-ring" />正在加载…</div>
    <form v-else class="panel deployment-project-form" @submit.prevent="save">
      <p v-if="error" class="operation-notice" role="alert">{{ error }}</p>
      <fieldset>
        <legend>基本信息</legend>
        <div class="project-form-grid">
          <label
            ><span>项目名称</span><input v-model.trim="form.name" required maxlength="80"
          /></label>
          <label
            ><span>项目代码</span
            ><input
              v-model.trim="form.code"
              required
              pattern="[a-z][a-z0-9_-]{0,63}"
              placeholder="例如：mall-platform"
          /></label>
          <label
            ><span>部署方式 <b class="required-mark">*</b></span
            ><AppSelect v-model="form.type" :options="typeOptions" aria-label="部署方式"
          /></label>
          <label
            ><span>Compose 文件</span
            ><input
              v-model.trim="form.composeFile"
              required
              placeholder="docker-compose.production.yml"
          /></label>
          <label class="wide"
            ><span>项目说明</span
            ><textarea v-model.trim="form.description" rows="3" maxlength="300" />
          </label>
        </div>
      </fieldset>
      <fieldset>
        <div class="fieldset-heading">
          <div><strong>部署单元</strong><small>对应 Compose 中可独立构建和启动的服务。</small></div>
          <button class="secondary-button" type="button" @click="addUnit">添加单元</button>
        </div>
        <div class="definition-list">
          <article v-for="(unit, index) in form.units" :key="index" class="definition-card">
            <div class="project-form-grid">
              <label
                ><span>单元代码</span
                ><input v-model.trim="unit.key" required pattern="[a-z][a-z0-9_-]{0,63}"
              /></label>
              <label><span>显示名称</span><input v-model.trim="unit.name" required /></label>
              <label
                ><span>Compose 服务名</span><input v-model.trim="unit.service" required
              /></label>
              <label
                ><span>健康检查地址</span
                ><input v-model.trim="unit.healthCheckUrl" placeholder="可选，支持完整 URL"
              /></label>
              <label class="wide"
                ><span>启动前迁移命令</span
                ><input v-model.trim="unit.migrationCommand" placeholder="可选；在该服务容器中执行"
              /></label>
            </div>
            <button class="danger-link" type="button" @click="removeUnit(index)">移除此单元</button>
          </article>
        </div>
      </fieldset>
      <fieldset>
        <div class="fieldset-heading">
          <div>
            <strong>环境变量要求</strong><small>部署环境据此绑定服务资源或填写普通变量。</small>
          </div>
          <button class="secondary-button" type="button" @click="addVariable">添加变量</button>
        </div>
        <div class="definition-list">
          <article
            v-for="(variable, index) in form.variables"
            :key="index"
            class="definition-card variable-card"
          >
            <div class="project-form-grid">
              <label
                ><span>变量名</span
                ><input
                  v-model.trim="variable.key"
                  required
                  pattern="[A-Z][A-Z0-9_]{0,127}"
                  placeholder="DATABASE_URL"
              /></label>
              <label><span>中文名称</span><input v-model.trim="variable.label" required /></label>
              <label class="wide"
                ><span>资源类型</span
                ><AppSelect
                  :model-value="variable.resourceKind ?? ''"
                  :options="resourceOptions"
                  aria-label="资源类型"
                  @update:model-value="
                    variable.resourceKind = ($event ||
                      null) as DeploymentVariableDefinition['resourceKind']
                  "
              /></label>
            </div>
            <div class="variable-flags">
              <AppCheckbox
                :model-value="variable.required"
                label="必填变量"
                @update:model-value="variable.required = $event"
              />
              <AppCheckbox
                :model-value="variable.secret"
                label="敏感变量，加密保存"
                @update:model-value="variable.secret = $event"
              />
              <button class="danger-link" type="button" @click="removeVariable(index)">
                移除此变量
              </button>
            </div>
          </article>
        </div>
      </fieldset>
      <p class="security-note">
        Git、服务器与服务密钥在部署环境中绑定；部署项目只保存可审查的构建定义。
      </p>
      <footer>
        <button
          class="secondary-button"
          type="button"
          @click="router.push('/deployments/projects')"
        >
          取消
        </button>
        <button class="primary-button" :disabled="saving">
          {{ saving ? '保存中…' : '保存项目' }}
        </button>
      </footer>
    </form>
  </div>
</template>

<style scoped>
.deployment-project-form {
  display: grid;
  gap: 24px;
  padding: 28px;
}
.deployment-project-form fieldset {
  display: grid;
  gap: 18px;
  padding: 22px;
  border: 1px solid #dfe6f1;
  border-radius: 16px;
}
.deployment-project-form legend {
  padding: 0 8px;
  font-weight: 700;
}
.project-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}
.project-form-grid label {
  display: grid;
  gap: 8px;
}
.project-form-grid input,
.project-form-grid textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #d7dfec;
  border-radius: 11px;
  font: inherit;
}
.wide {
  grid-column: 1 / -1;
}
.fieldset-heading,
.deployment-project-form footer,
.variable-flags {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}
.fieldset-heading > div {
  display: grid;
  gap: 5px;
}
.fieldset-heading small {
  color: var(--muted);
}
.definition-list {
  display: grid;
  gap: 14px;
}
.definition-card {
  display: grid;
  gap: 16px;
  padding: 18px;
  border: 1px solid #e3e8f2;
  border-radius: 14px;
  background: #fafbfe;
}
.danger-link {
  justify-self: end;
  border: 0;
  background: transparent;
  color: #c33f4a;
  cursor: pointer;
}
.variable-flags {
  justify-content: flex-start;
  flex-wrap: wrap;
}
.variable-flags .danger-link {
  margin-left: auto;
}
@media (max-width: 760px) {
  .project-form-grid {
    grid-template-columns: 1fr;
  }
  .wide {
    grid-column: auto;
  }
}
</style>

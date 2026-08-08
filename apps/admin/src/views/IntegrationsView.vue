<script setup lang="ts">
import type { IntegrationConfigSummary } from '@template/contracts';
import { onMounted, ref } from 'vue';
import { getIntegrations, testIntegrationDelivery, updateIntegration } from '../api/integrations';
import AppSelect from '../components/AppSelect.vue';

const items = ref<IntegrationConfigSummary[]>([]);
const loading = ref(false),
  saving = ref(false),
  error = ref(''),
  notice = ref('');
const editing = ref<IntegrationConfigSummary>();
const values = ref<Record<string, string>>({}),
  secrets = ref<Record<string, string>>({}),
  enabled = ref(false);
const testTarget = ref('');
const testing = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    items.value = await getIntegrations();
  } catch {
    error.value = '服务配置加载失败，请检查权限与 API。';
  } finally {
    loading.value = false;
  }
}
async function testDelivery(): Promise<void> {
  if (!editing.value || (editing.value.kind !== 'sms' && editing.value.kind !== 'email')) return;
  testing.value = true;
  notice.value = '';
  try {
    const result = await testIntegrationDelivery(editing.value.kind, testTarget.value);
    notice.value = result.developmentCode
      ? `开发模式发送成功，验证码：${result.developmentCode}`
      : '测试消息已发送，请检查接收端。';
  } catch {
    notice.value = '发送测试失败，请先保存并启用完整配置，再检查服务商状态。';
  } finally {
    testing.value = false;
  }
}
function open(item: IntegrationConfigSummary): void {
  editing.value = item;
  values.value = { ...item.values };
  for (const field of item.fields) {
    const firstOption = field.options?.[0];
    if (firstOption && !values.value[field.key]) values.value[field.key] = firstOption.value;
  }
  secrets.value = {};
  enabled.value = item.enabled;
}
async function save(): Promise<void> {
  if (!editing.value) return;
  saving.value = true;
  notice.value = '';
  try {
    await updateIntegration(editing.value.kind, {
      enabled: enabled.value,
      values: values.value,
      secrets: secrets.value,
    });
    editing.value = undefined;
    notice.value = '服务配置已安全保存，密钥不会明文回显。';
    await load();
  } catch {
    notice.value = '保存失败，请检查必填字段、平台类型和加密配置。';
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
        <p class="eyebrow">系统管理 / 服务配置</p>
        <h1>服务配置</h1>
        <p>集中管理通用基础设施；密钥只允许覆盖，不允许读取明文。</p>
      </div>
      <button class="secondary-button" :disabled="loading" @click="load">刷新</button>
    </section>
    <p v-if="notice" class="operation-notice" role="status">{{ notice }}</p>
    <div v-if="loading" class="panel table-state"><span class="loading-ring" />正在加载…</div>
    <div v-else-if="error" class="panel table-state error-state">{{ error }}</div>
    <section v-else class="integration-grid">
      <article v-for="item in items" :key="item.kind" class="panel integration-card">
        <header>
          <span class="integration-icon">{{ item.name.slice(0, 1) }}</span
          ><span class="status-pill" :class="{ neutral: !item.enabled }"
            ><i />{{ item.enabled ? '已启用' : '未启用' }}</span
          >
        </header>
        <h2>{{ item.name }}</h2>
        <p>{{ item.description }}</p>
        <small>{{
          item.configured ? `已配置 · ${item.configuredSecrets.length} 个密钥字段` : '尚未配置'
        }}</small
        ><button class="secondary-button" @click="open(item)">
          {{ item.configured ? '编辑配置' : '开始配置' }}
        </button>
      </article>
    </section>
    <div v-if="editing" class="dialog-backdrop">
      <form class="user-dialog integration-dialog" @submit.prevent="save">
        <header>
          <div>
            <p class="eyebrow">服务配置</p>
            <h2>{{ editing.name }}</h2>
          </div>
          <button type="button" class="dialog-close" aria-label="关闭" @click="editing = undefined">
            ×
          </button>
        </header>
        <label class="enable-row"
          ><input v-model="enabled" type="checkbox" /><span>启用此服务</span></label
        >
        <template v-for="field in editing.fields" :key="field.key">
          <label
            ><span
              >{{ field.label }}
              <em v-if="field.secret && editing.configuredSecrets.includes(field.key)"
                >已配置</em
              ></span
            >
            <input
              v-if="field.secret"
              v-model="secrets[field.key]"
              type="password"
              :required="field.required && !editing.configuredSecrets.includes(field.key)"
              placeholder="留空表示保留原密钥"
              autocomplete="new-password"
            />
            <AppSelect
              v-else-if="field.options"
              :model-value="values[field.key] ?? ''"
              :options="field.options"
              :aria-label="field.label"
              @update:model-value="values[field.key] = $event"
            />
            <input v-else v-model.trim="values[field.key]" :required="field.required" />
          </label>
        </template>
        <p class="permission-help">
          密钥经过 AES-256-GCM 加密存储。对象存储不提供本地文件兜底；头像上传当前支持腾讯云 COS。
        </p>
        <div v-if="editing.kind === 'sms' || editing.kind === 'email'" class="integration-test">
          <label
            ><span>测试接收{{ editing.kind === 'sms' ? '手机号' : '邮箱' }}</span
            ><input
              v-model.trim="testTarget"
              :type="editing.kind === 'email' ? 'email' : 'text'"
              placeholder="保存配置后可发送测试" /></label
          ><button
            type="button"
            class="secondary-button"
            :disabled="testing || !testTarget"
            @click="testDelivery"
          >
            {{ testing ? '发送中…' : '发送测试' }}
          </button>
        </div>
        <footer>
          <button type="button" class="secondary-button" @click="editing = undefined">取消</button
          ><button class="primary-button" :disabled="saving">
            {{ saving ? '保存中…' : '安全保存' }}
          </button>
        </footer>
      </form>
    </div>
  </div>
</template>

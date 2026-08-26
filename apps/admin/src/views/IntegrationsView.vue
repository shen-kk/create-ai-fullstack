<script setup lang="ts">
import type {
  IntegrationConfigSummary,
  ServiceFeatureBindingSummary,
  ServiceResourceSummary,
  CustomerAuthSettings,
  CustomerAuthMode,
  MessageTemplateSummary,
  MessageTemplateChannel,
  VerificationPurpose,
} from '@template/contracts';
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import {
  createServiceResource,
  getIntegrations,
  getServiceResources,
  getServiceResourceSecrets,
  updateServiceResource,
  getServiceFeatureBindings,
  updateServiceFeatureBinding,
  deleteServiceResource,
  getCustomerAuthSettings,
  updateCustomerAuthSettings,
  getMessageTemplates,
  createMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
  testIntegrationDelivery,
} from '../api/integrations';
import AppSelect from '../components/AppSelect.vue';
import AppPasswordInput from '../components/AppPasswordInput.vue';
import AppDialog from '../components/AppDialog.vue';
import AppRichTextEditor from '../components/AppRichTextEditor.vue';
import { project } from '../generated/project';

const route = useRoute();
const activeSection = computed<'resources' | 'bindings' | 'templates'>(() => {
  if (route.path.endsWith('/bindings')) return 'bindings';
  if (route.path.endsWith('/templates')) return 'templates';
  return 'resources';
});
const pageIntroduction = computed(() => {
  if (activeSection.value === 'bindings') {
    return { title: '功能绑定', description: '明确每项系统能力使用哪一条服务资源和消息模板。' };
  }
  if (activeSection.value === 'templates') {
    return {
      title: '消息模板',
      description: '统一维护验证码等邮件与短信内容，支持富文本邮件正文。',
    };
  }
  return {
    title: '服务资源',
    description: '集中管理数据库、缓存、对象存储、消息发送和服务器等资源。',
  };
});

const items = ref<IntegrationConfigSummary[]>([]);
const resources = ref<ServiceResourceSummary[]>([]);
const bindings = ref<ServiceFeatureBindingSummary[]>([]);
const templates = ref<MessageTemplateSummary[]>([]);
const kindFilter = ref('all');
const authSettings = ref<CustomerAuthSettings>({
  mode: 'phone',
  availableChannels: ['sms'],
  verificationTtlSeconds: 300,
  verificationRetrySeconds: 60,
  updatedAt: null,
});
const authMode = ref<CustomerAuthMode>('phone');
const verificationTtlMinutes = ref(5);
const verificationRetrySeconds = ref(60);
const loading = ref(false),
  saving = ref(false),
  error = ref(''),
  notice = ref('');
const editing = ref<IntegrationConfigSummary>();
const editingResource = ref<ServiceResourceSummary>();
const deletingResource = ref<ServiceResourceSummary>();
const editingTemplate = ref<MessageTemplateSummary>();
const creatingTemplate = ref(false);
const templateForm = ref({
  code: '',
  name: '',
  channel: 'email' as MessageTemplateChannel,
  subject: '',
  textBody: '',
  htmlBody: '',
  providerTemplateId: '',
  parameterMapping: '{\n  "code": "{{code}}",\n  "minutes": "{{minutes}}"\n}',
  enabled: true,
});
const testTarget = ref('');
const noticeKind = ref<'success' | 'error'>('success');
const revealingResourceSecrets = ref(false);
const testPurpose = ref<VerificationPurpose>('login');
const testingDelivery = ref(false);
const resourceName = ref('');
const values = ref<Record<string, string>>({}),
  secrets = ref<Record<string, string>>({}),
  enabled = ref(false);

const defaultEmailBody = `<h2>{{projectName}} 验证码</h2><p>您好：</p><p>您正在进行<strong>{{purpose}}</strong>操作，本次验证码为：</p><blockquote><strong>{{code}}</strong></blockquote><p>验证码将在 {{minutes}} 分钟内有效，请勿告知他人。</p><p>如非本人操作，请忽略此邮件。</p>`;

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    [items.value, resources.value, bindings.value, authSettings.value, templates.value] =
      await Promise.all([
        getIntegrations(),
        getServiceResources(),
        getServiceFeatureBindings(),
        getCustomerAuthSettings(),
        getMessageTemplates(),
      ]);
    authMode.value = authSettings.value.mode;
    verificationTtlMinutes.value = authSettings.value.verificationTtlSeconds / 60;
    verificationRetrySeconds.value = authSettings.value.verificationRetrySeconds;
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : '';
    error.value =
      code === 'UNAUTHORIZED' || code.includes('401')
        ? '登录状态已失效，请重新登录后再查看服务配置。'
        : code
          ? `服务配置加载失败（${code}），请检查权限与 API。`
          : '服务配置加载失败，请检查权限与 API。';
  } finally {
    loading.value = false;
  }
}
const authModeOptions = [
  { value: 'phone', label: '手机号注册与登录' },
  { value: 'email', label: '邮箱注册与登录' },
];
const testPurposeOptions = computed(() => [
  { value: 'login', label: '登录验证码' },
  { value: 'reset_password', label: '找回密码验证码' },
  {
    value: 'bind_contact',
    label: authMode.value === 'email' ? '绑定邮箱验证码' : '绑定手机号验证码',
  },
]);
async function saveAuthMode(): Promise<void> {
  saving.value = true;
  try {
    authSettings.value = await updateCustomerAuthSettings({
      mode: authMode.value,
      verificationTtlSeconds: verificationTtlMinutes.value * 60,
      verificationRetrySeconds: verificationRetrySeconds.value,
    });
    noticeKind.value = 'success'; notice.value = '用户端认证与验证码规则已更新。';
  } catch (error) {
    notice.value =
      error instanceof Error && error.message === 'CUSTOMER_AUTH_FEATURE_BINDINGS_INCOMPLETE'
        ? '无法启用：请先完成对应登录和找回密码的短信或邮件功能绑定。'
        : '认证设置保存失败，请刷新后重试。';
    authMode.value = authSettings.value.mode;
    verificationTtlMinutes.value = authSettings.value.verificationTtlSeconds / 60;
    verificationRetrySeconds.value = authSettings.value.verificationRetrySeconds;
  } finally {
    saving.value = false;
  }
}
const authSettingsChanged = computed(
  () =>
    authMode.value !== authSettings.value.mode ||
    verificationTtlMinutes.value * 60 !== authSettings.value.verificationTtlSeconds ||
    verificationRetrySeconds.value !== authSettings.value.verificationRetrySeconds,
);
const kindOptions = computed(() => [
  { value: 'all', label: '全部类型' },
  ...items.value.map((item) => ({ value: item.kind, label: item.name })),
]);
const filteredItems = computed(() =>
  kindFilter.value === 'all'
    ? items.value
    : items.value.filter((item) => item.kind === kindFilter.value),
);
const commonBindings = computed(() =>
  bindings.value.filter((binding) => binding.groupCode === 'common'),
);
const customerAuthBindings = computed(() => {
  const kinds = new Set([authMode.value === 'phone' ? 'sms' : 'email']);
  return bindings.value.filter(
    (binding) => binding.groupCode === 'customer_auth' && kinds.has(binding.requiredKind),
  );
});
function bindingOptions(binding: ServiceFeatureBindingSummary) {
  return [
    { value: '', label: '未绑定（功能不可用）' },
    ...resources.value
      .filter((resource) => resource.kind === binding.requiredKind && resource.enabled)
      .map((resource) => ({ value: resource.id, label: resource.name })),
  ];
}
async function bindFeature(
  binding: ServiceFeatureBindingSummary,
  resourceId: string,
): Promise<void> {
  try {
    const updated = await updateServiceFeatureBinding(
      binding.code,
      resourceId || null,
      binding.templateId,
    );
    bindings.value = bindings.value.map((item) => (item.code === updated.code ? updated : item));
    notice.value = resourceId ? '功能绑定已保存。' : '已解除绑定，该功能将提示服务未配置。';
  } catch {
    noticeKind.value = 'error'; notice.value = '功能绑定失败，请确认资源已启用且类型匹配。';
  }
}
function templateOptions(binding: ServiceFeatureBindingSummary) {
  return [
    { value: '', label: '未绑定模板' },
    ...templates.value
      .filter((item) => item.channel === binding.requiredKind && item.enabled)
      .map((item) => ({ value: item.id, label: item.name })),
  ];
}
async function bindTemplate(
  binding: ServiceFeatureBindingSummary,
  templateId: string,
): Promise<void> {
  if (!binding.resourceId) {
    noticeKind.value = 'error'; notice.value = '请先绑定发送服务资源。';
    return;
  }
  const updated = await updateServiceFeatureBinding(
    binding.code,
    binding.resourceId,
    templateId || null,
  );
  bindings.value = bindings.value.map((item) => (item.code === updated.code ? updated : item));
  notice.value = '消息模板绑定已保存。';
}
function openTemplate(template?: MessageTemplateSummary): void {
  editingTemplate.value = template;
  creatingTemplate.value = !template;
  templateForm.value = template
    ? {
        code: template.code,
        name: template.name,
        channel: template.channel,
        subject: template.subject ?? '',
        textBody: template.textBody ?? '',
        htmlBody: template.htmlBody ?? (template.channel === 'email' ? defaultEmailBody : ''),
        providerTemplateId: template.providerTemplateId ?? '',
        parameterMapping: JSON.stringify(template.parameterMapping, null, 2),
        enabled: template.enabled,
      }
    : {
        code: '',
        name: '',
        channel: 'email',
        subject: '',
        textBody: '您的验证码是 {{code}}，{{minutes}} 分钟内有效，请勿转发。',
        htmlBody: defaultEmailBody,
        providerTemplateId: '',
        parameterMapping: '{\n  "code": "{{code}}",\n  "minutes": "{{minutes}}"\n}',
        enabled: true,
      };
}
async function saveTemplate(): Promise<void> {
  try {
    const form = templateForm.value;
    if (form.channel === 'email' && !form.htmlBody.trim()) {
      noticeKind.value = 'error'; notice.value = '请填写邮件正文。';
      return;
    }
    const input = {
      code: form.code,
      name: form.name,
      channel: form.channel,
      subject: form.subject || null,
      textBody: form.channel === 'email' ? null : form.textBody || null,
      htmlBody: form.htmlBody || null,
      providerTemplateId: form.providerTemplateId || null,
      parameterMapping: JSON.parse(form.parameterMapping) as Record<string, string>,
      enabled: form.enabled,
    };
    if (editingTemplate.value) await updateMessageTemplate(editingTemplate.value.id, input);
    else await createMessageTemplate(input);
    editingTemplate.value = undefined;
    creatingTemplate.value = false;
    notice.value = '消息模板已保存。';
    await load();
  } catch {
    noticeKind.value = 'error'; notice.value = '模板保存失败，请检查模板变量和参数映射 JSON。';
  }
}
async function removeTemplate(template: MessageTemplateSummary): Promise<void> {
  try {
    await deleteMessageTemplate(template.id);
    notice.value = '消息模板已删除。';
    await load();
  } catch {
    noticeKind.value = 'error'; notice.value = '模板正在被功能使用，不能删除。';
  }
}
async function testCurrentDelivery(): Promise<void> {
  const channel = authMode.value === 'email' ? 'email' : 'sms';
  if (!testTarget.value.trim()) return;
  testingDelivery.value = true;
  try {
    await testIntegrationDelivery(channel, testTarget.value.trim(), testPurpose.value);
    notice.value = '测试验证码已发送，请检查接收端。';
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const messages: Record<string, string> = {
      EMAIL_NOT_CONFIGURED: '当前测试场景未绑定可用的邮件服务。',
      SMS_NOT_CONFIGURED: '当前测试场景未绑定可用的短信服务。',
      MESSAGE_TEMPLATE_NOT_CONFIGURED: '当前测试场景未绑定消息模板。',
      EMAIL_DELIVERY_FAILED: '邮件发送失败，请检查邮件服务配置和收件地址。',
      SMS_DELIVERY_FAILED: '短信发送失败，请检查短信服务配置。',
      VERIFICATION_RETRY_LATER: '发送过于频繁，请等待 60 秒后重试。',
    };
    noticeKind.value = 'error'; notice.value = messages[code] ?? '测试发送失败，请检查所选场景的服务和模板绑定。';
  } finally {
    testingDelivery.value = false;
  }
}
function open(item: IntegrationConfigSummary): void {
  editing.value = item;
  editingResource.value = undefined;
  resourceName.value = '';
  values.value = {};
  for (const field of item.fields) {
    const firstOption = field.options?.[0];
    if (firstOption && !values.value[field.key]) values.value[field.key] = firstOption.value;
  }
  secrets.value = {};
  enabled.value = true;
}
function editResource(resource: ServiceResourceSummary): void {
  const definition = items.value.find((item) => item.kind === resource.kind);
  if (!definition) return;
  editing.value = definition;
  editingResource.value = resource;
  resourceName.value = resource.name;
  values.value = { ...resource.values };
  secrets.value = {};
  enabled.value = resource.enabled;
}
function hasConfiguredSecret(key: string): boolean {
  return Boolean(editingResource.value?.configuredSecrets.includes(key));
}
async function revealResourceSecrets(): Promise<void> {
  if (!editingResource.value || revealingResourceSecrets.value) return;
  revealingResourceSecrets.value = true;
  try {
    secrets.value = { ...secrets.value, ...(await getServiceResourceSecrets(editingResource.value.id)) };
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : '';
    noticeKind.value = 'error';
    notice.value = code === 'FORBIDDEN' || code.includes('403')
      ? '当前账号没有“查看敏感配置明文”权限。'
      : code === 'INTEGRATION_SECRETS_REENTRY_REQUIRED'
        ? '历史密钥已无法解密，请重新填写并保存。'
        : '敏感配置读取失败，请检查权限或 API。';
  } finally {
    revealingResourceSecrets.value = false;
  }
}
function visibleFields(item: IntegrationConfigSummary) {
  const provider = values.value.provider || values.value.engine || '';
  return item.fields.filter(
    (field) => !field.providers?.length || field.providers.includes(provider),
  );
}
async function save(): Promise<void> {
  if (!editing.value) return;
  saving.value = true;
  notice.value = '';
  try {
    const input = {
      name: resourceName.value,
      kind: editing.value.kind,
      provider: values.value.provider || values.value.engine || editing.value.kind,
      enabled: enabled.value,
      values: values.value,
      secrets: secrets.value,
    };
    if (editingResource.value) await updateServiceResource(editingResource.value.id, input);
    else await createServiceResource(input);
    editing.value = undefined;
    noticeKind.value = 'success';
    notice.value = '服务资源已安全保存，部署环境现在可以绑定该资源。';
    await load();
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : '';
    const messages: Record<string, string> = {
      INTEGRATION_REQUIRED_FIELD_MISSING: '旧密钥无法使用，请重新填写当前服务所需的密码或访问密钥。',
      INTEGRATION_AUTH_CREDENTIAL_REQUIRED: '请重新填写当前认证方式对应的密码、令牌或 SSH 私钥。',
      SERVICE_DEPLOY_ROOT_INVALID: '部署根目录必须是合法的 Linux 绝对路径。',
      INTEGRATION_OPTION_INVALID: '所选服务平台或配置选项无效，请重新选择。',
    };
    noticeKind.value = 'error';
    notice.value = messages[code] ?? '保存失败，请检查必填字段、平台类型和加密配置。';
  } finally {
    saving.value = false;
  }
}
async function removeResource(): Promise<void> {
  if (!deletingResource.value) return;
  saving.value = true;
  try {
    await deleteServiceResource(deletingResource.value.id);
    notice.value = `已删除“${deletingResource.value.name}”。`;
    deletingResource.value = undefined;
    await load();
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    notice.value =
      code === 'SERVICE_RESOURCE_BOUND_TO_FEATURE'
        ? '该资源已被系统功能绑定，请先解除功能绑定。'
        : code === 'SERVICE_RESOURCE_BOUND_TO_DEPLOYMENT'
          ? '该资源已被部署环境使用，请先修改对应部署环境。'
          : '删除失败，请刷新后重试。';
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
        <h1>{{ pageIntroduction.title }}</h1>
        <p>{{ pageIntroduction.description }}</p>
      </div>
      <button class="secondary-button" :disabled="loading" @click="load">刷新</button>
    </section>
    <p v-if="notice" :key="notice" class="operation-notice" :class="`notice-${noticeKind}`" :role="noticeKind === 'error' ? 'alert' : 'status'">
      <span class="notice-icon" aria-hidden="true">{{ noticeKind === 'error' ? '!' : '✓' }}</span>{{ notice }}
    </p>
    <nav class="integration-subnav" aria-label="服务配置二级导航">
      <RouterLink to="/integrations/resources">
        <strong>服务资源</strong><small>配置外部服务与基础设施</small>
      </RouterLink>
      <RouterLink to="/integrations/bindings">
        <strong>功能绑定</strong><small>将系统功能绑定到资源</small>
      </RouterLink>
      <RouterLink to="/integrations/templates">
        <strong>消息模板</strong><small>管理邮件与短信内容</small>
      </RouterLink>
    </nav>
    <div v-if="loading" class="panel table-state"><span class="loading-ring" />正在加载…</div>
    <div v-else-if="error" class="panel table-state error-state">{{ error }}</div>
    <template v-else>
      <section
        v-if="activeSection === 'bindings' && project.modules.customerAuthentication"
        class="panel integration-binding-panel"
      >
        <header class="integration-section-heading">
          <div>
            <p class="eyebrow">功能绑定</p>
            <h2>用户端认证</h2>
            <p>选择认证方式并为对应流程绑定服务资源；未绑定的功能不可用。</p>
          </div>
        </header>
        <div class="customer-auth-setting">
          <label class="auth-mode-field">
            <span>认证方式 <i>*</i></span>
            <AppSelect v-model="authMode" :options="authModeOptions" aria-label="用户端认证方式" />
            <small>决定验证码登录、自动开户和找回密码使用手机号还是邮箱。</small>
          </label>
          <label class="auth-number-field">
            <span>验证码有效时间 <i>*</i></span>
            <span class="number-input-suffix">
              <input
                v-model.number="verificationTtlMinutes"
                type="number"
                min="1"
                max="30"
                required
              />
              <em>分钟</em>
            </span>
          </label>
          <label class="auth-number-field">
            <span>再次发送间隔 <i>*</i></span>
            <span class="number-input-suffix">
              <input
                v-model.number="verificationRetrySeconds"
                type="number"
                min="30"
                max="300"
                required
              />
              <em>秒</em>
            </span>
          </label>
          <button
            type="button"
            class="primary-button"
            :disabled="saving || !authSettingsChanged"
            @click="saveAuthMode"
          >
            保存设置
          </button>
        </div>
        <div class="feature-binding-grid">
          <article
            v-for="binding in customerAuthBindings"
            :key="binding.code"
            class="feature-binding-row"
          >
            <div class="feature-binding-copy">
              <strong>{{ binding.name }}</strong>
              <small>{{ binding.description }}</small>
            </div>
            <div class="feature-binding-controls">
              <label>
                <span>发送服务</span>
                <AppSelect
                  :model-value="binding.resourceId ?? ''"
                  :options="bindingOptions(binding)"
                  :aria-label="`${binding.name}发送服务`"
                  @update:model-value="bindFeature(binding, $event)"
                />
              </label>
              <label v-if="binding.requiredKind === 'email' || binding.requiredKind === 'sms'">
                <span>消息模板</span>
                <AppSelect
                  :model-value="binding.templateId ?? ''"
                  :options="templateOptions(binding)"
                  :aria-label="`${binding.name}消息模板`"
                  @update:model-value="bindTemplate(binding, $event)"
                />
              </label>
            </div>
          </article>
        </div>
      </section>
      <section v-if="activeSection === 'templates'" class="panel integration-binding-panel">
        <header class="integration-section-heading">
          <div>
            <p class="eyebrow">消息内容</p>
            <h2>消息模板</h2>
            <p>邮件可直接编辑正文；只有短信或邮件 API 服务才需要服务商模板参数。</p>
          </div>
          <button class="primary-button" type="button" @click="openTemplate()">新增模板</button>
        </header>
        <div class="message-template-list">
          <article v-for="template in templates" :key="template.id" class="message-template-row">
            <div class="message-template-main">
              <span class="message-channel-badge">{{
                template.channel === 'email' ? '邮件' : '短信'
              }}</span>
              <span
                ><strong>{{ template.name }}</strong
                ><small>{{ template.code }}</small></span
              >
            </div>
            <span class="status-pill" :class="{ neutral: !template.enabled }"
              ><i />{{ template.enabled ? '已启用' : '已停用' }}</span
            >
            <div class="message-template-actions">
              <button
                type="button"
                class="secondary-button compact-button"
                @click="openTemplate(template)"
              >
                编辑
              </button>
              <button type="button" class="danger-text-button" @click="removeTemplate(template)">
                删除
              </button>
            </div>
          </article>
        </div>
        <div
          v-if="project.modules.customerAuthentication"
          class="customer-auth-setting test-delivery-setting"
        >
          <span
            ><strong>测试当前认证绑定</strong
            ><small>选择场景后，使用该场景实际绑定的服务资源和消息模板发送。</small></span
          >
          <AppSelect v-model="testPurpose" :options="testPurposeOptions" aria-label="测试场景" />
          <input
            v-model.trim="testTarget"
            class="test-target-input"
            :placeholder="authMode === 'email' ? '测试接收邮箱' : '测试手机号'"
          />
          <button
            type="button"
            class="secondary-button"
            :disabled="testingDelivery || !testTarget"
            @click="testCurrentDelivery"
          >
            {{ testingDelivery ? '发送中…' : '发送测试' }}
          </button>
        </div>
      </section>
      <section v-if="activeSection === 'bindings'" class="panel integration-binding-panel">
        <header class="integration-section-heading">
          <div>
            <p class="eyebrow">功能绑定</p>
            <h2>公共功能</h2>
            <p>配置后台和用户端共同依赖、且不随认证方式变化的基础能力。</p>
          </div>
        </header>
        <div class="feature-binding-grid">
          <article
            v-for="binding in commonBindings"
            :key="binding.code"
            class="feature-binding-row"
          >
            <div class="feature-binding-copy">
              <strong>{{ binding.name }}</strong
              ><small>{{ binding.description }}</small>
            </div>
            <div class="feature-binding-controls feature-binding-controls--single">
              <label
                ><span>使用资源</span
                ><AppSelect
                  :model-value="binding.resourceId ?? ''"
                  :options="bindingOptions(binding)"
                  :aria-label="`${binding.name}使用资源`"
                  @update:model-value="bindFeature(binding, $event)"
              /></label>
            </div>
          </article>
        </div>
      </section>
      <section
        v-if="activeSection === 'resources'"
        class="integration-toolbar"
        aria-label="服务资源筛选"
      >
        <label
          ><span>资源类型</span
          ><AppSelect v-model="kindFilter" :options="kindOptions" aria-label="按资源类型筛选"
        /></label>
      </section>
      <section v-if="activeSection === 'resources'" class="integration-grid">
        <article v-for="item in filteredItems" :key="item.kind" class="panel integration-card">
          <header>
            <span class="integration-icon">{{ item.name.slice(0, 1) }}</span
            ><span class="status-pill" :class="{ neutral: !item.enabled }"
              ><i />{{ item.enabled ? '已启用' : '未启用' }}</span
            >
          </header>
          <h2>{{ item.name }}</h2>
          <p>{{ item.description }}</p>
          <small
            >已创建
            {{ resources.filter((resource) => resource.kind === item.kind).length }}
            个资源实例</small
          >
          <div class="resource-list">
            <div
              v-for="resource in resources.filter((entry) => entry.kind === item.kind)"
              :key="resource.id"
              class="resource-row"
            >
              <button type="button" class="resource-edit" @click="editResource(resource)">
                <span>{{ resource.name }}</span
                ><em>{{ resource.enabled ? '已启用' : '已停用' }}</em>
              </button>
              <button
                type="button"
                class="resource-delete"
                :aria-label="`删除${resource.name}`"
                @click="deletingResource = resource"
              >
                删除
              </button>
            </div>
          </div>
          <button class="secondary-button" @click="open(item)">新增{{ item.name }}</button>
        </article>
      </section>
    </template>
    <div v-if="editing" class="dialog-backdrop">
      <form class="user-dialog integration-dialog" @submit.prevent="save">
        <header>
          <div>
            <p class="eyebrow">服务配置</p>
            <h2>{{ editingResource ? '编辑' : '新增' }}{{ editing.name }}</h2>
          </div>
          <button type="button" class="dialog-close" aria-label="关闭" @click="editing = undefined">
            ×
          </button>
        </header>
        <div class="dialog-scroll-content">
          <label
            ><span>配置名称</span
            ><input v-model.trim="resourceName" required placeholder="例如：测试环境"
          /></label>
          <label class="enable-row"
            ><input v-model="enabled" type="checkbox" /><span>启用此服务</span></label
          >
          <template v-for="field in visibleFields(editing)" :key="field.key">
            <label
              ><span
                >{{ field.label }}
                <em v-if="field.secret && hasConfiguredSecret(field.key)">已配置</em></span
              >
              <AppPasswordInput
                v-if="field.secret"
                :model-value="secrets[field.key] ?? ''"
                @update:model-value="secrets[field.key] = $event"
                @reveal="revealResourceSecrets"
                :revealable="Boolean(editingResource && hasConfiguredSecret(field.key))"
                :revealing="revealingResourceSecrets"
                :required="field.required && !hasConfiguredSecret(field.key)"
                :placeholder="hasConfiguredSecret(field.key) ? '••••••••（已加密保存）' : '请输入密钥'"
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
        </div>
        <footer>
          <button type="button" class="secondary-button" @click="editing = undefined">取消</button
          ><button class="primary-button" :disabled="saving">
            {{ saving ? '保存中…' : '安全保存' }}
          </button>
        </footer>
      </form>
    </div>
    <div v-if="editingTemplate || creatingTemplate" class="dialog-backdrop">
      <form
        class="user-dialog integration-dialog template-editor-dialog"
        @submit.prevent="saveTemplate"
      >
        <header>
          <div>
            <p class="eyebrow">消息模板</p>
            <h2>{{ editingTemplate ? '编辑模板' : '新增模板' }}</h2>
          </div>
          <button
            type="button"
            class="dialog-close"
            aria-label="关闭"
            @click="
              editingTemplate = undefined;
              creatingTemplate = false;
            "
          >
            ×
          </button>
        </header>
        <div class="dialog-scroll-content template-dialog-content">
          <section class="template-editor-section">
            <div class="template-section-heading">
              <h3>基础信息</h3>
              <p>用于在功能绑定中识别和选择这条模板。</p>
            </div>
            <div class="template-form-grid">
              <label
                ><span>模板代码</span
                ><input
                  v-model.trim="templateForm.code"
                  :readonly="Boolean(editingTemplate)"
                  required
                  pattern="[a-z][a-z0-9_]*"
                /><small>系统调用使用，创建后不可修改，例如 email_password_reset。</small></label
              >
              <label
                ><span>模板名称</span><input v-model.trim="templateForm.name" required /><small
                  >显示给管理员看的中文名称。</small
                ></label
              >
              <label
                ><span class="required-field-label">发送渠道</span
                ><AppSelect
                  v-model="templateForm.channel"
                  :options="[
                    { value: 'email', label: '邮件' },
                    { value: 'sms', label: '短信' },
                  ]"
                  aria-label="发送渠道"
                /><small>决定该模板可以绑定到邮件还是短信功能。</small></label
              >
              <label v-if="templateForm.channel === 'email'"
                ><span>邮件标题</span><input v-model="templateForm.subject" required /><small
                  >支持下方列出的模板变量。</small
                ></label
              >
            </div>
          </section>
          <section v-if="templateForm.channel === 'email'" class="template-editor-section">
            <div class="template-section-heading">
              <h3>邮件内容</h3>
              <p>编辑用户最终收到的邮件内容，可直接设置标题、列表和重点文字。</p>
            </div>
            <label class="rich-text-field"
              ><span class="required-field-label">邮件正文</span
              ><AppRichTextEditor
                v-model="templateForm.htmlBody"
                aria-label="邮件富文本正文"
                placeholder="输入邮件正文，可使用下方模板变量"
              /><small>填写后优先发送该内容；不要粘贴脚本或不可信 HTML。</small></label
            >
          </section>
          <details
            class="template-advanced-settings"
            :open="templateForm.channel === 'sms' || Boolean(templateForm.providerTemplateId)"
          >
            <summary>
              <span
                ><strong>服务商高级配置</strong
                ><small>{{
                  templateForm.channel === 'email'
                    ? '仅使用 SES API 等模板型邮件服务时填写；SMTP 可留空'
                    : '短信平台发送所需配置'
                }}</small></span
              ><span class="details-toggle">展开设置</span>
            </summary>
            <div class="template-advanced-content">
              <label
                ><span>服务商模板 ID</span
                ><input
                  v-model.trim="templateForm.providerTemplateId"
                  :required="templateForm.channel === 'sms'"
                  :placeholder="
                    templateForm.channel === 'sms'
                      ? '填写短信平台审核通过的模板 ID'
                      : '仅 SES API 等模板型邮件服务需要'
                  "
                /><small>SMTP 直接发送上方正文，不需要填写此项。</small></label
              >
              <label
                ><span>参数映射（JSON）</span
                ><textarea
                  v-model="templateForm.parameterMapping"
                  class="code-textarea"
                  rows="5"
                  required
                /><small>把本系统变量映射到服务商模板参数；普通 SMTP 保留默认值即可。</small></label
              >
            </div>
          </details>
          <div v-pre class="template-variable-help">
            <strong>可用变量</strong>
            <span
              ><em>验证码</em><code>{{ code }}</code></span
            >
            <span
              ><em>有效分钟数</em><code>{{ minutes }}</code></span
            >
            <span
              ><em>项目名称</em><code>{{ projectName }}</code></span
            >
            <span
              ><em>发送用途</em><code>{{ purpose }}</code></span
            >
          </div>
        </div>
        <footer>
          <button
            type="button"
            class="secondary-button"
            @click="
              editingTemplate = undefined;
              creatingTemplate = false;
            "
          >
            取消</button
          ><button class="primary-button">保存模板</button>
        </footer>
      </form>
    </div>
    <AppDialog
      v-if="deletingResource"
      :open="true"
      size="sm"
      eyebrow="服务配置"
      title="删除服务资源"
      @close="deletingResource = undefined"
    >
      <div class="delete-resource-message">
        <p>确定删除“{{ deletingResource.name }}”吗？</p>
        <small>删除后无法恢复；如果资源仍被功能或部署环境使用，系统会阻止删除。</small>
      </div>
      <template #footer>
        <button
          type="button"
          class="secondary-button"
          :disabled="saving"
          @click="deletingResource = undefined"
        >
          取消
        </button>
        <button type="button" class="danger-button" :disabled="saving" @click="removeResource">
          {{ saving ? '删除中…' : '确认删除' }}
        </button>
      </template>
    </AppDialog>
  </div>
</template>

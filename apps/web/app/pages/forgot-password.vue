<script setup lang="ts">
import { PASSWORD_MIN_LENGTH } from '@template/contracts';
import { project } from '../generated/project';
const { resetPassword } = useCustomerSession();
const { defaultChannel } = await useCustomerAuthSettings();
const channel = ref(defaultChannel.value);
const form = reactive({ identifier: '', code: '', newPassword: '', confirmPassword: '' });
const loading = ref(false);
const { showSuccess, showError } = useAppToast();
const {
  sending,
  remaining,
  label: codeLabel,
  send: sendCode,
} = useVerificationCode('reset-password', () => ({
  channel: channel.value,
  target: form.identifier,
  purpose: 'reset_password',
}));

async function submit(): Promise<void> {
  if (loading.value) return;
  if (form.newPassword !== form.confirmPassword) {
    showError('两次密码不一致');
    return;
  }
  loading.value = true;
  try {
    await resetPassword({
      channel: channel.value,
      identifier: form.identifier,
      code: form.code,
      newPassword: form.newPassword,
    });
    showSuccess('密码已重置，请重新登录');
    await navigateTo('/login');
  } catch (error) {
    showError(error instanceof Error ? error.message : '重置失败');
  } finally {
    loading.value = false;
  }
}
useSeoMeta({ title: `找回密码 · ${project.displayName}`, robots: 'noindex,nofollow' });
</script>
<template>
  <main class="auth-page">
    <section class="auth-intro">
      <p class="eyebrow"><span /> SECURITY</p>
      <h1>重新获得，<br />账号访问权。</h1>
      <p>通过已启用的账号方式验证身份并设置新密码。</p>
    </section>
    <section class="auth-card auth-card-wide">
      <div>
        <p class="auth-kicker">账号安全</p>
        <h2>找回密码</h2>
        <p class="muted"><NuxtLink to="/login">返回登录</NuxtLink></p>
      </div>
      <form class="form-grid" @submit.prevent="submit">
        <FormField class="full" :label="channel === 'sms' ? '手机号' : '邮箱'">
          <Input
            v-model="form.identifier"
            trim
            required
            :inputmode="channel === 'sms' ? 'numeric' : 'email'"
            :type="channel === 'email' ? 'email' : 'text'"
            :maxlength="channel === 'sms' ? 11 : 120"
            :placeholder="channel === 'sms' ? '请输入手机号' : '请输入邮箱地址'"
          />
        </FormField>
        <FormField class="full" :label="channel === 'sms' ? '短信验证码' : '邮件验证码'">
          <div class="code-input">
            <Input
              v-model="form.code"
              trim
              required
              maxlength="6"
              inputmode="numeric"
              placeholder="请输入6位验证码"
            /><button
              type="button"
              class="button button-light"
              :disabled="sending || remaining > 0"
              @click="sendCode"
            >
              {{ codeLabel }}
            </button>
          </div>
        </FormField>
        <FormField label="新密码">
          <Input
            v-model="form.newPassword"
            :placeholder="`请设置至少${PASSWORD_MIN_LENGTH}位的新密码`"
            required
            type="password"
            :minlength="PASSWORD_MIN_LENGTH"
          />
        </FormField>
        <FormField label="确认密码">
          <Input
            v-model="form.confirmPassword"
            placeholder="请再次输入新密码"
            required
            type="password"
            :minlength="PASSWORD_MIN_LENGTH"
          />
        </FormField>
        <button class="button button-block full" :disabled="loading">
          {{ loading ? '处理中…' : '重置密码' }}
        </button>
      </form>
    </section>
  </main>
</template>

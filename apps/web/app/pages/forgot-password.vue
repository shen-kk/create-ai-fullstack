<script setup lang="ts">
const { resetPassword, sendVerification } = useCustomerSession();
const { defaultChannel } = await useCustomerAuthSettings();
const channel = ref(defaultChannel.value);
const form = reactive({ identifier: '', code: '', newPassword: '', confirmPassword: '' });
const loading = ref(false);
const sending = ref(false);
const { showSuccess, showError } = useAppToast();
const {
  remaining,
  restore: restoreCountdown,
  start: startCountdown,
} = useVerificationCountdown('reset-password');
watch(
  [channel, () => form.identifier],
  ([nextChannel, identifier]) => {
    restoreCountdown(`${nextChannel}:${identifier}`);
  },
  { immediate: true },
);
async function sendCode(): Promise<void> {
  sending.value = true;
  try {
    const result = await sendVerification({
      channel: channel.value,
      target: form.identifier,
      purpose: 'reset_password',
    });
    startCountdown(result.retryAfter, `${channel.value}:${form.identifier}`);
    showSuccess(`验证码已发送，${Math.ceil(result.expiresIn / 60)} 分钟内有效`);
  } catch (error) {
    showError(error instanceof Error ? error.message : '发送失败');
  } finally {
    sending.value = false;
  }
}
async function submit(): Promise<void> {
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
    showSuccess('密码已重置，即将返回登录');
    setTimeout(() => navigateTo('/login'), 900);
  } catch (error) {
    showError(error instanceof Error ? error.message : '重置失败');
  } finally {
    loading.value = false;
  }
}
useSeoMeta({ title: '找回密码 · 澄序', robots: 'noindex,nofollow' });
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
      </div>
      <form class="form-grid" @submit.prevent="submit">
        <label class="full"
          >{{ channel === 'sms' ? '手机号' : '邮箱'
          }}<input
            v-model.trim="form.identifier"
            required
            :inputmode="channel === 'sms' ? 'numeric' : 'email'"
            :type="channel === 'email' ? 'email' : 'text'"
            :maxlength="channel === 'sms' ? 11 : 120" /></label
        ><label class="full"
          >{{ channel === 'sms' ? '短信验证码' : '邮件验证码' }}
          <div class="code-input">
            <input v-model.trim="form.code" required maxlength="6" inputmode="numeric" /><button
              type="button"
              class="button button-light"
              :disabled="sending || remaining > 0"
              @click="sendCode"
            >
              {{ sending ? '发送中…' : remaining > 0 ? `${remaining} 秒后重试` : '获取验证码' }}
            </button>
          </div></label
        ><label
          >新密码<input v-model="form.newPassword" required type="password" minlength="8" /></label
        ><label
          >确认密码<input v-model="form.confirmPassword" required type="password" minlength="8"
        /></label>
        <button class="button button-block full" :disabled="loading">
          {{ loading ? '处理中…' : '重置密码' }}
        </button>
      </form>
    </section>
  </main>
</template>

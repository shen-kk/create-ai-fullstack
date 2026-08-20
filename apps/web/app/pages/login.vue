<script setup lang="ts">
const { login, loginWithCode, sendVerification } = useCustomerSession();
const { defaultChannel } = await useCustomerAuthSettings();
const channel = ref(defaultChannel.value);
const form = reactive({ identifier: '', password: '', code: '' });
const mode = ref<'password' | 'code'>('password');
const sending = ref(false);
const loading = ref(false);
const { showSuccess, showError } = useAppToast();
const {
  remaining,
  restore: restoreCountdown,
  start: startCountdown,
} = useVerificationCountdown('login');
watch(
  [channel, () => form.identifier],
  ([nextChannel, identifier]) => {
    restoreCountdown(`${nextChannel}:${identifier}`);
  },
  { immediate: true },
);
async function submit(): Promise<void> {
  loading.value = true;
  try {
    if (mode.value === 'password')
      await login({ channel: channel.value, identifier: form.identifier, password: form.password });
    else
      await loginWithCode({ channel: channel.value, identifier: form.identifier, code: form.code });
    await navigateTo('/profile');
  } catch (error) {
    showError(error instanceof Error ? error.message : '登录失败');
  } finally {
    loading.value = false;
  }
}
async function sendCode(): Promise<void> {
  sending.value = true;
  try {
    const result = await sendVerification({
      channel: channel.value,
      target: form.identifier,
      purpose: 'login',
    });
    startCountdown(result.retryAfter, `${channel.value}:${form.identifier}`);
    showSuccess(`验证码已发送，${Math.ceil(result.expiresIn / 60)} 分钟内有效`);
  } catch (error) {
    showError(error instanceof Error ? error.message : '发送失败');
  } finally {
    sending.value = false;
  }
}
useSeoMeta({ title: '登录 · 澄序', description: '登录你的账号。' });
</script>
<template>
  <main class="auth-page">
    <section class="auth-intro">
      <p class="eyebrow"><span /> WELCOME BACK</p>
      <h1>很高兴，<br />再次见到你。</h1>
      <p>登录后继续管理你的个人资料与账号安全。</p>
    </section>
    <section class="auth-card">
      <div>
        <p class="auth-kicker">账号登录</p>
        <h2>欢迎回来</h2>
        <p class="muted">首次使用验证码登录时，系统会自动创建账号。</p>
        <p class="muted"><NuxtLink to="/forgot-password">忘记密码</NuxtLink></p>
      </div>
      <form @submit.prevent="submit">
        <div class="auth-tabs">
          <button type="button" :class="{ active: mode === 'password' }" @click="mode = 'password'">
            密码登录</button
          ><button type="button" :class="{ active: mode === 'code' }" @click="mode = 'code'">
            验证码登录
          </button>
        </div>
        <label
          >{{ channel === 'sms' ? '手机号' : '邮箱'
          }}<input
            v-model.trim="form.identifier"
            required
            :inputmode="channel === 'sms' ? 'numeric' : 'email'"
            :type="channel === 'email' ? 'email' : 'text'"
            :autocomplete="channel === 'sms' ? 'tel' : 'email'"
            :maxlength="channel === 'sms' ? 11 : 120"
            :placeholder="channel === 'sms' ? '请输入 11 位手机号' : '请输入邮箱地址'" /></label
        ><label v-if="mode === 'password'"
          >密码<input
            v-model="form.password"
            required
            type="password"
            autocomplete="current-password"
            minlength="8"
            placeholder="请输入密码" /></label
        ><label v-else
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
        >
        <button class="button button-block" :disabled="loading">
          {{ loading ? '正在登录…' : '登录' }} <span>→</span>
        </button>
      </form>
    </section>
  </main>
</template>

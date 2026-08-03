<script setup lang="ts">
const { login, loginWithCode, sendVerification } = useCustomerSession();
const form = reactive({ phone: '', password: '', code: '' });
const mode = ref<'password' | 'code'>('password');
const sending = ref(false);
const loading = ref(false);
const { showToast } = useAppToast();
const notify = (value: string) =>
  showToast(value, /失败|错误|检查/.test(value) ? 'error' : 'success');
async function submit(): Promise<void> {
  loading.value = true;
  try {
    if (mode.value === 'password') await login({ phone: form.phone, password: form.password });
    else await loginWithCode({ phone: form.phone, code: form.code });
    await navigateTo('/profile');
  } catch (error) {
    notify(error instanceof Error ? error.message : '登录失败');
  } finally {
    loading.value = false;
  }
}
async function sendCode(): Promise<void> {
  sending.value = true;
  try {
    const result = await sendVerification({ channel: 'sms', target: form.phone, purpose: 'login' });
    if (result.developmentCode) form.code = result.developmentCode;
    notify(result.developmentCode ? '开发模式验证码已自动填入' : '验证码已发送');
  } catch (error) {
    notify(error instanceof Error ? error.message : '发送失败');
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
        <p class="muted">还没有账号？<NuxtLink to="/register">立即注册</NuxtLink></p>
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
          >手机号<input
            v-model.trim="form.phone"
            required
            inputmode="numeric"
            autocomplete="tel"
            maxlength="11"
            placeholder="请输入 11 位手机号" /></label
        ><label v-if="mode === 'password'"
          >密码<input
            v-model="form.password"
            required
            type="password"
            autocomplete="current-password"
            minlength="8"
            placeholder="请输入密码" /></label
        ><label v-else
          >短信验证码
          <div class="code-input">
            <input v-model.trim="form.code" required maxlength="6" inputmode="numeric" /><button
              type="button"
              class="button button-light"
              :disabled="sending"
              @click="sendCode"
            >
              {{ sending ? '发送中…' : '获取验证码' }}
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

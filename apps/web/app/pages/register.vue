<script setup lang="ts">
const { register, sendVerification } = useCustomerSession();
const form = reactive({
  name: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
  verificationCode: '',
});
const loading = ref(false);
const sending = ref(false);
const countdown = ref(0);
const message = ref('');
async function submit(): Promise<void> {
  message.value = '';
  if (form.password !== form.confirmPassword) {
    message.value = '两次输入的密码不一致';
    return;
  }
  loading.value = true;
  try {
    await register({
      name: form.name,
      phone: form.phone,
      password: form.password,
      verificationCode: form.verificationCode,
      ...(form.email ? { email: form.email } : {}),
    });
    await navigateTo('/profile');
  } catch (error) {
    message.value = error instanceof Error ? error.message : '注册失败';
  } finally {
    loading.value = false;
  }
}
async function sendCode(): Promise<void> {
  if (!/^1\d{10}$/.test(form.phone) || sending.value || countdown.value) {
    message.value = '请先填写正确的手机号';
    return;
  }
  sending.value = true;
  message.value = '';
  try {
    const result = await sendVerification({
      channel: 'sms',
      target: form.phone,
      purpose: 'register',
    });
    if (result.developmentCode) form.verificationCode = result.developmentCode;
    countdown.value = result.retryAfter;
    const timer = window.setInterval(() => {
      countdown.value -= 1;
      if (countdown.value <= 0) window.clearInterval(timer);
    }, 1000);
    message.value = result.developmentCode ? '开发模式验证码已自动填入' : '验证码已发送';
  } catch (error) {
    message.value = error instanceof Error ? error.message : '验证码发送失败';
  } finally {
    sending.value = false;
  }
}
useSeoMeta({ title: '创建账号 · 澄序', description: '创建你的用户端账号。' });
</script>
<template>
  <main class="auth-page">
    <section class="auth-intro">
      <p class="eyebrow"><span /> GET STARTED</p>
      <h1>一个清晰的开始，<br />值得被认真对待。</h1>
      <p>使用手机号创建独立用户账号，稍后可以随时完善资料。</p>
    </section>
    <section class="auth-card auth-card-wide">
      <div>
        <p class="auth-kicker">创建账号</p>
        <h2>开始使用</h2>
        <p class="muted">已有账号？<NuxtLink to="/login">返回登录</NuxtLink></p>
      </div>
      <form class="form-grid" @submit.prevent="submit">
        <label
          >称呼<input
            v-model.trim="form.name"
            required
            autocomplete="name"
            maxlength="40"
            placeholder="怎么称呼你" /></label
        ><label
          >手机号<input
            v-model.trim="form.phone"
            required
            inputmode="numeric"
            autocomplete="tel"
            maxlength="11"
            placeholder="请输入 11 位手机号" /></label
        ><label class="full"
          >短信验证码
          <div class="code-input">
            <input
              v-model.trim="form.verificationCode"
              required
              inputmode="numeric"
              maxlength="6"
              placeholder="6 位验证码"
            /><button
              type="button"
              class="button button-light"
              :disabled="sending || countdown > 0"
              @click="sendCode"
            >
              {{ countdown > 0 ? `${countdown}s` : sending ? '发送中…' : '获取验证码' }}
            </button>
          </div></label
        ><label class="full"
          >邮箱 <small>选填</small
          ><input
            v-model.trim="form.email"
            type="email"
            autocomplete="email"
            placeholder="用于接收通知" /></label
        ><label
          >密码<input
            v-model="form.password"
            required
            type="password"
            autocomplete="new-password"
            minlength="8"
            placeholder="至少 8 位" /></label
        ><label
          >确认密码<input
            v-model="form.confirmPassword"
            required
            type="password"
            autocomplete="new-password"
            minlength="8"
            placeholder="再次输入密码"
        /></label>
        <p v-if="message" class="form-error full" role="alert">{{ message }}</p>
        <button class="button button-block full" :disabled="loading">
          {{ loading ? '正在创建…' : '创建账号' }} <span>→</span>
        </button>
      </form>
    </section>
  </main>
</template>

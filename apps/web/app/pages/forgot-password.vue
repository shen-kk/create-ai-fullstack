<script setup lang="ts">
const { resetPassword, sendVerification } = useCustomerSession();
const form = reactive({ phone: '', code: '', newPassword: '', confirmPassword: '' });
const loading = ref(false);
const sending = ref(false);
const { showToast } = useAppToast();
const notify = (value: string) =>
  showToast(value, /失败|错误|不一致|检查/.test(value) ? 'error' : 'success');
async function sendCode(): Promise<void> {
  sending.value = true;
  try {
    const result = await sendVerification({
      channel: 'sms',
      target: form.phone,
      purpose: 'reset_password',
    });
    notify('验证码已发送');
  } catch (error) {
    notify(error instanceof Error ? error.message : '发送失败');
  } finally {
    sending.value = false;
  }
}
async function submit(): Promise<void> {
  if (form.newPassword !== form.confirmPassword) {
    notify('两次密码不一致');
    return;
  }
  loading.value = true;
  try {
    await resetPassword({ phone: form.phone, code: form.code, newPassword: form.newPassword });
    notify('密码已重置，即将返回登录');
    setTimeout(() => navigateTo('/login'), 900);
  } catch (error) {
    notify(error instanceof Error ? error.message : '重置失败');
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
      <p>通过已绑定手机号验证身份并设置新密码。</p>
    </section>
    <section class="auth-card auth-card-wide">
      <div>
        <p class="auth-kicker">账号安全</p>
        <h2>找回密码</h2>
      </div>
      <form class="form-grid" @submit.prevent="submit">
        <label class="full"
          >手机号<input
            v-model.trim="form.phone"
            required
            inputmode="numeric"
            maxlength="11" /></label
        ><label class="full"
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

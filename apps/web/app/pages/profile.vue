<script setup lang="ts">
import { project } from '../generated/project';
definePageMeta({ middleware: 'customer-auth' });
const { customer, authenticated, updateProfile, sendVerification } = useCustomerSession();
const profile = reactive({ name: '', email: '', avatarUrl: '' });
const passwords = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' });
const profileMessage = ref('');
const passwordMessage = ref('');
const emailBinding = reactive({ email: '', code: '' });
const emailMessage = ref('');
watch(
  customer,
  (value) => {
    if (value)
      Object.assign(profile, {
        name: value.name,
        email: value.email ?? '',
        avatarUrl: value.avatarUrl ?? '',
      });
  },
  { immediate: true },
);
async function saveProfile(): Promise<void> {
  profileMessage.value = '';
  try {
    const result = await updateProfile({
      name: profile.name,
      email: profile.email || null,
      avatarUrl: profile.avatarUrl || null,
    });
    Object.assign(profile, {
      name: result.name,
      email: result.email ?? '',
      avatarUrl: result.avatarUrl ?? '',
    });
    profileMessage.value = '资料已保存';
  } catch (error) {
    profileMessage.value = error instanceof Error ? error.message : '保存失败';
  }
}
async function sendEmailCode(): Promise<void> {
  try {
    const result = await sendVerification({
      channel: 'email',
      target: emailBinding.email,
      purpose: 'bind_contact',
    });
    if (result.developmentCode) emailBinding.code = result.developmentCode;
    emailMessage.value = result.developmentCode ? '开发模式验证码已自动填入' : '验证邮件已发送';
  } catch (error) {
    emailMessage.value = error instanceof Error ? error.message : '发送失败';
  }
}
async function bindEmail(): Promise<void> {
  try {
    await authenticated('/contact/bind', {
      method: 'POST',
      body: JSON.stringify({
        channel: 'email',
        target: emailBinding.email,
        code: emailBinding.code,
      }),
    });
    emailMessage.value = '邮箱已验证并绑定，刷新后生效';
    await navigateTo('/profile', { replace: true });
  } catch (error) {
    emailMessage.value = error instanceof Error ? error.message : '绑定失败';
  }
}
async function changePassword(): Promise<void> {
  passwordMessage.value = '';
  if (passwords.newPassword !== passwords.confirmPassword) {
    passwordMessage.value = '两次输入的新密码不一致';
    return;
  }
  try {
    await authenticated('/password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      }),
    });
    Object.assign(passwords, { currentPassword: '', newPassword: '', confirmPassword: '' });
    passwordMessage.value = '密码已更新';
  } catch (error) {
    passwordMessage.value = error instanceof Error ? error.message : '修改失败';
  }
}
useSeoMeta({ title: '个人中心 · 澄序', robots: 'noindex,nofollow' });
</script>
<template>
  <main class="profile-page section-wrap">
    <header class="profile-heading">
      <p class="eyebrow"><span /> ACCOUNT</p>
      <h1>个人中心</h1>
      <p>管理你的公开资料和账号安全。</p>
    </header>
    <div v-if="customer" class="profile-layout">
      <aside class="profile-summary">
        <div class="avatar-large">{{ customer.name.slice(0, 1) }}</div>
        <h2>{{ customer.name }}</h2>
        <p>{{ customer.phone }}</p>
        <span>账号状态正常</span>
      </aside>
      <div class="settings-stack">
        <section class="settings-card">
          <div class="settings-title">
            <div>
              <h2>基本资料</h2>
              <p>这些信息用于产品内的身份展示。</p>
            </div>
            <b>01</b>
          </div>
          <form class="form-grid" @submit.prevent="saveProfile">
            <label>称呼<input v-model.trim="profile.name" required maxlength="40" /></label
            ><label
              >联系邮箱<input
                v-model.trim="profile.email"
                type="email"
                readonly
                placeholder="请在安全设置中验证绑定" /></label
            ><label class="full"
              >头像 URL<input
                v-model.trim="profile.avatarUrl"
                type="url"
                placeholder="https://...（选填）"
            /></label>
            <p v-if="profileMessage" class="form-notice full" role="status">{{ profileMessage }}</p>
            <div class="form-actions full">
              <button class="button" type="submit">保存资料</button>
            </div>
          </form>
        </section>
        <section v-if="project.modules.email" class="settings-card">
          <div class="settings-title">
            <div>
              <h2>验证邮箱</h2>
              <p>用于账号找回、验证和通知，密钥始终由服务端使用。</p>
            </div>
            <b>02</b>
          </div>
          <form class="form-grid" @submit.prevent="bindEmail">
            <label class="full"
              >邮箱<input v-model.trim="emailBinding.email" required type="email" /></label
            ><label class="full"
              >邮箱验证码
              <div class="code-input">
                <input v-model.trim="emailBinding.code" required maxlength="6" /><button
                  type="button"
                  class="button button-light"
                  @click="sendEmailCode"
                >
                  发送验证码
                </button>
              </div></label
            >
            <p v-if="emailMessage" class="form-notice full">{{ emailMessage }}</p>
            <div class="form-actions full">
              <button class="button" type="submit">验证并绑定</button>
            </div>
          </form>
        </section>
        <section class="settings-card">
          <div class="settings-title">
            <div>
              <h2>修改密码</h2>
              <p>建议使用至少 8 位且不重复的密码。</p>
            </div>
            <b>02</b>
          </div>
          <form class="form-grid" @submit.prevent="changePassword">
            <label class="full"
              >当前密码<input
                v-model="passwords.currentPassword"
                required
                type="password"
                autocomplete="current-password"
                minlength="8" /></label
            ><label
              >新密码<input
                v-model="passwords.newPassword"
                required
                type="password"
                autocomplete="new-password"
                minlength="8" /></label
            ><label
              >确认新密码<input
                v-model="passwords.confirmPassword"
                required
                type="password"
                autocomplete="new-password"
                minlength="8"
            /></label>
            <p v-if="passwordMessage" class="form-notice full" role="status">
              {{ passwordMessage }}
            </p>
            <div class="form-actions full">
              <button class="button button-outline" type="submit">更新密码</button>
            </div>
          </form>
        </section>
      </div>
    </div>
    <div v-else class="loading-card">正在恢复账号信息…</div>
  </main>
</template>

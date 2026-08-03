<script setup lang="ts">
import { project } from '../generated/project';
import type { CustomerSessionDevice } from '@template/contracts';
definePageMeta({ middleware: 'customer-auth' });
const {
  customer,
  updateProfile,
  changePassword: changeCustomerPassword,
  bindContact,
  listSessions,
  revokeSession,
  revokeOtherSessions,
  sendVerification,
} = useCustomerSession();
const profile = reactive({ name: '', email: '', avatarUrl: '' });
const passwords = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' });
const profileMessage = ref('');
const passwordMessage = ref('');
const emailBinding = reactive({ email: '', code: '' });
const emailMessage = ref('');
const devices = ref<CustomerSessionDevice[]>([]);
const deviceMessage = ref('');
const { showToast } = useAppToast();
watch([profileMessage, passwordMessage, emailMessage, deviceMessage], (values, previous) => {
  values.forEach((value, index) => {
    if (value && value !== previous[index])
      showToast(value, /失败|错误/.test(value) ? 'error' : 'success');
  });
});
async function loadDevices(): Promise<void> {
  try {
    devices.value = await listSessions();
  } catch {
    deviceMessage.value = '登录设备加载失败';
  }
}
async function revokeDevice(id: string): Promise<void> {
  try {
    await revokeSession(id);
    deviceMessage.value = '该设备已退出';
    await loadDevices();
  } catch {
    deviceMessage.value = '退出设备失败';
  }
}
async function revokeOthers(): Promise<void> {
  try {
    await revokeOtherSessions();
    deviceMessage.value = '其他设备已全部退出';
    await loadDevices();
  } catch {
    deviceMessage.value = '操作失败';
  }
}
onMounted(loadDevices);
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
    const updated = await bindContact({
      channel: 'email',
      target: emailBinding.email,
      code: emailBinding.code,
    });
    profile.email = updated.email ?? '';
    emailMessage.value = '邮箱已验证并绑定';
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
    await changeCustomerPassword({
      currentPassword: passwords.currentPassword,
      newPassword: passwords.newPassword,
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
            <div class="form-actions full">
              <button class="button" type="submit">保存资料</button>
            </div>
          </form>
        </section>
        <section class="settings-card">
          <div class="settings-title">
            <div>
              <h2>登录设备</h2>
              <p>查看仍可刷新登录状态的设备，并远程退出异常会话。</p>
            </div>
            <b>04</b>
          </div>
          <div v-if="!devices.length" class="loading-card">暂无其他有效会话</div>
          <div v-else class="device-list">
            <article v-for="device in devices" :key="device.id">
              <div>
                <strong>{{ device.current ? '当前设备' : '其他设备' }}</strong>
                <p>{{ device.userAgent || '未知浏览器' }}</p>
                <small
                  >{{ device.ipAddress || '未知 IP' }} ·
                  {{ new Date(device.createdAt).toLocaleString('zh-CN') }}</small
                >
              </div>
              <button
                v-if="!device.current"
                class="button button-light"
                @click="revokeDevice(device.id)"
              >
                退出此设备
              </button>
            </article>
          </div>
          <div class="form-actions">
            <button class="button button-outline" @click="revokeOthers">退出其他设备</button>
          </div>
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

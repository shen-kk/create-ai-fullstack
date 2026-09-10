<script setup lang="ts">
import { project } from '../generated/project';
import { PASSWORD_MIN_LENGTH, type CustomerSessionDevice } from '@template/contracts';
definePageMeta({ middleware: 'customer-auth' });
const {
  customer,
  updateProfile,
  uploadAvatar,
  changePassword: changeCustomerPassword,
  bindContact,
  listSessions,
  revokeSession,
  revokeOtherSessions,
} = useCustomerSession();
const profile = reactive({ name: '', email: '', avatarUrl: '' });
const passwords = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' });
const emailBinding = reactive({ email: '', code: '' });
const devices = ref<CustomerSessionDevice[]>([]);
const avatarInput = ref<HTMLInputElement | null>(null);
const avatarUploading = ref(false);
const profileSaving = ref(false);
const emailSaving = ref(false);
const passwordSaving = ref(false);
const deviceSaving = ref(false);
type ProfileSection = 'profile' | 'contact' | 'security' | 'devices';
const activeSection = ref<ProfileSection>('profile');
const sections: Array<{ id: ProfileSection; label: string; description: string }> = [
  { id: 'profile', label: '个人资料', description: '名称与头像' },
  { id: 'contact', label: '联系方式', description: '手机与邮箱' },
  { id: 'security', label: '安全设置', description: '密码与验证' },
  { id: 'devices', label: '登录设备', description: '会话与访问' },
];
const { showSuccess, showError } = useAppToast();
const {
  sending: emailCodeSending,
  remaining: emailCodeRemaining,
  label: emailCodeLabel,
  send: sendEmailCode,
} = useVerificationCode('bind-email', () => ({
  channel: 'email',
  target: emailBinding.email,
  purpose: 'bind_contact',
}));
async function loadDevices(): Promise<void> {
  try {
    devices.value = await listSessions();
  } catch {
    showError('登录设备加载失败');
  }
}
async function revokeDevice(id: string): Promise<void> {
  if (deviceSaving.value) return;
  deviceSaving.value = true;
  try {
    await revokeSession(id);
    showSuccess('该设备已退出');
    await loadDevices();
  } catch {
    showError('退出设备失败');
  } finally {
    deviceSaving.value = false;
  }
}
async function revokeOthers(): Promise<void> {
  if (deviceSaving.value) return;
  deviceSaving.value = true;
  try {
    await revokeOtherSessions();
    showSuccess('其他设备已全部退出');
    await loadDevices();
  } catch {
    showError('操作失败');
  } finally {
    deviceSaving.value = false;
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
  if (profileSaving.value) return;
  profileSaving.value = true;
  try {
    await updateProfile({ name: profile.name });
    showSuccess('资料已保存');
  } catch (error) {
    showError(error instanceof Error ? error.message : '保存失败');
  } finally {
    profileSaving.value = false;
  }
}
async function selectAvatar(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  avatarUploading.value = true;
  try {
    await uploadAvatar(file);
    showSuccess('头像已更新');
  } catch (error) {
    showError(error instanceof Error ? error.message : '头像上传失败');
  } finally {
    avatarUploading.value = false;
    input.value = '';
  }
}
async function bindEmail(): Promise<void> {
  if (emailSaving.value) return;
  emailSaving.value = true;
  try {
    await bindContact({
      channel: 'email',
      target: emailBinding.email,
      code: emailBinding.code,
    });
    showSuccess('邮箱已验证并绑定');
  } catch (error) {
    showError(error instanceof Error ? error.message : '绑定失败');
  } finally {
    emailSaving.value = false;
  }
}
async function changePassword(): Promise<void> {
  if (passwordSaving.value) return;
  if (passwords.newPassword !== passwords.confirmPassword) {
    showError('两次输入的新密码不一致');
    return;
  }
  passwordSaving.value = true;
  try {
    await changeCustomerPassword({
      ...(customer.value?.passwordConfigured ? { currentPassword: passwords.currentPassword } : {}),
      newPassword: passwords.newPassword,
    });
    Object.assign(passwords, { currentPassword: '', newPassword: '', confirmPassword: '' });
    showSuccess('密码已更新');
  } catch (error) {
    showError(error instanceof Error ? error.message : '修改失败');
  } finally {
    passwordSaving.value = false;
  }
}
function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
useSeoMeta({ title: `个人中心 · ${project.displayName}`, robots: 'noindex,nofollow' });
</script>
<template>
  <main class="profile-page">
    <div class="profile-container">
      <header class="profile-heading">
        <div>
          <p class="eyebrow"><span /> ACCOUNT SETTINGS</p>
          <h1>账号设置</h1>
          <p>在一个地方管理你的个人资料、联系方式与账号安全。</p>
        </div>
        <div v-if="customer" class="profile-heading-account">
          <div class="avatar-heading">
            <img v-if="customer.avatarUrl" :src="customer.avatarUrl" alt="" /><template v-else>{{
              customer.name.slice(0, 1)
            }}</template>
          </div>
          <div>
            <strong>{{ customer.name }}</strong
            ><span>{{ customer.phone || customer.email || '未绑定账号' }}</span>
          </div>
        </div>
      </header>

      <div v-if="customer" class="profile-layout">
        <aside class="profile-sidebar">
          <div class="profile-identity">
            <div class="avatar-large">
              <img v-if="customer.avatarUrl" :src="customer.avatarUrl" alt="" /><template v-else>{{
                customer.name.slice(0, 1)
              }}</template>
            </div>
            <div>
              <h2>{{ customer.name }}</h2>
              <p>{{ customer.phone || customer.email || '未绑定账号' }}</p>
            </div>
            <span class="account-badge"><i /> 账号正常</span>
          </div>
          <nav class="profile-menu" aria-label="账号设置">
            <button
              v-for="(section, index) in sections"
              :key="section.id"
              type="button"
              :class="{ active: activeSection === section.id }"
              @click="activeSection = section.id"
            >
              <span class="profile-menu-icon">
                <svg v-if="index === 0" viewBox="0 0 24 24">
                  <path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
                </svg>
                <svg v-else-if="index === 1" viewBox="0 0 24 24">
                  <path d="M4 5h16v14H4zM4 7l8 6 8-6" />
                </svg>
                <svg v-else-if="index === 2" viewBox="0 0 24 24">
                  <path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5zM12 15v2" />
                </svg>
                <svg v-else viewBox="0 0 24 24"><path d="M5 4h14v16H5zM9 17h6M8 7h8v6H8z" /></svg>
              </span>
              <span
                ><strong>{{ section.label }}</strong
                ><small>{{ section.description }}</small></span
              >
              <b>›</b>
            </button>
          </nav>
          <div class="profile-sidebar-foot">
            <span>账号 ID</span><code>{{ customer.id.slice(0, 12) }}</code>
          </div>
        </aside>

        <div class="settings-panel">
          <section v-if="activeSection === 'profile'" class="settings-card">
            <div class="settings-title">
              <div>
                <span class="settings-kicker">PROFILE</span>
                <h2>个人资料</h2>
                <p>这些信息将用于产品内的身份展示。</p>
              </div>
              <div class="settings-avatar-preview">
                <img v-if="profile.avatarUrl" :src="profile.avatarUrl" alt="当前头像" />
                <span v-else>{{ profile.name.slice(0, 1) || '用' }}</span>
              </div>
            </div>
            <form class="form-grid" @submit.prevent="saveProfile">
              <div class="avatar-upload-row full">
                <div class="avatar-upload-preview">
                  <img v-if="profile.avatarUrl" :src="profile.avatarUrl" alt="当前头像" />
                  <span v-else>{{ profile.name.slice(0, 1) || '用' }}</span>
                </div>
                <div>
                  <strong>个人头像</strong>
                  <p>支持 JPG、PNG 或 WebP，文件不超过 2 MB。</p>
                  <button
                    class="button button-light button-small"
                    type="button"
                    :disabled="avatarUploading"
                    @click="avatarInput?.click()"
                  >
                    {{ avatarUploading ? '正在上传…' : '上传新头像' }}
                  </button>
                </div>
                <input
                  ref="avatarInput"
                  class="visually-hidden"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  @change="selectAvatar"
                />
              </div>
              <FormField class="full" label="显示名称" help="最多 40 个字符">
                <Input
                  v-model="profile.name"
                  trim
                  required
                  maxlength="40"
                  placeholder="请输入显示名称"
                />
              </FormField>
              <div class="form-actions full settings-footer">
                <p>保存后立即同步到当前账号。</p>
                <button class="button" type="submit" :disabled="profileSaving">保存更改</button>
              </div>
            </form>
          </section>

          <section v-else-if="activeSection === 'contact'" class="settings-card">
            <div class="settings-title">
              <div>
                <span class="settings-kicker">CONTACT</span>
                <h2>联系方式</h2>
                <p>管理账号的主要联系方式与验证状态。</p>
              </div>
              <span class="verified-pill">手机已验证</span>
            </div>
            <div class="contact-current">
              <div>
                <span>登录账号</span
                ><strong>{{ customer.phone || customer.email || '未绑定账号' }}</strong>
              </div>
              <b>已验证</b>
            </div>
            <form
              v-if="project.modules.email"
              class="form-grid contact-form"
              @submit.prevent="bindEmail"
            >
              <FormField
                class="full"
                label="邮箱地址"
                :help="profile.email ? `当前已绑定 ${profile.email}` : '绑定后可用于接收账号通知。'"
              >
                <Input
                  v-model="emailBinding.email"
                  trim
                  required
                  type="email"
                  :placeholder="profile.email || 'name@example.com'"
                />
              </FormField>
              <FormField class="full" label="邮箱验证码">
                <div class="code-input">
                  <Input
                    v-model="emailBinding.code"
                    trim
                    required
                    maxlength="6"
                    placeholder="6 位验证码"
                  />
                  <button
                    type="button"
                    class="button button-light"
                    :disabled="emailCodeSending || emailCodeRemaining > 0"
                    @click="sendEmailCode"
                  >
                    {{ emailCodeLabel }}
                  </button>
                </div>
              </FormField>
              <div class="form-actions full settings-footer">
                <p>邮箱变更必须先完成验证。</p>
                <button class="button" type="submit" :disabled="emailSaving">验证并绑定</button>
              </div>
            </form>
          </section>

          <section v-else-if="activeSection === 'security'" class="settings-card">
            <div class="settings-title">
              <div>
                <span class="settings-kicker">SECURITY</span>
                <h2>{{ customer.passwordConfigured ? '修改密码' : '设置密码' }}</h2>
                <p v-if="customer.passwordConfigured">定期更新密码，避免在多个站点使用相同密码。</p>
                <p v-else>设置密码后，你也可以使用账号和密码登录。</p>
              </div>
              <div class="security-shield">
                <svg viewBox="0 0 24 24">
                  <path d="M12 3l7 3v5c0 4.8-2.8 8.2-7 10-4.2-1.8-7-5.2-7-10V6l7-3Z" />
                </svg>
              </div>
            </div>
            <form class="form-grid" @submit.prevent="changePassword">
              <FormField v-if="customer.passwordConfigured" class="full" label="当前密码">
                <Input
                  v-model="passwords.currentPassword"
                  required
                  type="password"
                  autocomplete="current-password"
                  :minlength="PASSWORD_MIN_LENGTH"
                  placeholder="输入当前密码"
                />
              </FormField>
              <FormField label="新密码">
                <Input
                  v-model="passwords.newPassword"
                  required
                  type="password"
                  autocomplete="new-password"
                  :minlength="PASSWORD_MIN_LENGTH"
                  :placeholder="`至少 ${PASSWORD_MIN_LENGTH} 位`"
                />
              </FormField>
              <FormField label="确认新密码">
                <Input
                  v-model="passwords.confirmPassword"
                  required
                  type="password"
                  autocomplete="new-password"
                  :minlength="PASSWORD_MIN_LENGTH"
                  placeholder="再次输入"
                />
              </FormField>
              <div class="password-advice full"><i />建议包含大小写字母、数字和特殊符号。</div>
              <div class="form-actions full settings-footer">
                <p>
                  {{
                    customer.passwordConfigured
                      ? '更新后请使用新密码登录。'
                      : '密码设置后立即生效。'
                  }}
                </p>
                <button class="button" type="submit" :disabled="passwordSaving">
                  {{ customer.passwordConfigured ? '更新密码' : '设置密码' }}
                </button>
              </div>
            </form>
          </section>

          <section v-else class="settings-card">
            <div class="settings-title">
              <div>
                <span class="settings-kicker">DEVICES</span>
                <h2>登录设备</h2>
                <p>查看有效会话，并远程退出不再使用的设备。</p>
              </div>
              <span class="device-count">{{ devices.length }} 个会话</span>
            </div>
            <div v-if="!devices.length" class="profile-empty">
              <span>○</span><strong>暂无有效会话</strong>
              <p>完成登录后设备将出现在这里。</p>
            </div>
            <div v-else class="device-list">
              <article
                v-for="device in devices"
                :key="device.id"
                :class="{ current: device.current }"
              >
                <div class="device-icon">
                  <svg viewBox="0 0 24 24"><path d="M4 5h16v12H4zM8 21h8M12 17v4" /></svg>
                </div>
                <div class="device-copy">
                  <div>
                    <strong>{{ device.current ? '当前设备' : '其他设备' }}</strong
                    ><span v-if="device.current">当前</span>
                  </div>
                  <p>{{ device.userAgent || '未知浏览器' }}</p>
                  <small
                    >{{ device.ipAddress || '未知 IP' }} · {{ formatDate(device.createdAt) }}</small
                  >
                </div>
                <button
                  v-if="!device.current"
                  class="button button-light button-small"
                  :disabled="deviceSaving"
                  @click="revokeDevice(device.id)"
                >
                  退出
                </button>
              </article>
            </div>
            <div class="form-actions settings-footer">
              <p>如发现陌生设备，建议立即退出并修改密码。</p>
              <button class="button button-outline" :disabled="deviceSaving" @click="revokeOthers">
                退出其他设备
              </button>
            </div>
          </section>
        </div>
      </div>
      <div v-else class="loading-card">正在恢复账号信息…</div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { PASSWORD_MIN_LENGTH, type AuthSessionDevice } from '@template/contracts';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  changePassword,
  listAuthSessions,
  revokeOtherAuthSessions,
  updateProfile,
  uploadAvatar,
} from '../api/profile';
import { getCurrentUser, saveCurrentUser } from '../auth/session';
import AppPasswordInput from '../components/AppPasswordInput.vue';
import AppIcon from '../components/AppIcon.vue';
import { showAdminNotice } from '../components/admin-notice';

const router = useRouter(),
  user = getCurrentUser();
const profile = ref({ name: user?.name ?? '', avatarUrl: user?.avatarUrl ?? '' });
const password = ref({ currentPassword: '', newPassword: '', confirmPassword: '' });
const devices = ref<AuthSessionDevice[]>([]);
const saving = ref(false),
  uploading = ref(false),
  loadingDevices = ref(false),
  revokingDevices = ref(false);
const initials = (): string => profile.value.name.slice(0, 2).toUpperCase();
const formatDate = (value: string): string => new Date(value).toLocaleString('zh-CN');

async function loadDevices(): Promise<void> {
  loadingDevices.value = true;
  try {
    devices.value = await listAuthSessions();
  } catch {
    showAdminNotice('error', '登录设备加载失败，请稍后重试。');
  } finally {
    loadingDevices.value = false;
  }
}

async function revokeOthers(): Promise<void> {
  revokingDevices.value = true;
  try {
    await revokeOtherAuthSessions();
    await loadDevices();
    showAdminNotice('success', '其他设备已全部退出。');
  } catch {
    showAdminNotice('error', '退出其他设备失败，请稍后重试。');
  } finally {
    revokingDevices.value = false;
  }
}

async function saveProfile(): Promise<void> {
  saving.value = true;
  try {
    const updated = await updateProfile({ name: profile.value.name });
    saveCurrentUser(updated);
    showAdminNotice('success', '个人资料已更新。');
  } catch {
    showAdminNotice('error', '资料更新失败，请检查输入内容。');
  } finally {
    saving.value = false;
  }
}
async function selectAvatar(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  input.value = '';
  if (!file) return;
  uploading.value = true;
  try {
    const updated = await uploadAvatar(file);
    profile.value.avatarUrl = updated.avatarUrl ?? '';
    saveCurrentUser(updated);
    showAdminNotice('success', '头像已上传到对象存储并更新。');
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : '';
    showAdminNotice(
      'error',
      code.includes('OBJECT_STORAGE_NOT_CONFIGURED') ||
        code.includes('OBJECT_STORAGE_CONFIG_INCOMPLETE')
        ? '请先在“服务配置”中完善并启用腾讯云 COS，再上传头像。'
        : code.includes('OBJECT_STORAGE_ADAPTER_UNAVAILABLE')
          ? '当前头像上传仅支持腾讯云 COS，请切换对象存储平台。'
          : '头像上传失败，仅支持 2MB 内的 JPG、PNG 或 WebP 图片。',
    );
  } finally {
    uploading.value = false;
  }
}
async function savePassword(): Promise<void> {
  if (password.value.newPassword !== password.value.confirmPassword) {
    showAdminNotice('error', '两次输入的新密码不一致。');
    return;
  }
  saving.value = true;
  try {
    await changePassword({
      currentPassword: password.value.currentPassword,
      newPassword: password.value.newPassword,
    });
    password.value = { currentPassword: '', newPassword: '', confirmPassword: '' };
    showAdminNotice('success', '密码修改成功。');
  } catch {
    showAdminNotice(
      'error',
      `密码修改失败，请确认当前密码正确且新密码不少于 ${PASSWORD_MIN_LENGTH} 位。`,
    );
  } finally {
    saving.value = false;
  }
}
onMounted(loadDevices);
</script>

<template>
  <div>
    <section class="page-heading">
      <div>
        <p class="eyebrow">账号 / 个人中心</p>
        <h1>个人中心</h1>
        <p>管理当前登录账号的公开资料、登录密码与设备会话。</p>
      </div>
    </section>
    <div class="profile-layout">
      <section class="panel profile-card">
        <div class="profile-avatar">
          <img v-if="profile.avatarUrl" :src="profile.avatarUrl" alt="当前头像" /><span v-else>{{
            initials()
          }}</span>
        </div>
        <h2>{{ profile.name }}</h2>
        <p>{{ user?.phone }}<br />{{ user?.email || '未填写邮箱' }}</p>
        <div class="avatar-upload-actions">
          <label class="secondary-button" :class="{ disabled: uploading }"
            >{{ uploading ? '上传中…' : '上传新头像'
            }}<input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              :disabled="uploading"
              @change="selectAvatar"
          /></label>
          <p class="avatar-upload-help">
            仅上传至已配置的腾讯云 COS，不保存本地文件。支持 JPG、PNG、WebP，最大 2MB。
          </p>
          <a class="config-link" href="/integrations" @click.prevent="router.push('/integrations')"
            >前往服务配置 →</a
          >
        </div>
      </section>
      <div class="profile-forms">
        <form class="panel settings-form" @submit.prevent="saveProfile">
          <header>
            <h2>基本资料</h2>
            <p>修改名称后会同步到当前会话。</p>
          </header>
          <label
            ><span>显示名称</span
            ><input v-model.trim="profile.name" required minlength="2" maxlength="80"
          /></label>
          <footer><button class="primary-button" :disabled="saving">保存资料</button></footer>
        </form>
        <form class="panel settings-form" @submit.prevent="savePassword">
          <header>
            <h2>修改密码</h2>
            <p>新密码至少 {{ PASSWORD_MIN_LENGTH }} 位，服务端只保存安全哈希。</p>
          </header>
          <label
            ><span>当前密码</span
            ><AppPasswordInput
              :model-value="password.currentPassword"
              @update:model-value="password.currentPassword = $event"
              required
              :minlength="PASSWORD_MIN_LENGTH"
              autocomplete="current-password"
          /></label>
          <div class="profile-password-grid">
            <label
              ><span>新密码</span
              ><AppPasswordInput
                :model-value="password.newPassword"
                @update:model-value="password.newPassword = $event"
                required
                :minlength="PASSWORD_MIN_LENGTH"
                autocomplete="new-password" /></label
            ><label
              ><span>确认新密码</span
              ><AppPasswordInput
                :model-value="password.confirmPassword"
                @update:model-value="password.confirmPassword = $event"
                required
                :minlength="PASSWORD_MIN_LENGTH"
                autocomplete="new-password"
            /></label>
          </div>
          <footer><button class="primary-button" :disabled="saving">修改密码</button></footer>
        </form>
        <section class="panel settings-form device-settings">
          <header>
            <div>
              <h2>登录设备</h2>
              <p>查看当前有效会话，并退出其他不再使用的设备。</p>
            </div>
            <span class="device-count">{{ devices.length }} 个会话</span>
          </header>
          <div v-if="loadingDevices" class="device-state">
            <span class="loading-ring" />正在加载登录设备…
          </div>
          <div v-else-if="!devices.length" class="device-state">暂无有效登录设备。</div>
          <div v-else class="device-list">
            <article
              v-for="device in devices"
              :key="device.id"
              :class="{ current: device.current }"
            >
              <div class="device-icon"><AppIcon name="device" /></div>
              <div>
                <strong>{{ device.current ? '当前设备' : '其他设备' }}</strong>
                <p>{{ device.userAgent || '未知浏览器或客户端' }}</p>
                <small
                  >{{ device.ipAddress || '未知 IP' }} · 登录于 {{ formatDate(device.createdAt) }} ·
                  有效期至 {{ formatDate(device.expiresAt) }}</small
                >
              </div>
              <span v-if="device.current" class="status-pill active"><i />当前</span>
            </article>
          </div>
          <footer>
            <p>发现陌生设备时，请立即退出其他设备并修改密码。</p>
            <button
              type="button"
              class="danger-button"
              :disabled="
                revokingDevices || devices.filter((device) => !device.current).length === 0
              "
              @click="revokeOthers"
            >
              {{ revokingDevices ? '正在退出…' : '退出其他设备' }}
            </button>
          </footer>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.device-settings header,
.device-settings footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.device-count {
  flex: 0 0 auto;
  color: var(--muted);
  font-size: 12px;
}
.device-state {
  display: flex;
  min-height: 96px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--muted);
}
.device-list {
  display: grid;
  gap: 10px;
}
.device-list article {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 14px;
  border: 1px solid #e5e9f1;
  border-radius: 10px;
}
.device-list article.current {
  border-color: #b9e3ca;
  background: #f4fbf6;
}
.device-list p,
.device-list small,
.device-settings footer p {
  margin: 4px 0 0;
  color: var(--muted);
}
.device-list p {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.device-icon {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  color: #5262cf;
  background: #eef0ff;
  border-radius: 9px;
}
@media (max-width: 720px) {
  .device-settings header,
  .device-settings footer {
    align-items: flex-start;
    flex-direction: column;
  }
  .device-list article {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .device-list .status-pill {
    grid-column: 2;
    justify-self: start;
  }
}
</style>

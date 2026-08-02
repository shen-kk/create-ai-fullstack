<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { changePassword, updateProfile, uploadAvatar } from '../api/profile';
import { getCurrentUser, saveCurrentUser } from '../auth/session';

const router = useRouter(),
  user = getCurrentUser();
const profile = ref({ name: user?.name ?? '', avatarUrl: user?.avatarUrl ?? '' });
const password = ref({ currentPassword: '', newPassword: '', confirmPassword: '' });
const saving = ref(false),
  uploading = ref(false),
  notice = ref('');
const initials = (): string => profile.value.name.slice(0, 2).toUpperCase();

async function saveProfile(): Promise<void> {
  saving.value = true;
  notice.value = '';
  try {
    const updated = await updateProfile({
      name: profile.value.name,
      avatarUrl: profile.value.avatarUrl || null,
    });
    saveCurrentUser(updated);
    notice.value = '个人资料已更新。';
  } catch {
    notice.value = '资料更新失败，请检查输入内容。';
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
  notice.value = '';
  try {
    const updated = await uploadAvatar(file);
    profile.value.avatarUrl = updated.avatarUrl ?? '';
    saveCurrentUser(updated);
    notice.value = '头像已上传到对象存储并更新。';
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : '';
    notice.value =
      code.includes('OBJECT_STORAGE_NOT_CONFIGURED') ||
      code.includes('OBJECT_STORAGE_CONFIG_INCOMPLETE')
        ? '请先在“服务配置”中完善并启用腾讯云 COS，再上传头像。'
        : code.includes('OBJECT_STORAGE_ADAPTER_UNAVAILABLE')
          ? '当前头像上传仅支持腾讯云 COS，请切换对象存储平台。'
          : '头像上传失败，仅支持 2MB 内的 JPG、PNG 或 WebP 图片。';
  } finally {
    uploading.value = false;
  }
}
async function savePassword(): Promise<void> {
  if (password.value.newPassword !== password.value.confirmPassword) {
    notice.value = '两次输入的新密码不一致。';
    return;
  }
  saving.value = true;
  notice.value = '';
  try {
    await changePassword({
      currentPassword: password.value.currentPassword,
      newPassword: password.value.newPassword,
    });
    password.value = { currentPassword: '', newPassword: '', confirmPassword: '' };
    notice.value = '密码修改成功。';
  } catch {
    notice.value = '密码修改失败，请确认当前密码正确且新密码不少于 12 位。';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <section class="page-heading">
      <div>
        <p class="eyebrow">账号 / 个人中心</p>
        <h1>个人中心</h1>
        <p>管理当前登录账号的公开资料与登录密码。</p>
      </div>
    </section>
    <p v-if="notice" class="operation-notice" role="status">{{ notice }}</p>
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
            <p>新密码至少 12 位，服务端只保存安全哈希。</p>
          </header>
          <label
            ><span>当前密码</span
            ><input
              v-model="password.currentPassword"
              type="password"
              required
              minlength="12"
              autocomplete="current-password"
          /></label>
          <div class="profile-password-grid">
            <label
              ><span>新密码</span
              ><input
                v-model="password.newPassword"
                type="password"
                required
                minlength="12"
                autocomplete="new-password" /></label
            ><label
              ><span>确认新密码</span
              ><input
                v-model="password.confirmPassword"
                type="password"
                required
                minlength="12"
                autocomplete="new-password"
            /></label>
          </div>
          <footer><button class="primary-button" :disabled="saving">修改密码</button></footer>
        </form>
      </div>
    </div>
  </div>
</template>

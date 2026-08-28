<script setup lang="ts">
import { PASSWORD_MIN_LENGTH } from '@template/contracts';
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { login } from '../auth/session';
import { project } from '../generated/project';
import AppPasswordInput from '../components/AppPasswordInput.vue';

const phone = ref(''),
  password = ref(''),
  error = ref(''),
  submitting = ref(false);
const router = useRouter(),
  route = useRoute();
async function submit(): Promise<void> {
  submitting.value = true;
  error.value = '';
  try {
    await login({ phone: phone.value, password: password.value });
    await router.replace(typeof route.query.redirect === 'string' ? route.query.redirect : '/');
  } catch {
    error.value = '手机号或密码不正确';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-shell">
      <aside class="login-intro">
        <div class="brand login-brand">
          <span class="brand-mark">{{ project.displayName.slice(0, 1).toUpperCase() }}</span>
          <span>
            <strong>{{ project.displayName }}</strong>
            <small>{{ project.description }}</small>
          </span>
        </div>
        <div class="login-intro-copy">
          <p class="login-kicker"><span></span> ADMIN CONSOLE</p>
          <h1>让每一次管理，<br />都清晰而高效。</h1>
          <p>统一管理账号、角色权限、操作审计与服务配置，为业务系统提供可靠的管理底座。</p>
        </div>
        <div class="login-feature-list" aria-label="系统能力">
          <span>精细权限</span><span>安全审计</span><span>灵活配置</span>
        </div>
        <p class="login-copyright">安全、可靠、可扩展的后台管理模板</p>
      </aside>

      <div class="login-card">
        <div class="login-copy">
          <p class="eyebrow">WELCOME BACK</p>
          <h2>欢迎回来</h2>
          <p>请输入管理员账号信息，进入管理控制台。</p>
        </div>
        <form @submit.prevent="submit">
          <label>
            <span>手机号</span>
            <div class="login-input-wrap">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
                <path d="M9 6h6M10 18h4" />
              </svg>
              <input
                v-model="phone"
                type="tel"
                inputmode="tel"
                autocomplete="username"
                placeholder="请输入管理员手机号"
                required
                pattern="\+?[1-9]\d{6,14}"
              />
            </div>
          </label>
          <label>
            <span>密码</span>
            <div class="login-input-wrap">
              <AppPasswordInput
                v-model="password"
                :leading-icon="true"
                autocomplete="current-password"
                placeholder="请输入登录密码"
                required
                :minlength="PASSWORD_MIN_LENGTH"
              />
            </div>
          </label>
          <p v-if="error" class="login-error" role="alert">{{ error }}</p>
          <button class="primary-button login-submit" :disabled="submitting">
            {{ submitting ? '正在安全登录…' : '登录管理后台' }}
          </button>
        </form>
        <p class="demo-tip">
          初始手机号和随机密码保存在项目根目录 <code>.env</code> 的
          <code>DEV_ADMIN_PHONE</code>、<code>DEV_ADMIN_PASSWORD</code>，首次登录后请立即修改密码。
        </p>
      </div>
    </section>
  </main>
</template>

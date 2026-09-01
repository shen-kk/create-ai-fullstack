<script setup lang="ts">
import { adminNotice, dismissAdminNotice } from './admin-notice';
</script>

<template>
  <Transition name="admin-notice">
    <aside
      v-if="adminNotice"
      :key="adminNotice.id"
      class="app-notice"
      :class="adminNotice.kind"
      :role="adminNotice.kind === 'error' ? 'alert' : 'status'"
      :aria-live="adminNotice.kind === 'error' ? 'assertive' : 'polite'"
    >
      <span class="app-notice__mark" aria-hidden="true">{{
        adminNotice.kind === 'error' ? '!' : '✓'
      }}</span>
      <p>{{ adminNotice.message }}</p>
      <button type="button" aria-label="关闭提示" @click="dismissAdminNotice">关闭</button>
    </aside>
  </Transition>
</template>

<style scoped>
.app-notice {
  position: fixed;
  top: 24px;
  right: 28px;
  z-index: 2000;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  min-width: 300px;
  max-width: min(480px, calc(100vw - 48px));
  align-items: start;
  gap: 10px;
  padding: 14px 16px;
  color: #166534;
  background: #f0fdf4;
  border: 1px solid #86efac;
  border-radius: 12px;
  box-shadow: 0 14px 34px rgb(15 23 42 / 18%);
}
.app-notice.error {
  color: #b91c1c;
  background: #fef2f2;
  border-color: #fca5a5;
}
.app-notice__mark {
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  color: #fff;
  font-weight: 700;
  background: #16a34a;
  border-radius: 50%;
}
.app-notice.error .app-notice__mark {
  background: #dc2626;
}
.app-notice p {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
}
.app-notice button {
  padding: 1px 0;
  color: inherit;
  font-size: 12px;
  background: transparent;
  border: 0;
  cursor: pointer;
}
.admin-notice-enter-active,
.admin-notice-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}
.admin-notice-enter-from,
.admin-notice-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}
@media (max-width: 640px) {
  .app-notice {
    top: 12px;
    right: 12px;
    left: 12px;
    min-width: 0;
    max-width: none;
  }
}
</style>

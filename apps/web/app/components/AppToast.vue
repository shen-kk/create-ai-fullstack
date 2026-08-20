<script setup lang="ts">
const { toast, dismissToast } = useAppToast();
const toastMeta = computed(() => {
  if (toast.value?.tone === 'error') return { icon: '!', title: '操作未完成' };
  if (toast.value?.tone === 'success') return { icon: '✓', title: '操作成功' };
  return { icon: 'i', title: '提示' };
});
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="toast" :key="toast.id" class="app-toast" :data-tone="toast.tone" role="status">
        <span class="toast-icon" aria-hidden="true">{{ toastMeta.icon }}</span>
        <div>
          <strong>{{ toastMeta.title }}</strong>
          <p>{{ toast.message }}</p>
        </div>
        <button type="button" aria-label="关闭提示" @click="dismissToast">×</button>
      </div>
    </Transition>
  </Teleport>
</template>

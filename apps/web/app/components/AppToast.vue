<script setup lang="ts">
const { toast, dismissToast } = useAppToast();
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="toast" :key="toast.id" class="app-toast" :data-tone="toast.tone" role="status">
        <span class="toast-icon" aria-hidden="true">{{ toast.tone === 'error' ? '!' : '✓' }}</span>
        <div>
          <strong>{{ toast.tone === 'error' ? '操作未完成' : '操作成功' }}</strong>
          <p>{{ toast.message }}</p>
        </div>
        <button type="button" aria-label="关闭提示" @click="dismissToast">×</button>
      </div>
    </Transition>
  </Teleport>
</template>

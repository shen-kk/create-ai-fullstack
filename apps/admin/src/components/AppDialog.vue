<script setup lang="ts">
// UI_STANDARD_EXCEPTION: docs/decisions/0012-admin-app-dialog.md
withDefaults(
  defineProps<{ open: boolean; title: string; eyebrow?: string; size?: 'sm' | 'md' | 'lg' }>(),
  { size: 'md' },
);
const emit = defineEmits<{ close: [] }>();
</script>
<template>
  <div v-if="open" class="dialog-backdrop">
    <section
      class="app-dialog"
      :class="`app-dialog--${size}`"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
    >
      <header class="app-dialog__header">
        <div>
          <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
          <h2>{{ title }}</h2>
        </div>
        <button type="button" class="dialog-close" aria-label="关闭" @click="emit('close')">
          ×
        </button>
      </header>
      <div class="app-dialog__content"><slot /></div>
      <footer v-if="$slots.footer" class="app-dialog__footer"><slot name="footer" /></footer>
    </section>
  </div>
</template>

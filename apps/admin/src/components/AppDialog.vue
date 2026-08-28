<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

// UI_STANDARD_EXCEPTION: docs/decisions/0012-admin-app-dialog.md
const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    eyebrow?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
  }>(),
  { size: 'md' },
);
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLElement | null>(null);
let previousFocus: HTMLElement | null = null;

function syncPageScroll(locked: boolean): void {
  document.body.classList.toggle('dialog-open', locked);
}
function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close');
}

watch(
  () => props.open,
  async (open) => {
    syncPageScroll(open);
    if (open) {
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      window.addEventListener('keydown', handleKeydown);
      await nextTick();
      dialog.value?.focus();
      return;
    }
    window.removeEventListener('keydown', handleKeydown);
    previousFocus?.focus();
    previousFocus = null;
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  syncPageScroll(false);
  window.removeEventListener('keydown', handleKeydown);
});
</script>
<template>
  <div v-if="open" class="dialog-backdrop">
    <section
      ref="dialog"
      class="app-dialog"
      :class="`app-dialog--${size}`"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      tabindex="-1"
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

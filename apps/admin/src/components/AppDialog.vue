<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

// UI_STANDARD_EXCEPTION: docs/decisions/0018-admin-app-dialog.md
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
const dialog = ref<HTMLDialogElement | null>(null);
let previousFocus: HTMLElement | null = null;

function close(): void {
  dialog.value?.close();
  document.body.classList.toggle('dialog-open', Boolean(document.querySelector('dialog[open]')));
  previousFocus?.focus();
  previousFocus = null;
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      await nextTick();
      if (!props.open || !dialog.value) return;
      dialog.value.showModal();
      document.body.classList.add('dialog-open');
      return;
    }
    close();
  },
  { immediate: true },
);
onBeforeUnmount(close);
</script>
<template>
  <dialog
    v-if="open"
    ref="dialog"
    class="dialog-backdrop"
    :aria-label="title"
    @cancel.prevent="emit('close')"
  >
    <section class="app-dialog" :class="`app-dialog--${size}`">
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
  </dialog>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes['class'];
    contentClass?: HTMLAttributes['class'];
  }>(),
  { class: undefined, contentClass: undefined },
);
const open = defineModel<boolean>({ default: false });
const root = useTemplateRef<HTMLElement>('root');

function close(): void {
  open.value = false;
}
function toggle(): void {
  open.value = !open.value;
}
function handleOutside(event: PointerEvent): void {
  if (root.value && !root.value.contains(event.target as Node)) close();
}

onMounted(() => document.addEventListener('pointerdown', handleOutside));
onBeforeUnmount(() => document.removeEventListener('pointerdown', handleOutside));
</script>

<template>
  <div
    ref="root"
    :class="[props.class, { open }]"
    @mouseenter="open = true"
    @mouseleave="close"
    @keydown.esc="close"
  >
    <slot name="trigger" :open="open" :toggle="toggle" />
    <div :class="props.contentClass" role="menu" :aria-hidden="!open">
      <slot :close="close" />
    </div>
  </div>
</template>

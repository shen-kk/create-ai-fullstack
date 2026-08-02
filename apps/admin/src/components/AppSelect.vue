<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useAttrs } from 'vue';
import AppIcon from './AppIcon.vue';

defineOptions({ inheritAttrs: false });
export interface SelectOption {
  value: string;
  label: string;
}
const props = defineProps<{
  modelValue: string;
  options: SelectOption[];
  ariaLabel?: string;
  disabled?: boolean;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string]; change: [value: string] }>();
const attrs = useAttrs(),
  open = ref(false),
  root = ref<HTMLElement>();
const selected = computed(
  () => props.options.find((item) => item.value === props.modelValue) ?? props.options[0],
);
const accessibleLabel = computed(() => props.ariaLabel ?? String(attrs['aria-label'] ?? '选择项'));
function choose(value: string): void {
  emit('update:modelValue', value);
  emit('change', value);
  open.value = false;
}
function outside(event: MouseEvent): void {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false;
}
document.addEventListener('click', outside);
onBeforeUnmount(() => document.removeEventListener('click', outside));
</script>

<template>
  <div ref="root" class="app-select" :class="{ open, disabled }">
    <button
      type="button"
      class="app-select-trigger"
      :aria-label="accessibleLabel"
      :aria-expanded="open"
      :disabled="disabled"
      @click.stop="open = !open"
    >
      <span>{{ selected?.label }}</span
      ><AppIcon name="chevron" />
    </button>
    <div v-if="open" class="app-select-menu" role="listbox">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        role="option"
        :aria-selected="option.value === modelValue"
        @click.stop="choose(option.value)"
      >
        <span>{{ option.label }}</span
        ><AppIcon v-if="option.value === modelValue" name="check" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useAttrs, useId } from 'vue';
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
  root = ref<HTMLElement>(),
  trigger = ref<HTMLButtonElement>(),
  optionElements = ref<HTMLButtonElement[]>([]),
  activeIndex = ref(-1),
  listboxId = `app-select-${useId()}`;
const selected = computed(
  () => props.options.find((item) => item.value === props.modelValue) ?? props.options[0],
);
const accessibleLabel = computed(() => props.ariaLabel ?? String(attrs['aria-label'] ?? '选择项'));
const rootAttrs = computed(() => {
  const { 'aria-label': _ariaLabel, ...rest } = attrs;
  return rest;
});
function focusOption(index: number): void {
  if (!props.options.length) return;
  activeIndex.value = (index + props.options.length) % props.options.length;
  void nextTick(() => optionElements.value[activeIndex.value]?.focus());
}
function show(): void {
  if (props.disabled) return;
  optionElements.value = [];
  open.value = true;
  const selectedIndex = props.options.findIndex((item) => item.value === props.modelValue);
  focusOption(selectedIndex >= 0 ? selectedIndex : 0);
}
function hide(restoreFocus = false): void {
  open.value = false;
  activeIndex.value = -1;
  if (restoreFocus) void nextTick(() => trigger.value?.focus());
}
function choose(value: string): void {
  emit('update:modelValue', value);
  emit('change', value);
  hide(true);
}
function outside(event: MouseEvent): void {
  if (root.value && !root.value.contains(event.target as Node)) hide();
}
function onTriggerKeydown(event: KeyboardEvent): void {
  if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  if (!open.value) show();
  else if (event.key === 'ArrowDown') focusOption(activeIndex.value + 1);
  else if (event.key === 'ArrowUp') focusOption(activeIndex.value - 1);
}
function onOptionKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    focusOption(activeIndex.value + 1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    focusOption(activeIndex.value - 1);
  } else if (event.key === 'Home') {
    event.preventDefault();
    focusOption(0);
  } else if (event.key === 'End') {
    event.preventDefault();
    focusOption(props.options.length - 1);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    hide(true);
  } else if (event.key === 'Tab') hide();
}
onMounted(() => document.addEventListener('click', outside));
onBeforeUnmount(() => document.removeEventListener('click', outside));
</script>

<template>
  <div ref="root" v-bind="rootAttrs" class="app-select" :class="{ open, disabled }">
    <button
      ref="trigger"
      type="button"
      class="app-select-trigger"
      role="combobox"
      :aria-label="accessibleLabel"
      :aria-expanded="open"
      :aria-controls="listboxId"
      aria-haspopup="listbox"
      :disabled="disabled"
      @click.stop="open ? hide() : show()"
      @keydown="onTriggerKeydown"
    >
      <span>{{ selected?.label }}</span
      ><AppIcon name="chevron" />
    </button>
    <div v-if="open" :id="listboxId" class="app-select-menu" role="listbox">
      <button
        v-for="option in options"
        :ref="(element) => element && optionElements.push(element as HTMLButtonElement)"
        :key="option.value"
        type="button"
        role="option"
        tabindex="-1"
        :aria-selected="option.value === modelValue"
        @click.stop="choose(option.value)"
        @keydown="onOptionKeydown"
      >
        <span>{{ option.label }}</span
        ><AppIcon v-if="option.value === modelValue" name="check" />
      </button>
    </div>
  </div>
</template>

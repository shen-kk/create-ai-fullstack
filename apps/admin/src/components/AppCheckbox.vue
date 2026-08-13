<script setup lang="ts">
defineProps<{ modelValue: boolean; label?: string; disabled?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
</script>

<template>
  <label class="app-checkbox" :class="{ checked: modelValue, disabled }">
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="app-checkbox-mark" aria-hidden="true">
      <svg v-if="modelValue" viewBox="0 0 16 16"><path d="m3.5 8 3 3 6-7" /></svg>
    </span>
    <span><slot>{{ label }}</slot></span>
  </label>
</template>

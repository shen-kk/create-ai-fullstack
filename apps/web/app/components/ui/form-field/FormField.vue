<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

defineProps<{
  label: string;
  help?: string;
  class?: HTMLAttributes['class'];
}>();
</script>

<template>
  <label :class="$props.class">
    <span class="form-field-label">{{ label }}</span>
    <slot />
    <small v-if="help">{{ help }}</small>
  </label>
</template>

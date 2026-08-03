<script setup lang="ts">
import { usePreferredReducedMotion } from '@vueuse/core';

const props = withDefaults(
  defineProps<{
    delay?: number;
  }>(),
  { delay: 0 },
);

const preferredMotion = usePreferredReducedMotion();
const initial = computed(() =>
  preferredMotion.value === 'reduce' ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 },
);
const visibleOnce = computed(() => ({
  opacity: 1,
  y: 0,
  transition:
    preferredMotion.value === 'reduce' ? { duration: 0 } : { delay: props.delay, duration: 420 },
}));
</script>

<template>
  <div v-motion :initial :visible-once="visibleOnce">
    <slot />
  </div>
</template>

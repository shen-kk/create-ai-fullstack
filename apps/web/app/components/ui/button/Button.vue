<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VariantProps } from 'class-variance-authority';

import { cn } from '~/lib/utils';
import { buttonVariants } from './variants';

type ButtonVariants = VariantProps<typeof buttonVariants>;

withDefaults(
  defineProps<{
    type?: 'button' | 'submit' | 'reset';
    variant?: ButtonVariants['variant'];
    size?: ButtonVariants['size'];
    class?: HTMLAttributes['class'];
    disabled?: boolean;
  }>(),
  { type: 'button', variant: 'default', size: 'default', class: undefined, disabled: false },
);
</script>

<template>
  <button :type :disabled :class="cn(buttonVariants({ variant, size }), $props.class)">
    <slot />
  </button>
</template>

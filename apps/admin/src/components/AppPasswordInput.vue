<script setup lang="ts">
import { ref } from 'vue';
withDefaults(defineProps<{ modelValue: string; leadingIcon?: boolean }>(), { leadingIcon: false });
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const visible = ref(false);
</script>
<template>
  <span class="password-input"><svg v-if="leadingIcon" class="password-leading-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></svg><input v-bind="$attrs" :value="modelValue" :type="visible ? 'text' : 'password'" @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)" /><button type="button" class="password-toggle" :aria-label="visible ? '隐藏密码' : '显示密码'" @click="visible = !visible"><svg viewBox="0 0 24 24" aria-hidden="true"><path v-if="visible" d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 5.2A10.8 10.8 0 0 1 12 5c5.2 0 8.6 4 9.8 7a12.6 12.6 0 0 1-3.1 4.4M6.2 6.2C3.9 7.7 2.6 10 2.2 12c.8 2 2.7 4.6 5.8 6.1 1.2.6 2.5.9 4 .9 1 0 2-.1 2.9-.4" /><template v-else><path d="M2.2 12C3.4 9 6.8 5 12 5s8.6 4 9.8 7c-1.2 3-4.6 7-9.8 7s-8.6-4-9.8-7Z" /><circle cx="12" cy="12" r="2.5" /></template></svg></button></span>
</template>

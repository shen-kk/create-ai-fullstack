<script setup lang="ts">
defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{ trim?: boolean }>(), { trim: false });
const model = defineModel<string>({ required: true });

function update(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  model.value = props.trim ? target.value.trim() : target.value;
}
</script>

<template>
  <input v-bind="$attrs" :value="model" @input="update" />
</template>

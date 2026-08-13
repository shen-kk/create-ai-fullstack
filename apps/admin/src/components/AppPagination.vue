<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppSelect from './AppSelect.vue';

const props = withDefaults(
  defineProps<{ page: number; pageSize: number; total: number; pageSizes?: number[] }>(),
  { pageSizes: () => [10, 20, 50] },
);
const emit = defineEmits<{
  'update:page': [page: number];
  'update:pageSize': [pageSize: number];
  change: [];
}>();
const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
const jumpPage = ref(String(props.page));
const pageSizeOptions = computed(() =>
  props.pageSizes.map((value) => ({ value: String(value), label: `${value} 条/页` })),
);
watch(
  () => props.page,
  (value) => (jumpPage.value = String(value)),
);
function go(page: number): void {
  const next = Math.min(totalPages.value, Math.max(1, page));
  if (next === props.page) return;
  emit('update:page', next);
  emit('change');
}
function changePageSize(value: string): void {
  emit('update:pageSize', Number(value));
  emit('update:page', 1);
  emit('change');
}
function jump(): void {
  go(Number.parseInt(jumpPage.value, 10) || 1);
}
</script>

<template>
  <footer class="app-pagination" aria-label="分页导航">
    <span>共 {{ total }} 条</span>
    <div class="app-pagination-controls">
      <AppSelect
        class="page-size-select"
        :model-value="String(pageSize)"
        :options="pageSizeOptions"
        aria-label="每页条数"
        @change="changePageSize"
      />
      <button type="button" :disabled="page <= 1" @click="go(page - 1)">上一页</button>
      <span>第 {{ page }} / {{ totalPages }} 页</span>
      <button type="button" :disabled="page >= totalPages" @click="go(page + 1)">下一页</button>
      <label class="page-jump">
        <span>前往</span>
        <input
          v-model="jumpPage"
          type="number"
          min="1"
          :max="totalPages"
          aria-label="跳转页码"
          @keydown.enter.prevent="jump"
        />
        <span>页</span>
      </label>
      <button type="button" @click="jump">跳转</button>
    </div>
  </footer>
</template>

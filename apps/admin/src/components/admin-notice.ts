import { readonly, ref } from 'vue';

export interface AdminNotice {
  id: number;
  kind: 'success' | 'error';
  message: string;
}

const current = ref<AdminNotice>();
let sequence = 0;
let dismissTimer: ReturnType<typeof setTimeout> | undefined;

export function showAdminNotice(kind: AdminNotice['kind'], message: string): void {
  if (dismissTimer) clearTimeout(dismissTimer);
  const id = ++sequence;
  current.value = { id, kind, message };
  dismissTimer = setTimeout(
    () => {
      if (current.value?.id === id) current.value = undefined;
    },
    kind === 'error' ? 6500 : 4500,
  );
}

export function dismissAdminNotice(): void {
  if (dismissTimer) clearTimeout(dismissTimer);
  dismissTimer = undefined;
  current.value = undefined;
}

export const adminNotice = readonly(current);

export type ToastTone = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
}

export function useAppToast() {
  const toast = useState<ToastMessage | null>('app-toast', () => null);

  function showToast(message: string, tone: ToastTone = 'info'): void {
    toast.value = { id: Date.now(), message, tone };
    if (import.meta.client) {
      const id = toast.value.id;
      window.setTimeout(() => {
        if (toast.value?.id === id) toast.value = null;
      }, 3200);
    }
  }

  function dismissToast(): void {
    toast.value = null;
  }

  return { toast, showToast, dismissToast };
}

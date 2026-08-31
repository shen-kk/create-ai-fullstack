export type ToastTone = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
}

let nextToastId = 0;
let dismissTimer: number | undefined;

export function useAppToast() {
  const toast = useState<ToastMessage | null>('app-toast', () => null);

  function showToast(message: string, tone: ToastTone = 'info'): void {
    toast.value = { id: ++nextToastId, message, tone };
    if (import.meta.client) {
      if (dismissTimer) window.clearTimeout(dismissTimer);
      const id = toast.value.id;
      dismissTimer = window.setTimeout(() => {
        if (toast.value?.id === id) toast.value = null;
        dismissTimer = undefined;
      }, 3200);
    }
  }

  function dismissToast(): void {
    if (import.meta.client && dismissTimer) window.clearTimeout(dismissTimer);
    dismissTimer = undefined;
    toast.value = null;
  }

  const showSuccess = (message: string): void => showToast(message, 'success');
  const showError = (message: string): void => showToast(message, 'error');
  const showInfo = (message: string): void => showToast(message, 'info');

  return { toast, showToast, showSuccess, showError, showInfo, dismissToast };
}

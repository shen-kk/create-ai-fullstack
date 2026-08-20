export function useVerificationCountdown(scope: string) {
  const remaining = ref(0);
  let timer: ReturnType<typeof setInterval> | undefined;

  function storageKey(target: string): string {
    return `verification-countdown:${scope}:${target.trim().toLowerCase()}`;
  }

  function stopTimer(): void {
    if (timer) clearInterval(timer);
    timer = undefined;
  }

  function restore(target: string): void {
    stopTimer();
    if (!import.meta.client || !target.trim()) {
      remaining.value = 0;
      return;
    }
    const expiresAt = Number(sessionStorage.getItem(storageKey(target)) ?? 0);
    const tick = (): void => {
      remaining.value = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      if (remaining.value === 0) {
        sessionStorage.removeItem(storageKey(target));
        stopTimer();
      }
    };
    tick();
    if (remaining.value > 0) timer = setInterval(tick, 1000);
  }

  function start(seconds: number, target: string): void {
    if (!import.meta.client || !target.trim()) return;
    sessionStorage.setItem(storageKey(target), String(Date.now() + seconds * 1000));
    restore(target);
  }

  onBeforeUnmount(stopTimer);
  return { remaining: readonly(remaining), restore, start };
}

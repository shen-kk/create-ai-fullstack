import type { SendVerificationCodeRequest } from '@template/contracts';
import { computed, ref, watch } from 'vue';

export function useVerificationCode(scope: string, input: () => SendVerificationCodeRequest) {
  const { sendVerification } = useCustomerSession();
  const { showSuccess, showError } = useAppToast();
  const { remaining, restore, start } = useVerificationCountdown(scope);
  const sending = ref(false);
  const key = () => `${input().channel}:${input().target.trim().toLowerCase()}`;
  watch(key, restore, { immediate: true });
  const label = computed(() =>
    sending.value ? '发送中…' : remaining.value > 0 ? `${remaining.value} 秒后重试` : '获取验证码',
  );

  async function send(): Promise<void> {
    if (sending.value || remaining.value > 0) return;
    const request = { ...input() };
    const targetKey = key();
    sending.value = true;
    try {
      const result = await sendVerification(request);
      start(result.retryAfter, targetKey);
      restore(key());
      showSuccess(`验证码已发送，${Math.ceil(result.expiresIn / 60)} 分钟内有效`);
    } catch (error) {
      showError(error instanceof Error ? error.message : '发送失败');
    } finally {
      sending.value = false;
    }
  }
  return { sending, remaining, label, send };
}

import { effectScope, nextTick, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { useVerificationCode } from '../app/composables/useVerificationCode';

describe('verification sender', () => {
  it('prevents duplicate sends and stores cooldown against the original target', async () => {
    const pending = Promise.withResolvers<{ expiresIn: number; retryAfter: number }>();
    const sendVerification = vi.fn(() => pending.promise);
    const remaining = ref(0);
    const restore = vi.fn();
    const start = vi.fn();
    const showSuccess = vi.fn();
    vi.stubGlobal('useCustomerSession', () => ({ sendVerification }));
    vi.stubGlobal('useAppToast', () => ({ showSuccess, showError: vi.fn() }));
    vi.stubGlobal('useVerificationCountdown', () => ({ remaining, restore, start }));
    const target = ref('FIRST@example.com');
    const scope = effectScope();
    const sender = scope.run(() =>
      useVerificationCode('login', () => ({
        channel: 'email',
        target: target.value,
        purpose: 'login',
      })),
    );
    if (!sender) throw new Error('Sender not initialized');
    const sending = sender.send();
    await sender.send();
    expect(sendVerification).toHaveBeenCalledOnce();
    target.value = 'second@example.com';
    await nextTick();
    pending.resolve({ expiresIn: 300, retryAfter: 60 });
    await sending;
    expect(start).toHaveBeenCalledWith(60, 'email:first@example.com');
    expect(restore).toHaveBeenLastCalledWith('email:second@example.com');
    expect(sender.sending.value).toBe(false);
    remaining.value = 30;
    await sender.send();
    expect(sendVerification).toHaveBeenCalledOnce();
    expect(showSuccess).toHaveBeenCalledOnce();
    scope.stop();
    vi.unstubAllGlobals();
  });
});

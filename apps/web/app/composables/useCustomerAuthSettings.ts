import type { CustomerAuthSettings, VerificationChannel } from '@template/contracts';

export async function useCustomerAuthSettings() {
  const config = useRuntimeConfig();
  const { data, error } = await useFetch<CustomerAuthSettings>('/customer-auth/settings', {
    baseURL: config.public.apiBaseUrl,
    key: 'customer-auth-settings',
  });
  const settings = computed<CustomerAuthSettings>(
    () =>
      data.value ?? {
        mode: 'phone',
        availableChannels: ['sms'],
        verificationTtlSeconds: 300,
        verificationRetrySeconds: 60,
        updatedAt: null,
      },
  );
  const defaultChannel = computed<VerificationChannel>(
    () => settings.value.availableChannels[0] ?? 'sms',
  );
  return { settings, defaultChannel, error };
}

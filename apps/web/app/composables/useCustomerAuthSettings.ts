import type { CustomerAuthSettings, VerificationChannel } from '@template/contracts';

export async function useCustomerAuthSettings() {
  const config = useRuntimeConfig();
  // SSR must reach the HTTP proxy, not Nitro's internal /api routing.
  const baseURL = new URL(config.public.apiBaseUrl, useRequestURL().origin).href;
  const { data, error } = await useFetch<CustomerAuthSettings>('/customer-auth/settings', {
    baseURL,
    key: 'customer-auth-settings',
    timeout: 12_000,
  });
  const loadedSettings = data.value;
  if (error.value || !loadedSettings?.availableChannels?.length)
    throw createError({
      statusCode: 503,
      statusMessage: '登录配置加载失败，请刷新页面重试',
      fatal: true,
    });
  const settings = computed<CustomerAuthSettings>(() => data.value ?? loadedSettings);
  const defaultChannel = computed<VerificationChannel>(
    () => settings.value.availableChannels[0] ?? 'sms',
  );
  return { settings, defaultChannel, error };
}

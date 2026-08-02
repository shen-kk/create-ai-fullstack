export default defineNuxtConfig({
  compatibilityDate: '2026-08-01',
  devtools: { enabled: true },
  experimental: { chromeDevtoolsProjectSettings: false },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api',
    },
  },
  typescript: { strict: true, typeCheck: true },
});

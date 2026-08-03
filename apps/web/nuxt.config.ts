import tailwindcss from '@tailwindcss/vite';

export default defineNuxtConfig({
  compatibilityDate: '2026-08-01',
  devtools: { enabled: true },
  experimental: { chromeDevtoolsProjectSettings: false },
  css: ['~/assets/css/main.css'],
  modules: ['shadcn-nuxt', '@vueuse/motion/nuxt'],
  shadcn: {
    prefix: '',
    componentDir: './app/components/ui',
  },
  vite: {
    plugins: [tailwindcss()],
  },
  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api',
    },
  },
  typescript: { strict: true, typeCheck: true },
});

import tailwindcss from '@tailwindcss/vite';

export default defineNuxtConfig({
  compatibilityDate: '2026-08-01',
  devtools: { enabled: true },
  experimental: { chromeDevtoolsProjectSettings: false },
  app: { pageTransition: { name: 'page', mode: 'out-in' } },
  css: ['~/assets/css/main.css'],
  modules: ['shadcn-nuxt', '@vueuse/motion/nuxt'],
  shadcn: {
    prefix: '',
    componentDir: './app/components/ui',
  },
  vite: {
    plugins: [tailwindcss()],
  },
  devServer: {
    port: Number(process.env.WEB_PORT || 3002),
  },
  nitro: {
    devProxy: {
      '/api': `http://127.0.0.1:${process.env.API_PORT || 3001}/api`,
    },
  },
  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.PUBLIC_API_BASE_URL || '/api',
    },
  },
  typescript: { strict: true, typeCheck: true },
});

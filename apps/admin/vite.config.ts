import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import { project } from './src/generated/project';

const adminPort = Number(process.env.ADMIN_PORT ?? project.runtime.adminPort);
const apiPort = Number(process.env.API_PORT ?? project.runtime.apiPort);

export default defineConfig({
  plugins: [vue()],
  server: {
    port: adminPort,
    strictPort: true,
    proxy: { '/api': `http://127.0.0.1:${apiPort}` },
  },
});

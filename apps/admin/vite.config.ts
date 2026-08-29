import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import { project } from './src/generated/project';

const adminPort = Number(process.env.ADMIN_PORT ?? project.runtime.adminPort);

export default defineConfig({
  plugins: [vue()],
  server: { port: adminPort, strictPort: true },
});

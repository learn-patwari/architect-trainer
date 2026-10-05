import { defineConfig, loadEnv, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Read API_PORT from .env too, so the proxy always matches the API server.
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = Number(env.API_PORT || 5379);

  return {
    root: 'web',
    plugins: [react()],
    server: {
      port: 5378,
      strictPort: true,
      // The API listens on 127.0.0.1 only; name it explicitly (localhost may resolve to ::1 first).
      proxy: { '/api': `http://127.0.0.1:${apiPort}` },
    },
    build: {
      outDir: '../dist/web',
      emptyOutDir: true,
    },
    test: {
      root: '.',
      include: ['tests/**/*.test.ts'],
    },
  } as UserConfig & { test: unknown };
});

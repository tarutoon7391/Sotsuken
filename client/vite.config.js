// Vite の設定。開発中は /api /socket.io /uploads をサーバー（リポジトリ直下 .env の PORT）へプロキシする。
// ポートは .env の CLIENT_PORT（worktree ごとに変える）。
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  // リポジトリ直下の .env を読む（prefix '' で全キー）
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const apiPort = Number(env.PORT) || 3000;
  const clientPort = Number(env.CLIENT_PORT) || 5173;
  const apiTarget = `http://localhost:${apiPort}`;

  return {
    plugins: [react()],
    server: {
      port: clientPort,
      strictPort: true,
      proxy: {
        '/api': apiTarget,
        '/uploads': apiTarget,
        '/socket.io': { target: apiTarget, ws: true },
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});

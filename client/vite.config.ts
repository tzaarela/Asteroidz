import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: [
      { find: '@asteroidz/shared/constants', replacement: path.resolve(__dirname, '../shared/constants/index.ts') },
      { find: '@asteroidz/shared', replacement: path.resolve(__dirname, '../shared/types/index.ts') },
    ],
  },
  root: '.',
  build: {
    outDir: 'dist',
  },
  server: {
    proxy: {
      '/socket.io': {
        target: `http://localhost:${process.env['SERVER_PORT'] ?? 3000}`,
        ws: true,
      },
    },
  },
});

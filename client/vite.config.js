import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    resolve: {
        alias: [
            { find: '@asteroidz/shared/constants', replacement: path.resolve(__dirname, '../shared/constants.ts') },
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
//# sourceMappingURL=vite.config.js.map

import { defineConfig } from 'vite';
export default defineConfig({
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
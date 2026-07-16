import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api/overpass': {
                target: 'https://overpass-api.de',
                changeOrigin: true,
                secure: true,
                rewrite: function () { return '/api/interpreter'; },
            },
        },
    },
});

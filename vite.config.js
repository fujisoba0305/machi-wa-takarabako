import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api/overpass': {
                target: 'https://machi-wa-takarabako.vercel.app',
                changeOrigin: true,
                secure: true,
            },
            '/api/walking-distance': {
                target: 'https://machi-wa-takarabako.vercel.app',
                changeOrigin: true,
                secure: true,
            },
        },
    },
});

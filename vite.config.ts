import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { localApi } from './dev/localApi';
import { mobileHttps } from './dev/mobileHttps';

export default defineConfig(({ command }) => ({ plugins: [react(), localApi()], server: { port: 5173, strictPort: true, ...mobileHttps(command) } }));

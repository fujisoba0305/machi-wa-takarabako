import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { localApi } from './dev/localApi';
import { mobileHttps } from './dev/mobileHttps';
import { staticCompression } from './dev/staticCompression';

export default defineConfig(({ command }) => ({ test: { maxWorkers: 2 }, plugins: [react(), localApi(), staticCompression()], server: { port: 5173, strictPort: true, ...mobileHttps(command) } }));

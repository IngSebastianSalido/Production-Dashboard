import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: parseInt(process.env.VITE_PORT) || 4000,
    allowedHosts: ['fmm-c-023', 'FMM-C-023', 'localhost', '127.0.0.1', '192.168.74.55', '.local'],
    proxy: {
      '/api': {
        target: process.env.VITE_SERVER_API_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
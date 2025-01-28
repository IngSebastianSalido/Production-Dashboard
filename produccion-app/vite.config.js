import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  plugins: [react()],
  server: {
    host: process.env.VITE_HOST || 'localhost', // Default to 'localhost' if not set
    port: parseInt(process.env.VITE_PORT) || 4000, // Default to 4000 if not set
    proxy: {
      '/api': {
        target: process.env.VITE_SERVER_API_URL || 'http://localhost:3000', // Default to 'http://localhost:3000' if not set
        changeOrigin: true, // Change the origin to avoid CORS issues
      },
    },
  },
});
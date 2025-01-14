import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '192.168.68.165', // Dirección IP local de tu máquina
    port: 4000,             // Puerto del frontend
    proxy: {
      '/api': {
        target: 'http://192.168.68.165:3000', // URL del backend con HTTP
        changeOrigin: true, // Cambia el origen para evitar problemas de CORS
      },
    },
  },
});

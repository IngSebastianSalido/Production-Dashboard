import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Permite que otros dispositivos se conecten
    port: 4000, // Cambia el puerto si lo necesitas
  },
});

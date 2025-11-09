import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000', // Flask backend
        changeOrigin: true,
        secure: false,
      },
      '/convert-scad': {
        target: 'http://127.0.0.1:3001', // Node conversion service
        changeOrigin: true,
        secure: false,
      },
      '/files': {
        target: 'http://127.0.0.1:3001', // Static STL files from Node
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
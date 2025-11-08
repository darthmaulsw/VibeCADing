import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: true, // Listen on all addresses
    allowedHosts: [
      '.ngrok-free.app',
      '.ngrok-free.dev', // Allow all ngrok subdomains
      '.ngrok.io' // Allow legacy ngrok domains
    ],
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/api/v1': {
        target: 'https://unicepmerida.com',
        changeOrigin: true,
        secure: true,
        headers: {
          origin: 'https://unicepmerida.com',
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      devOptions: {
        enabled: false,
      },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'UNICEP Ecosistema Digital',
        short_name: 'UNICEP',
        description: 'Plataforma academica para alumnos, docentes y administrativos.',
        theme_color: '#0a6aa1',
        background_color: '#f5f7fb',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/favicon.svg',
            sizes: '48x46',
            type: 'image/svg+xml',
          },
          {
            src: '/favicon.svg',
            sizes: '48x46',
            type: 'image/svg+xml',
          },
        ],
      },
    }),
  ],
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const SERVER_PORT = process.env.RFWIZARD_SERVER_PORT ?? '8420';

// The React app talks to the RFWizard server over REST (/api) and a
// WebSocket (/ws). In dev, Vite proxies both to the Node server so the
// browser only ever sees one origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 5273,
    strictPort: false,
    proxy: {
      '/api': { target: `http://localhost:${SERVER_PORT}`, changeOrigin: true },
      '/ws': { target: `ws://localhost:${SERVER_PORT}`, ws: true },
    },
  },
  build: {
    outDir: 'dist',
  },
});

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const SERVER_PORT = process.env.RFUTILS_SERVER_PORT ?? '8420';

// The React app talks to the RFutils server over REST (/api) and a
// WebSocket (/ws). In dev, Vite proxies both to the Node server so the
// browser only ever sees one origin.
//
// The static build (`npm run build:static`) has no server at all: it runs the
// conversion and coordination code from @rfutils/shared in the browser. It is
// served from a subdirectory on GitHub Pages, hence the base path — override
// with RFUTILS_BASE when hosting somewhere else (use '/' for a domain root).
const isStatic = process.env.VITE_RFUTILS_STATIC === '1';
const base = process.env.RFUTILS_BASE ?? (isStatic ? '/RFutils/' : '/');

/**
 * Copy pdfjs's worker into the static build at a fixed path, so localApi can
 * point `GlobalWorkerOptions.workerSrc` at it. Deliberately not a `?url` import
 * in the source: that emits the 2.3 MB worker into the server build too, where
 * PDFs are converted server-side and the code that needs it is dead.
 */
function pdfWorkerPlugin(): Plugin {
  const require = createRequire(import.meta.url);
  return {
    name: 'rfutils-pdf-worker',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'pdf.worker.mjs',
        source: readFileSync(require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')),
      });
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), ...(isStatic ? [pdfWorkerPlugin()] : [])],
  server: {
    port: Number(process.env.PORT) || 5273,
    strictPort: false,
    proxy: {
      '/api': { target: `http://localhost:${SERVER_PORT}`, changeOrigin: true },
      '/ws': { target: `ws://localhost:${SERVER_PORT}`, ws: true },
    },
  },
  build: {
    outDir: isStatic ? 'dist-static' : 'dist',
  },
});

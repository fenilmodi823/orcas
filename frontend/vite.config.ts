import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  worker: {
    // satellite.js 7.x ships a WASM pthreads worker (dist/wasm/) that Vite's
    // static analysis reaches once anything imports satrecFromOmm/propagate
    // directly (not just through @orcas/scene). That worker's own generated
    // code uses a top-level `await import(...)`, which the default 'iife'
    // worker format can't represent — 'es' can, natively. ORCAS never calls
    // the WASM bulk-propagation API itself (brief Part 4.4, P4.D18 —
    // deferred), this only fixes the build being able to see the file.
    format: 'es',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    passWithNoTests: true,
  },
});

import { defineConfig } from 'vite';

// Build padrão: SPA estática (PWA) para hospedar em qualquer lugar.
// O build do Artifact (arquivo único) fica em scripts/build-artifact.mjs.
export default defineConfig({
  base: './',
  define: { __ARTIFACT__: 'false' },
  build: { target: 'es2022', outDir: 'dist', sourcemap: false },
  server: { host: true, port: 5173 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});

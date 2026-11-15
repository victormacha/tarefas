// Gera dist-artifact/hexa.html: um único arquivo no formato que o Artifact do
// claude.ai publica (sem <html>/<head>/<body>; React via cdnjs; todo o resto inline).
import { build } from 'vite';
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'dist-artifact');
const tmp = resolve(out, '.tmp');
rmSync(out, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

const REACT = '18.3.1';

await build({
  root,
  configFile: false,
  logLevel: 'warn',
  define: { __ARTIFACT__: 'true', 'process.env.NODE_ENV': '"production"' },
  resolve: {
    alias: {
      'react/jsx-runtime': resolve(root, 'src/jsx-shim.js'),
      'react/jsx-dev-runtime': resolve(root, 'src/jsx-shim.js'),
    },
  },
  build: {
    target: 'es2022',
    outDir: tmp,
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: { entry: resolve(root, 'src/main.tsx'), formats: ['iife'], name: 'Hexa', fileName: () => 'app.js', cssFileName: 'app' },
    rollupOptions: {
      external: ['react', 'react-dom', 'react-dom/client'],
      output: { globals: { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM' }, inlineDynamicImports: true },
    },
  },
});

const js = readFileSync(resolve(tmp, 'app.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
const css = readdirSync(tmp).filter((f) => f.endsWith('.css')).map((f) => readFileSync(resolve(tmp, f), 'utf8')).join('\n');

const html = `<title>Hexa</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=Onest:wght@400..700&family=JetBrains+Mono:wght@400..600&display=swap">
<style>
${css}
</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/${REACT}/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/${REACT}/umd/react-dom.production.min.js"></script>
<script>
${js}
</script>
`;
writeFileSync(resolve(out, 'hexa.html'), html);
rmSync(tmp, { recursive: true, force: true });
console.log(`dist-artifact/hexa.html  ${(html.length / 1024).toFixed(1)} kB`);

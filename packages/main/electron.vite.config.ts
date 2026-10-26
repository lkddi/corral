import { defineConfig } from 'electron-vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  main: {
    build: {
      lib: { entry: path.join(here, 'src/main.ts') },
      outDir: path.join(here, 'dist/main'),
    },
  },
  preload: {
    build: {
      lib: { entry: path.join(here, 'src/preload.ts') },
      outDir: path.join(here, 'dist/preload'),
    },
  },
  renderer: {
    root: path.join(here, '../renderer'),
    build: {
      outDir: path.join(here, 'dist/renderer'),
    },
  },
});

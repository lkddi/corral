/**
 * CLI 打包：esbuild bundle → 零运行时依赖单文件（Spec §4.1：不引 commander/yargs）
 * shared 包以源码入口经别名内联——CLI 产物只依赖随包 Node 内置模块。
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [path.join(here, 'src/index.ts')],
  outfile: path.join(here, 'dist/corral.js'),
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  minify: true,
  sourcemap: true,
  banner: { js: '#!/usr/bin/env node' },
  alias: {
    '@corral/shared': path.join(here, '../shared/src/index.ts'),
  },
});

console.log('[corral] CLI bundled → dist/corral.js');

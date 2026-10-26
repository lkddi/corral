/**
 * daemon 打包：esbuild bundle → dist/daemon/index.js（与 CLI 同纪律：零运行时 TS 依赖）
 * shared 以源码入口经别名内联；ws 保留为运行时依赖（纯 JS，按需懒加载——I1 未接入 WS 流通道）。
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [path.join(here, 'src/daemon/index.ts')],
  outfile: path.join(here, 'dist/daemon/index.js'),
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  minify: true,
  sourcemap: true,
  external: ['ws'],
  alias: {
    '@corral/shared': path.join(here, '../shared/src/index.ts'),
  },
});

console.log('[corral] daemon bundled → dist/daemon/index.js');

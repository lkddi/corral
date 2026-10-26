#!/usr/bin/env node
/**
 * R14 平台抽象铁律门禁（Spec §10/§12）：
 * 业务代码禁止裸 process.platform / os.platform 判断——
 * 唯一合法读取点 = packages/core/src/platform/{index,mac,win}.ts。
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SCAN_DIRS = ['packages'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'out', 'release']);
const PLATFORM_DIR = path.join('packages', 'core', 'src', 'platform');
const BARE_RE = /\b(process\.platform|os\.platform\s*\(\s*\))/;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (['.ts', '.tsx', '.mjs'].includes(path.extname(entry.name))) yield full;
  }
}

let hits = 0;
for (const dir of SCAN_DIRS) {
  for await (const file of walk(path.join(ROOT, dir))) {
    const rel = path.relative(ROOT, file);
    if (rel.startsWith(PLATFORM_DIR)) continue; // 平台实现自身豁免
    const content = await readFile(file, 'utf8');
    content.split('\n').forEach((line, i) => {
      if (BARE_RE.test(line) && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
        hits++;
        console.error(`PLATFORM LEAK ${rel}:${i + 1}: ${line.trim().slice(0, 100)}`);
      }
    });
  }
}

if (hits > 0) {
  console.error(`\n${hits} bare platform check(s) outside platform layer — R14 gate FAILED`);
  process.exit(1);
}
console.log('R14 platform abstraction scan: 0 leaks — gate PASSED');

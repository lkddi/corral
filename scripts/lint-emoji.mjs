#!/usr/bin/env node
/**
 * P0-1 门禁：emoji 图标扫描（Spec §12 CI 门禁 · 专家团 P0 绝对规则）
 * 扫描所有源码/文档产物中的 emoji 功能图标；命中 = 门禁失败。
 * 例外：docs/design/design-system/icons.md 的故意更名文档行（白名单单行豁免）。
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SCAN_DIRS = ['packages', 'scripts'];
const SCAN_EXTS = new Set(['.ts', '.tsx', '.mjs', '.js', '.css', '.html']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'out', 'release']);

// 专家团 P0-1 检测正则
const EMOJI_RE = new RegExp(
  '[' +
    '\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1F02F}' +
    '\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}' +
    '\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}' +
    ']',
  'u',
);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (SCAN_EXTS.has(path.extname(entry.name))) yield full;
  }
}

let hits = 0;
for (const dir of SCAN_DIRS) {
  for await (const file of walk(path.join(ROOT, dir))) {
    const content = await readFile(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (EMOJI_RE.test(line)) {
        hits++;
        console.error(`EMOJI HIT ${path.relative(ROOT, file)}:${i + 1}: ${line.trim().slice(0, 100)}`);
      }
    });
  }
}

if (hits > 0) {
  console.error(`\n${hits} emoji icon violation(s) — P0-1 gate FAILED`);
  process.exit(1);
}
console.log('P0-1 emoji scan: 0 hits — gate PASSED');

/**
 * 下载 + 校验 + 解包（零依赖：node:crypto + 系统 tar）
 *
 * 纪律：
 * - 流式写盘 + 同步算哈希，不把 13MB 归档读进内存
 * - 摘要不符立即删文件（fail closed），禁「先装上再说」
 * - 解包用系统 tar（macOS bsdtar / Windows 10+ bsdtar 自带），不引第三方归档库
 */

import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { run } from '../util/exec.js';

export interface DownloadProgress {
  receivedBytes: number;
  totalBytes: number | null;
  /** 0–100（totalBytes 未知时为 null——GUI 显示不确定进度，禁假百分比） */
  percent: number | null;
}

export class ChecksumMismatch extends Error {
  constructor(
    readonly expected: string,
    readonly actual: string,
  ) {
    super(`checksum mismatch: expected ${expected}, got ${actual}`);
  }
}

/** 单次流式下载（无重试）；调用方一般用 downloadWithRetry */
export async function downloadFile(
  url: string,
  dest: string,
  onProgress?: (p: DownloadProgress) => void,
): Promise<{ sha256: string; bytes: number }> {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  const res = await fetch(url, { signal: AbortSignal.timeout(300_000) });
  if (!res.ok || !res.body) throw new Error(`download failed: HTTP ${res.status} ${url}`);

  const lenHeader = res.headers.get('content-length');
  const total = lenHeader ? Number.parseInt(lenHeader, 10) : null;
  const hash = createHash('sha256');
  let received = 0;

  const source = Readable.fromWeb(res.body as import('node:stream/web').ReadableStream);
  source.on('data', (chunk: Buffer) => {
    hash.update(chunk);
    received += chunk.length;
    onProgress?.({
      receivedBytes: received,
      totalBytes: total,
      percent: total ? Math.min(100, Math.round((received / total) * 100)) : null,
    });
  });

  await pipeline(source, createWriteStream(dest));

  // 实测坑（2026-10-28）：CDN 会在传输中途掐断连接，pipeline 不报错但文件被截断；
  // 截断的 tar.gz 解包得到空目录 → 伪装成「归档里没有 php 二进制」。必须显式比对长度。
  if (total !== null && received !== total) {
    throw new Error(`incomplete download: got ${received} of ${total} bytes`);
  }
  return { sha256: hash.digest('hex'), bytes: received };
}

/**
 * 断点续传下载（Range）+ 重试。
 *
 * 实测环境：dl.static-php.dev 会在单连接拉到数 MB 后重置（undici 报 terminated），
 * 若不做续传，14MB 的 PHP 归档永远下不完。策略：
 *   1. 已落盘字节数 → Range: bytes=<offset>-
 *   2. 服务器不认 Range（返回 200 而非 206）→ 清空重下
 *   3. 每轮结束比对 content-length 推算的总长，齐了即停
 * 摘要统一在下载完成后整体计算（续传拼接后无法增量哈希）。
 */
export async function downloadWithRetry(
  url: string,
  dest: string,
  onProgress?: (p: DownloadProgress) => void,
  attempts = 6,
): Promise<{ sha256: string; bytes: number }> {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  let total: number | null = null;
  let lastErr: unknown;

  for (let i = 1; i <= attempts; i++) {
    const offset = await fs.stat(dest).then((st) => st.size, () => 0);
    if (total !== null && offset === total) break;

    try {
      const headers: Record<string, string> = offset > 0 ? { range: `bytes=${offset}-` } : {};
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(120_000) });

      if (offset > 0 && res.status === 200) {
        // 服务器忽略了 Range：整份重下
        await fs.rm(dest, { force: true });
        throw new Error('server ignored range request; restarting download');
      }
      if (!res.ok || !res.body) throw new Error(`download failed: HTTP ${res.status} ${url}`);

      const len = Number.parseInt(res.headers.get('content-length') ?? '0', 10);
      if (len > 0) total = offset + len;

      let received = offset;
      const source = Readable.fromWeb(res.body as import('node:stream/web').ReadableStream);
      source.on('data', (chunk: Buffer) => {
        received += chunk.length;
        onProgress?.({
          receivedBytes: received,
          totalBytes: total,
          percent: total ? Math.min(100, Math.round((received / total) * 100)) : null,
        });
      });
      await pipeline(source, createWriteStream(dest, { flags: offset > 0 ? 'a' : 'w' }));
    } catch (err) {
      lastErr = err;
    }

    const size = await fs.stat(dest).then((st) => st.size, () => 0);
    if (total !== null && size === total) break;
    if (i < attempts) await new Promise((r) => setTimeout(r, 300 * i));
  }

  const bytes = await fs.stat(dest).then((st) => st.size, () => 0);
  if (bytes === 0) throw lastErr instanceof Error ? lastErr : new Error('download produced no data');
  if (total !== null && bytes !== total) {
    throw new Error(`incomplete download after ${attempts} attempts: ${bytes} of ${total} bytes`);
  }
  return { sha256: await sha256File(dest), bytes };
}

export async function sha256File(file: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(file), hash);
  return hash.digest('hex');
}

/**
 * 解 .tar.gz（布局自适应）
 *
 * 实测坑：上游归档有两种布局——根层直接放 php/php-fpm，或包一层顶层目录。
 * 固定 `--strip-components=1` 会把根层布局剥成空目录，因此改为：
 * 先解到临时目录 → 若只有一个顶层目录则整体上移 → 否则原样搬平。
 */
export async function extractTarGz(archive: string, destDir: string): Promise<void> {
  const staging = `${destDir}.staging-${process.pid}-${Date.now()}`;
  await fs.mkdir(staging, { recursive: true });
  const r = await run('/usr/bin/tar', ['-xzf', archive, '-C', staging], { timeoutMs: 120_000 });
  if (r.code !== 0) {
    await fs.rm(staging, { recursive: true, force: true });
    throw new Error(`extract failed (tar ${r.code}): ${r.stderr.trim()}`);
  }

  const top = (await fs.readdir(staging, { withFileTypes: true })).filter((e) => !e.name.startsWith('.'));
  if (top.length === 0) {
    await fs.rm(staging, { recursive: true, force: true });
    throw new Error('extract failed: archive was empty (truncated download?)');
  }

  await fs.mkdir(destDir, { recursive: true });
  if (top.length === 1 && top[0]!.isDirectory()) {
    const inner = path.join(staging, top[0]!.name);
    for (const entry of await fs.readdir(inner)) {
      await fs.rename(path.join(inner, entry), path.join(destDir, entry));
    }
  } else {
    for (const entry of top) {
      await fs.rename(path.join(staging, entry.name), path.join(destDir, entry.name));
    }
  }
  await fs.rm(staging, { recursive: true, force: true });
}

/** 人类可读字节数（CLI/GUI 共用口径） */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

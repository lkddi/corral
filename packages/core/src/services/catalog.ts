/**
 * PHP catalog（版本目录通道，ADR-004）
 *
 * 三级来源：Network（实时）> Cache（24h 内）> Bundled（离线快照）。
 * 上游为 static-php-cli 官方分发（fpm 构建，含 Laravel 必需扩展），清单接口 ?format=json。
 *
 * 校验纪律：上游清单不含 checksum → catalog 支持可选 sha256 字段：
 *   - 有值：严格校验，不符即 CHECKSUM_MISMATCH（fail closed）
 *   - 无值：首次下载记 TOFU 摘要入库，重装时校验；输出明示 checksum='tofu'
 * 绝不假装「已校验」。
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { CorralConfig, CorralPaths } from '../config.js';

export type BuildArch = 'aarch64' | 'x86_64';
/** 上游按用途分开分发：cli（终端/artisan/composer）与 fpm（nginx 托管） */
export type BuildKind = 'cli' | 'fpm';

export interface PhpRelease {
  version: string;
  minor: string;
  arch: BuildArch;
  kind: BuildKind;
  url: string;
  sizeBytes: number | null;
  /** catalog 钉死摘要（上游目前不提供 → 通常为 null） */
  sha256?: string;
}

export type CatalogSource = 'network' | 'cache' | 'bundled';

export interface Catalog {
  releases: PhpRelease[];
  source: CatalogSource;
  fetchedAt: string;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const BASE_ROOT = 'https://dl.static-php.dev/static-php-cli';
const baseFor = (build: 'common' | 'bulk'): string => `${BASE_ROOT}/${build}`;

/** 离线快照（2026-10-28 实测 dl.static-php.dev 全量清单的每分钟最新补丁版） */
const SNAPSHOT: Array<[string, number, number]> = [
  ['8.0.30', 1, 7.8],
  ['8.1.34', 0, 12.9],
  ['8.2.32', 0, 13.0],
  ['8.3.32', 0, 13.1],
  ['8.4.23', 0, 13.8],
  ['8.5.8', 0, 14.4],
];

export function hostArch(): BuildArch {
  return process.arch === 'arm64' ? 'aarch64' : 'x86_64';
}

function fileNameFor(version: string, arch: BuildArch, kind: BuildKind): string {
  return `php-${version}-${kind}-macos-${arch}.tar.gz`;
}

function bundledReleases(build: 'common' | 'bulk' = 'common'): PhpRelease[] {
  const BASE = baseFor(build);
  const arch = hostArch();
  return SNAPSHOT.flatMap(([version, , mb]) =>
    (['cli', 'fpm'] as const).map((kind) => ({
      version,
      minor: version.split('.').slice(0, 2).join('.'),
      arch,
      kind,
      url: `${BASE}/${fileNameFor(version, arch, kind)}`,
      sizeBytes: Math.round(mb * 1024 * 1024),
    })),
  );
}

/** 解析上游清单（"13.8M" 之类的 size 字符串也接受） */
export function parseCatalogJson(raw: unknown, build: 'common' | 'bulk' = 'common'): PhpRelease[] {
  const BASE = baseFor(build);
  const files = (Array.isArray(raw) ? raw : (raw as { files?: unknown }).files) ?? [];
  if (!Array.isArray(files)) return [];
  const re = /^php-(\d+)\.(\d+)\.(\d+)-(cli|fpm)-macos-(aarch64|x86_64)\.tar\.gz$/;
  const out: PhpRelease[] = [];
  for (const item of files) {
    const name = String((item as { name?: unknown }).name ?? '');
    const m = re.exec(name);
    if (!m) continue;
    const [, maj, min, patch, kind, arch] = m;
    const version = `${maj}.${min}.${patch}`;
    out.push({
      version,
      minor: `${maj}.${min}`,
      arch: arch as BuildArch,
      kind: kind as BuildKind,
      url: `${BASE}/${name}`,
      sizeBytes: parseSize((item as { size?: unknown }).size),
    });
  }
  return out;
}

function parseSize(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return null;
  const m = /^([\d.]+)\s*([KMG])?B?$/i.exec(v.trim());
  if (!m) return null;
  const n = Number.parseFloat(m[1]!);
  const mult = m[2]?.toUpperCase() === 'G' ? 1024 ** 3 : m[2]?.toUpperCase() === 'M' ? 1024 ** 2 : m[2]?.toUpperCase() === 'K' ? 1024 : 1;
  return Math.round(n * mult);
}

/** 载入 catalog：缓存命中 → 网络 → 离线快照（必须永不空手，否则 php:list 无意义） */
export async function loadCatalog(paths: CorralPaths, cfg: CorralConfig): Promise<Catalog> {
  try {
    const raw = JSON.parse(await fs.readFile(paths.catalogCache, 'utf8')) as { fetchedAt: string; releases: PhpRelease[] };
    if (Date.now() - Date.parse(raw.fetchedAt) < CACHE_TTL_MS && raw.releases.length) {
      return { releases: raw.releases, source: 'cache', fetchedAt: raw.fetchedAt };
    }
  } catch {
    /* 无缓存 */
  }

  try {
    const res = await fetch(cfg.catalogUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const releases = parseCatalogJson(await res.json(), cfg.phpBuild);
    if (!releases.length) throw new Error('catalog contained no fpm builds');
    const fetchedAt = new Date().toISOString();
    await fs.mkdir(path.dirname(paths.catalogCache), { recursive: true });
    await fs.writeFile(paths.catalogCache, JSON.stringify({ fetchedAt, releases }, null, 2), 'utf8');
    return { releases, source: 'network', fetchedAt };
  } catch {
    // 断网降级：离线快照（README/Spec：无网络时已缓存版本全功能可用）
    return { releases: bundledReleases(cfg.phpBuild), source: 'bundled', fetchedAt: new Date(0).toISOString() };
  }
}

/**
 * 版本解析：'8.4' → 该次版本最新补丁；'8.4.23' → 精确；'8' → 该主版本最新。
 * 返回 null = 该版本在此平台不存在（调用方给 VERSION_NOT_INSTALLED + 可用列表提示）。
 */
export function resolveRelease(releases: PhpRelease[], requested: string, arch: BuildArch = hostArch()): PhpRelease | null {
  const v = requested.trim();
  if (!v) return null;
  const pool = releases.filter((r) => r.arch === arch && r.kind === 'fpm');
  if (/^\d+$/.test(v)) {
    const hits = pool.filter((r) => r.minor.startsWith(`${v}.`));
    return newest(hits);
  }
  if (/^\d+\.\d+$/.test(v)) {
    return newest(pool.filter((r) => r.minor === v));
  }
  return pool.find((r) => r.version === v) ?? null;
}

function newest(list: PhpRelease[]): PhpRelease | null {
  if (!list.length) return null;
  return [...list].sort((a, b) => compareVersions(b.version, a.version))[0]!;
}

/**
 * 一个版本需要两份制品才能「可用」：fpm（托管）+ cli（终端/artisan）。
 * 实测（2026-10-28）：上游 fpm 归档只含 php-fpm，不含 php CLI —— 只装 fpm 会让站点能跑但
 * `corral doctor` 的 php -r 自检与项目内 artisan 全失效。
 */
export function resolveArtifacts(
  releases: PhpRelease[],
  requested: string,
  arch: BuildArch = hostArch(),
): { version: string; artifacts: PhpRelease[] } | null {
  const base = resolveRelease(releases, requested, arch);
  if (!base) return null;
  const artifacts = releases.filter((r) => r.arch === arch && r.version === base.version);
  const fpm = artifacts.find((a) => a.kind === 'fpm');
  if (!fpm) return null;
  const cli = artifacts.find((a) => a.kind === 'cli');
  return { version: base.version, artifacts: cli ? [cli, fpm] : [fpm] };
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** 版本列表按次版本聚合（GUI PHP 视图分段控件 / CLI php:list 同一数据） */
export function groupByMinor(releases: PhpRelease[]): Array<{ minor: string; latest: string; releases: PhpRelease[] }> {
  const map = new Map<string, PhpRelease[]>();
  for (const r of releases) {
    if (r.kind !== 'fpm') continue;
    const list = map.get(r.minor) ?? [];
    list.push(r);
    map.set(r.minor, list);
  }
  return [...map.entries()]
    .sort((a, b) => compareVersions(b[0], a[0]))
    .map(([minor, list]) => {
      const sorted = [...list].sort((a, b) => compareVersions(b.version, a.version));
      return { minor, latest: sorted[0]!.version, releases: sorted };
    });
}

/**
 * PHP 版本管理（ADR-004 按需下载 + ADR-009 扩展集 + Spec §4.4）
 *
 * 生命周期：install(catalog 下载 → SHA256 → tar 解包 → 写 php.ini/php-fpm.conf → 记 state)
 *          → startFpm(每版本独立 socket + pid) → uninstall(先停 FPM 再删目录)
 *
 * 强制 pm=ondemand（不可行警告 2 的对策：静态 PHP 常驻进程会吃掉内存红线）。
 * 静态构建扩展集固定、不可 pecl —— `php:list` 必须回传实测扩展清单，README 公布。
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { CorralConfig, CorralPaths } from '../config.js';
import type { JsonStore } from '../daemon/state.js';
import { loadCatalog, resolveArtifacts, compareVersions, hostArch } from './catalog.js';
import { ChecksumMismatch, downloadWithRetry, extractTarGz, formatBytes, sha256File } from './download.js';
import { pidAlive, run, spawnDetached, waitFor } from '../util/exec.js';

export type ProgressFn = (msg: string, percent: number | null) => void;

export interface InstalledPhp {
  version: string;
  path: string;
  extensions: string[];
  checksum: 'pinned' | 'tofu';
}

export interface PhpListEntry {
  version: string;
  minor: string;
  installed: boolean;
  path: string | null;
  extensions: string[];
  fpmRunning: boolean;
  sizeBytes: number | null;
}

export class PhpManager {
  constructor(
    private readonly paths: CorralPaths,
    private readonly cfg: CorralConfig,
    private readonly store: JsonStore,
  ) {}

  versionDir(version: string): string {
    return path.join(this.paths.phpDir, version);
  }

  async resolveBin(version: string): Promise<string | null> {
    const dir = this.versionDir(version);
    for (const rel of ['php', 'bin/php', 'sbin/php']) {
      const p = path.join(dir, rel);
      try {
        await fs.access(p);
        return p;
      } catch {
        /* next */
      }
    }
    return null;
  }

  async resolveFpmBin(version: string): Promise<string | null> {
    const dir = this.versionDir(version);
    for (const rel of ['php-fpm', 'sbin/php-fpm', 'bin/php-fpm']) {
      const p = path.join(dir, rel);
      try {
        await fs.access(p);
        return p;
      } catch {
        /* next */
      }
    }
    return null;
  }

  socketPath(version: string): string {
    return path.join(this.paths.runtimeDir, `fpm-${version}.sock`);
  }

  private pidPath(version: string): string {
    return path.join(this.paths.runtimeDir, `fpm-${version}.pid`);
  }

  private iniPath(version: string): string {
    return path.join(this.versionDir(version), 'etc', 'php.ini');
  }

  private fpmConfPath(version: string): string {
    return path.join(this.versionDir(version), 'etc', 'php-fpm.conf');
  }

  async installedVersions(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.paths.phpDir, { withFileTypes: true });
      const out: string[] = [];
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        if (await this.resolveBin(e.name)) out.push(e.name);
      }
      return out.sort();
    } catch {
      return [];
    }
  }

  async isInstalled(version: string): Promise<boolean> {
    return (await this.resolveBin(version)) !== null;
  }

  /** php:list 数据源（installed + available 同源，GUI PHP 视图直接用） */
  async list(): Promise<{ entries: PhpListEntry[]; source: string }> {
    const catalog = await loadCatalog(this.paths, this.cfg);
    const installed = new Set(await this.installedVersions());
    const state = await this.store.read();
    const byVersion = new Map(state.phpVersions.map((v) => [v.version, v]));

    const seen = new Set<string>();
    const entries: PhpListEntry[] = [];
    const forArch = catalog.releases.filter((r) => r.arch === hostArch());
    for (const rel of [...forArch].sort((a, b) => compareVersions(b.version, a.version))) {
      if (seen.has(rel.version)) continue;
      seen.add(rel.version);
      entries.push({
        version: rel.version,
        minor: rel.minor,
        installed: installed.has(rel.version),
        path: installed.has(rel.version) ? this.versionDir(rel.version) : null,
        extensions: byVersion.get(rel.version)?.extensions ?? [],
        fpmRunning: await this.fpmRunning(rel.version),
        sizeBytes: rel.sizeBytes,
      });
    }
    // 本地已装但 catalog 已下架（离线/旧版）：仍要出现在列表里
    for (const v of installed) {
      if (seen.has(v)) continue;
      entries.unshift({
        version: v,
        minor: v.split('.').slice(0, 2).join('.'),
        installed: true,
        path: this.versionDir(v),
        extensions: byVersion.get(v)?.extensions ?? [],
        fpmRunning: await this.fpmRunning(v),
        sizeBytes: null,
      });
    }
    return { entries, source: catalog.source };
  }

  /**
   * 安装：`8.4` → catalog 该次版本最新补丁；`8.4.23` → 精确。
   * 一个版本 = 两份制品（cli + fpm），合并解到同一目录（实测坑：fpm 归档不含 php CLI）。
   * 返回 null 表示 catalog 无此版本（调用方给 VERSION_NOT_INSTALLED）。
   */
  async install(requested: string, onProgress?: ProgressFn): Promise<InstalledPhp | null> {
    const catalog = await loadCatalog(this.paths, this.cfg);
    const resolved = resolveArtifacts(catalog.releases, requested);
    if (!resolved) return null;
    const version = resolved.version;

    if (await this.isInstalled(version)) {
      const state = await this.store.read();
      const rec = state.phpVersions.find((v) => v.version === version);
      return { version, path: this.versionDir(version), extensions: rec?.extensions ?? [], checksum: 'pinned' };
    }

    await fs.mkdir(this.paths.runtimeDir, { recursive: true });
    const tmpDir = path.join(this.paths.runtimeDir, 'downloads');
    const dir = this.versionDir(version);
    const state = await this.store.read();
    const known = state.phpVersions.find((v) => v.version === version)?.sha256;

    let totalBytes = 0;
    let checksum: 'pinned' | 'tofu' = 'pinned';
    const digests: string[] = [];

    for (const [i, artifact] of resolved.artifacts.entries()) {
      const label = `${version} (${artifact.kind} ${i + 1}/${resolved.artifacts.length})`;
      onProgress?.(`downloading PHP ${label}${artifact.sizeBytes ? ` — ${formatBytes(artifact.sizeBytes)}` : ''}`, 0);
      const archive = path.join(tmpDir, path.basename(artifact.url));
      const dl = await downloadWithRetry(artifact.url, archive, (p) => onProgress?.(`downloading PHP ${label}`, p.percent));

      // 校验：catalog 钉死优先；无钉死值 → TOFU（记摘要，重装时比对）
      const expected = artifact.sha256 ?? (resolved.artifacts.length === 1 ? known : undefined);
      if (expected && expected !== dl.sha256) {
        await fs.rm(archive, { force: true });
        throw new ChecksumMismatch(expected, dl.sha256);
      }
      if (!artifact.sha256) checksum = 'tofu';

      onProgress?.(`extracting PHP ${label}`, null);
      await extractTarGz(archive, dir);
      await fs.rm(archive, { force: true });
      digests.push(dl.sha256);
      totalBytes += dl.bytes;
    }

    const bin = await this.resolveBin(version);
    if (!bin) throw new Error(`archive did not contain a php binary (${version}) — the download may be truncated or the catalog entry wrong`);
    await fs.chmod(bin, 0o755).catch(() => undefined);
    const fpm = await this.resolveFpmBin(version);
    if (fpm) await fs.chmod(fpm, 0o755).catch(() => undefined);

    await this.writeConfigs(version);
    const extensions = await this.readExtensions(version);

    await this.store.update((s) => {
      s.phpVersions = s.phpVersions.filter((v) => v.version !== version);
      s.phpVersions.push({
        version,
        path: dir,
        installedAt: new Date().toISOString(),
        extensions,
        sha256: digests.join('+'),
        checksumSource: checksum,
      });
    });
    onProgress?.(`PHP ${version} installed (${formatBytes(totalBytes)})`, 100);
    return { version, path: dir, extensions, checksum };
  }

  async uninstall(version: string): Promise<boolean> {
    if (!(await this.isInstalled(version))) return false;
    await this.stopFpm(version);
    await fs.rm(this.versionDir(version), { recursive: true, force: true });
    await this.store.update((s) => {
      s.phpVersions = s.phpVersions.filter((v) => v.version !== version);
    });
    return true;
  }

  /** php.ini + php-fpm.conf（ADR-009 扩展集为静态编译，ini 只调运行参数） */
  async writeConfigs(version: string): Promise<void> {
    const etc = path.dirname(this.iniPath(version));
    await fs.mkdir(etc, { recursive: true });
    await fs.mkdir(this.paths.logsDir, { recursive: true });
    await fs.mkdir(this.paths.runtimeDir, { recursive: true });

    const ini = [
      '; Corral-managed php.ini — regenerated on version install, edits are not preserved',
      '[PHP]',
      'memory_limit = 512M',
      'upload_max_filesize = 64M',
      'post_max_size = 64M',
      'max_execution_time = 60',
      'date.timezone = UTC',
      'display_errors = On',
      'error_reporting = E_ALL',
      'log_errors = On',
      `error_log = ${path.join(this.paths.logsDir, `php-${version}.error.log`)}`,
      '',
      '; Xdebug (built-in when the static build ships it); corral debug:on flips this at runtime',
      'xdebug.mode = off',
      'xdebug.start_with_request = yes',
      'xdebug.client_port = 9003',
      '',
    ].join('\n');
    await fs.writeFile(this.iniPath(version), ini, 'utf8');

    const fpmConf = [
      '; Corral-managed php-fpm.conf',
      '[global]',
      `pid = ${this.pidPath(version)}`,
      `error_log = ${path.join(this.paths.logsDir, `php-fpm-${version}.log`)}`,
      'daemonize = yes',
      '',
      '[www]',
      `listen = ${this.socketPath(version)}`,
      'listen.mode = 0666',
      '; Spec §4.4 强制：ondemand（静态 PHP 常驻会吃掉内存红线）',
      'pm = ondemand',
      'pm.max_children = 8',
      'pm.process_idle_timeout = 10s',
      'pm.max_requests = 500',
      'catch_workers_output = yes',
      `php_admin_value[error_log] = ${path.join(this.paths.logsDir, `php-${version}.error.log`)}`,
      'php_admin_flag[log_errors] = on',
      'clear_env = no',
      '',
    ].join('\n');
    await fs.writeFile(this.fpmConfPath(version), fpmConf, 'utf8');
  }

  async readExtensions(version: string): Promise<string[]> {
    const bin = await this.resolveBin(version);
    if (!bin) return [];
    const r = await run(bin, ['-n', '-m'], { timeoutMs: 15_000 });
    if (r.code !== 0) return [];
    return r.stdout
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('[') && l !== 'PHP Modules' && l !== 'Zend Modules')
      .slice(0, 200);
  }

  async fpmRunning(version: string): Promise<boolean> {
    try {
      const raw = await fs.readFile(this.pidPath(version), 'utf8');
      return pidAlive(Number.parseInt(raw.trim(), 10));
    } catch {
      return false;
    }
  }

  async startFpm(version: string): Promise<{ started: boolean; reason?: string }> {
    if (await this.fpmRunning(version)) return { started: true };
    const fpmBin = await this.resolveFpmBin(version);
    if (!fpmBin) return { started: false, reason: 'php-fpm binary missing in this build' };
    if (!(await fs.access(this.fpmConfPath(version)).then(() => true, () => false))) await this.writeConfigs(version);

    await fs.mkdir(this.paths.runtimeDir, { recursive: true });
    spawnDetached(fpmBin, ['-y', this.fpmConfPath(version), '-c', this.iniPath(version)], { cwd: this.versionDir(version) });

    const ok = await waitFor(async () => (await this.fpmRunning(version)) && (await fs.access(this.socketPath(version)).then(() => true, () => false)), 8_000);
    if (!ok) {
      const log = await fs.readFile(path.join(this.paths.logsDir, `php-fpm-${version}.log`), 'utf8').catch(() => '');
      return { started: false, reason: log.trim().split('\n').slice(-3).join(' | ') || 'fpm did not come up' };
    }
    return { started: true };
  }

  async stopFpm(version: string): Promise<boolean> {
    let pid = 0;
    try {
      pid = Number.parseInt((await fs.readFile(this.pidPath(version), 'utf8')).trim(), 10);
    } catch {
      return false;
    }
    if (!pidAlive(pid)) {
      await fs.rm(this.pidPath(version), { force: true });
      return false;
    }
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      return false;
    }
    await waitFor(async () => !pidAlive(pid), 5_000);
    await fs.rm(this.socketPath(version), { force: true });
    await fs.rm(this.pidPath(version), { force: true });
    return true;
  }

  /** 校验已装版本的落盘完整性（doctor 用） */
  async verify(version: string): Promise<{ ok: boolean; detail: string }> {
    const dir = this.versionDir(version);
    const bin = await this.resolveBin(version);
    if (!bin) return { ok: false, detail: `php binary missing under ${dir}` };
    const r = await run(bin, ['-n', '-r', 'echo PHP_VERSION;'], { timeoutMs: 10_000 });
    if (r.code !== 0) return { ok: false, detail: `php -r failed: ${r.stderr.trim()}` };
    const digest = await sha256File(path.join(dir, 'etc', 'php.ini')).catch(() => null);
    return { ok: true, detail: `PHP ${r.stdout.trim()} (${digest ? 'config ok' : 'config missing'})` };
  }
}

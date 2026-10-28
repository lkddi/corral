/**
 * 站点生命周期（link/unlink + 五态计算）
 *
 * 五态（Spec §5，CLI/GUI 同词表）：running / stopped / starting / error / missing
 * 计算口径全部来自真实探针（vhost 文件 + fpm pid + 目录存在性），禁读旧状态自欺。
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { CorralConfig, CorralPaths } from '../config.js';
import type { JsonStore, SiteRecord } from '../daemon/state.js';
import { NginxManager } from './nginx.js';
import { PhpManager } from './php.js';

export type SiteState = 'running' | 'stopped' | 'starting' | 'error' | 'missing';

export interface SiteView extends SiteRecord {
  state: SiteState;
  url: string;
  vhostPath: string;
}

const NAME_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export class SiteManager {
  constructor(
    private readonly paths: CorralPaths,
    private readonly cfg: CorralConfig,
    private readonly store: JsonStore,
    private readonly nginx: NginxManager,
    private readonly php: PhpManager,
  ) {}

  urlFor(name: string): string {
    return `http://${name}.${this.cfg.tld}`;
  }

  async list(): Promise<SiteView[]> {
    const state = await this.store.read();
    return Promise.all(state.sites.map((s) => this.view(s)));
  }

  async view(site: SiteRecord): Promise<SiteView> {
    return { ...site, state: await this.stateOf(site), url: this.urlFor(site.name), vhostPath: this.nginx.siteConfPath(site.name) };
  }

  private async stateOf(site: SiteRecord): Promise<SiteState> {
    const dirExists = await fs.access(site.path).then(() => true, () => false);
    if (!dirExists) return 'missing';
    const vhostExists = await fs.access(this.nginx.siteConfPath(site.name)).then(() => true, () => false);
    if (!site.enabled || !vhostExists) return 'stopped';
    const fpm = await this.php.fpmRunning(site.php);
    const ngx = (await this.nginx.running()).running;
    if (fpm && ngx) return 'running';
    if (!fpm) return 'error';
    return 'starting';
  }

  /** 找当前目录对应的站点（cwd 形命令族：unlink/isolate/secure 共用） */
  async findByPath(dir: string): Promise<SiteRecord | null> {
    const real = await fs.realpath(dir).catch(() => dir);
    const state = await this.store.read();
    for (const s of state.sites) {
      const sReal = await fs.realpath(s.path).catch(() => s.path);
      if (sReal === real) return s;
    }
    return null;
  }

  /** link：目录名 → 站点名；同名不同路径 → SITE_EXISTS（Spec §10 禁静默覆盖） */
  async link(input: { cwd: string; php?: string; port?: number }): Promise<
    | { ok: true; site: SiteView; created: boolean }
    | { ok: false; code: 'USAGE_ERROR' | 'SITE_EXISTS' | 'VERSION_NOT_INSTALLED' | 'CONFIG_INVALID'; message: string; hint: string }
  > {
    const realDir = await fs.realpath(input.cwd).catch(() => input.cwd);
    const name = path.basename(realDir).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '');
    if (!name || !NAME_RE.test(name)) {
      return { ok: false, code: 'USAGE_ERROR', message: `cannot derive a valid site name from "${path.basename(realDir)}"`, hint: 'Rename the directory to lowercase alphanumerics and hyphens' };
    }

    const state = await this.store.read();
    const existing = state.sites.find((s) => s.name === name);
    if (existing && existing.path !== realDir) {
      return { ok: false, code: 'SITE_EXISTS', message: `site "${name}" already points to ${existing.path}`, hint: `Run corral unlink in ${existing.path} first, or rename this directory` };
    }

    const requestedPhp = input.php ?? state.settings.globalPhp ?? this.cfg.defaultPhpMinor;
    const phpVersion = await this.ensurePhp(requestedPhp);
    if (!phpVersion) {
      const installed = await this.php.installedVersions();
      return {
        ok: false,
        code: 'VERSION_NOT_INSTALLED',
        message: `PHP ${requestedPhp} is not installed`,
        hint: installed.length ? `Installed: ${installed.join(', ')} — or run corral php:install ${requestedPhp}` : `Run corral php:install ${requestedPhp}`,
      };
    }

    const fpm = await this.php.startFpm(phpVersion);
    if (!fpm.started) {
      return { ok: false, code: 'CONFIG_INVALID', message: `PHP-FPM ${phpVersion} failed to start`, hint: `See ${path.join(this.paths.logsDir, `php-fpm-${phpVersion}.log`)} — ${fpm.reason ?? ''}`.trim() };
    }

    const record: SiteRecord = {
      name,
      path: realDir,
      php: phpVersion,
      port: input.port ?? this.cfg.httpPort,
      secure: false,
      enabled: true,
      status: 'starting',
      schemaVersion: 1,
    };
    await this.nginx.writeSite(record, this.php.socketPath(phpVersion));
    await this.store.update((s) => {
      s.sites = s.sites.filter((x) => x.name !== name);
      s.sites.push(record);
    });

    const reloaded = await this.nginx.reload();
    const started = reloaded ? { started: true } : await this.nginx.start();
    if ('started' in started && !started.started) {
      const owner = 'owner' in started ? started.owner : undefined;
      return {
        ok: false,
        code: 'CONFIG_INVALID',
        message: `site registered but nginx could not start: ${started.reason ?? 'unknown'}`,
        hint: owner ? `Port ${this.cfg.httpPort} is held by ${owner.command} (pid ${owner.pid})` : 'Run corral doctor',
      };
    }

    const site = await this.findByPath(realDir);
    return { ok: true, site: await this.view(site ?? record), created: !existing };
  }

  /** 解析 PHP 版本；未装则先尝试按需安装（ADR-004：用户选了版本就自动下载） */
  private async ensurePhp(requested: string): Promise<string | null> {
    if (await this.php.isInstalled(requested)) return requested;
    const installed = await this.php.installedVersions();
    const sameMinor = installed.find((v) => v.split('.').slice(0, 2).join('.') === requested);
    if (sameMinor) return sameMinor;
    const result = await this.php.install(requested);
    return result?.version ?? null;
  }

  async unlink(cwd: string): Promise<{ ok: true; site: SiteView } | { ok: false; code: 'SITE_NOT_FOUND'; message: string; hint: string }> {
    const site = await this.findByPath(cwd);
    if (!site) {
      return { ok: false, code: 'SITE_NOT_FOUND', message: `no site is linked to ${cwd}`, hint: 'Run corral status to see the linked sites' };
    }
    await this.nginx.removeSite(site.name);
    await this.store.update((s) => {
      s.sites = s.sites.filter((x) => x.name !== site.name);
    });
    await this.nginx.reload();
    // 该版本若无其他站点引用，停掉 FPM 释放内存（MVP 无引用计数表，按全量扫描判定）
    const state = await this.store.read();
    if (!state.sites.some((s) => s.php === site.php)) await this.php.stopFpm(site.php);
    return { ok: true, site: await this.view(site) };
  }

  /** 站点启停（start/stop [site]）：摘/挂 vhost + 持久化 enabled（R8） */
  async setEnabled(name: string, enabled: boolean): Promise<{ ok: true; site: SiteView } | { ok: false; code: 'SITE_NOT_FOUND'; message: string; hint: string }> {
    const state = await this.store.read();
    const site = state.sites.find((s) => s.name === name);
    if (!site) return { ok: false, code: 'SITE_NOT_FOUND', message: `site "${name}" not found`, hint: 'Run corral status to see the linked sites' };

    if (enabled) {
      await this.php.startFpm(site.php);
      await this.nginx.writeSite(site, this.php.socketPath(site.php));
    } else {
      await this.nginx.removeSite(site.name);
    }
    await this.store.update((s) => {
      const target = s.sites.find((x) => x.name === name);
      if (target) target.enabled = enabled;
    });
    await this.nginx.reload();
    const fresh = await this.store.read();
    return { ok: true, site: await this.view(fresh.sites.find((x) => x.name === name) ?? site) };
  }

  async setIsolate(name: string, version: string): Promise<{ ok: true; site: SiteView } | { ok: false; code: string; message: string; hint: string }> {
    const state = await this.store.read();
    const site = state.sites.find((s) => s.name === name);
    if (!site) return { ok: false, code: 'SITE_NOT_FOUND', message: `site "${name}" not found`, hint: 'Run corral status to see the linked sites' };
    const version2 = await this.ensurePhp(version);
    if (!version2) return { ok: false, code: 'VERSION_NOT_INSTALLED', message: `PHP ${version} is not installed`, hint: `Run corral php:install ${version}` };

    await this.php.startFpm(version2);
    await this.store.update((s) => {
      const t = s.sites.find((x) => x.name === name);
      if (t) t.php = version2;
    });
    await this.nginx.writeSite({ ...site, php: version2 }, this.php.socketPath(version2));
    await this.nginx.reload();
    const fresh = await this.store.read();
    return { ok: true, site: await this.view(fresh.sites.find((x) => x.name === name) ?? site) };
  }
}

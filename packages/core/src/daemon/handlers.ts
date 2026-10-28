/**
 * I1 命令处理器（CLI↔RPC 1:1，method = CommandSpec.id）
 *
 * 分层纪律：handler 只做「参数校验 → 调服务 → 封信封」，不含业务逻辑；
 * 业务在 services/，本文件不碰文件系统以外的实现细节。
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fail, findCommand, normalizeVersion, ok } from '@corral/shared';
import type { Daemon } from './index.js';
import type { CommandContext } from './index.js';
import { startStack, stopStack, type Services } from '../services/index.js';
import { runDoctor } from '../services/doctor.js';
import { compareVersions } from '../services/catalog.js';
import { ChecksumMismatch } from '../services/download.js';
import { run as sh } from '../util/exec.js';

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const num = (v: unknown): number | undefined => {
  const s = str(v);
  if (!s) return undefined;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : undefined;
};

export function registerHandlers(d: Daemon, svc: Services): void {
  const cwdOf = (ctx: CommandContext): string => str(ctx.args.cwd) ?? process.cwd();
  const wantsSideEffect = (ctx: CommandContext): boolean => !ctx.args.__json;

  // ── status ─────────────────────────────────────────────
  d.register(findCommand('status')!, async () => {
    const state = await svc.store.read();
    const [sites, dns, ngx] = await Promise.all([svc.sites.list(), svc.dns.status(), svc.nginx.running()]);
    return ok({
      globalPhp: state.settings.globalPhp,
      daemonRunning: true,
      stack: { nginxRunning: ngx.running, nginxPid: ngx.pid, httpPort: svc.cfg.httpPort, tld: svc.cfg.tld },
      dns: { configured: dns.configured, reason: dns.reason ?? null, hint: dns.hint ?? null },
      sites,
      php: { installed: await svc.php.installedVersions() },
      services: state.services,
    });
  });

  // ── php ────────────────────────────────────────────────
  d.register(findCommand('php:list')!, async () => {
    const { entries, source } = await svc.php.list();
    const latestByMinor = new Map<string, string>();
    for (const e of entries) {
      const cur = latestByMinor.get(e.minor);
      if (!cur || compareVersions(e.version, cur) > 0) latestByMinor.set(e.minor, e.version);
    }
    const state = await svc.store.read();
    return ok({
      installed: entries.filter((e) => e.installed).map((e) => e.version),
      available: [...latestByMinor.entries()].map(([minor, latest]) => ({ minor, latest })),
      entries,
      catalogSource: source,
      global: state.settings.globalPhp,
    });
  });

  d.register(findCommand('php:install')!, async (ctx) => {
    const v = str(ctx.args.v);
    if (!v) return fail('USAGE_ERROR', 'missing required argument <v>', 'Usage: corral php:install <v>');
    try {
      const r = await svc.php.install(v);
      if (!r) {
        const { entries } = await svc.php.list();
        const minors = [...new Set(entries.map((e) => e.minor))].reverse();
        return fail('VERSION_NOT_INSTALLED', `PHP ${v} is not available in the catalog`, `Available minors: ${minors.join(', ')}`);
      }
      return ok({ version: r.version, path: r.path, extensions: r.extensions, checksum: r.checksum });
    } catch (err) {
      if (err instanceof ChecksumMismatch) {
        return fail('CHECKSUM_MISMATCH', err.message, 'Retry the download; if it persists the catalog entry is wrong — please report it');
      }
      return fail('NETWORK_ERROR', err instanceof Error ? err.message : String(err), 'Check your connection, then retry corral php:install');
    }
  });

  d.register(findCommand('php:uninstall')!, async (ctx) => {
    const v = str(ctx.args.v);
    if (!v) return fail('USAGE_ERROR', 'missing required argument <v>', 'Usage: corral php:uninstall <v>');
    const removed = await svc.php.uninstall(v);
    if (!removed) return fail('VERSION_NOT_INSTALLED', `PHP ${v} is not installed`, 'Run corral php:list to see installed versions');
    return ok({ version: v, removed: true });
  });

  d.register(findCommand('use')!, async (ctx) => {
    const v = str(ctx.args.v);
    if (!v) return fail('USAGE_ERROR', 'missing required argument <v>', 'Usage: corral use <v> — see corral status for the current version');
    const installed = await svc.php.installedVersions();
    const version = normalizeVersion(v);
    const match = installed.find((x) => x === version) ?? installed.find((x) => x.startsWith(`${version}.`));
    if (!match) {
      return fail('VERSION_NOT_INSTALLED', `PHP ${version} is not installed`, installed.length ? `Installed: ${installed.join(', ')}` : `Run corral php:install ${version}`);
    }
    await svc.store.update((s) => {
      s.settings.globalPhp = match;
    });
    return ok({ globalPhp: match });
  });

  // ── sites（cwd 形动词族）────────────────────────────────
  d.register(findCommand('link')!, async (ctx) => {
    const php = str(ctx.args.php);
    const port = num(ctx.args.port);
    const r = await svc.sites.link({ cwd: cwdOf(ctx), ...(php ? { php } : {}), ...(port ? { port } : {}) });
    if (!r.ok) return fail(r.code, r.message, r.hint);
    const dns = await svc.dns.status();
    return ok({ site: r.site, created: r.created, url: r.site.url, dnsConfigured: dns.configured, dnsHint: dns.hint ?? null });
  });

  d.register(findCommand('unlink')!, async (ctx) => {
    const r = await svc.sites.unlink(cwdOf(ctx));
    if (!r.ok) return fail(r.code, r.message, r.hint);
    return ok({ site: r.site, unlinked: true });
  });

  d.register(findCommand('isolate')!, async (ctx) => {
    const v = str(ctx.args.v);
    if (!v) return fail('USAGE_ERROR', 'missing required argument <v>', 'Usage: corral isolate <v>');
    const site = await svc.sites.findByPath(cwdOf(ctx));
    if (!site) return fail('SITE_NOT_FOUND', `no site is linked to ${cwdOf(ctx)}`, 'Run corral link first');
    const r = await svc.sites.setIsolate(site.name, normalizeVersion(v));
    if (!r.ok) return fail(r.code as 'VERSION_NOT_INSTALLED', r.message, r.hint);
    return ok({ site: r.site });
  });

  d.register(findCommand('unisolate')!, async (ctx) => {
    const state = await svc.store.read();
    const site = await svc.sites.findByPath(cwdOf(ctx));
    if (!site) return fail('SITE_NOT_FOUND', `no site is linked to ${cwdOf(ctx)}`, 'Run corral link first');
    const r = await svc.sites.setIsolate(site.name, state.settings.globalPhp);
    if (!r.ok) return fail(r.code as 'VERSION_NOT_INSTALLED', r.message, r.hint);
    return ok({ site: r.site, globalPhp: state.settings.globalPhp });
  });

  // ── stack ──────────────────────────────────────────────
  d.register(findCommand('start')!, async (ctx) => {
    const site = str(ctx.args.site);
    if (site) {
      const r = await svc.sites.setEnabled(site, true);
      if (!r.ok) return fail(r.code, r.message, r.hint);
      return ok({ scope: 'site', site: r.site });
    }
    const r = await startStack(svc);
    if (r.conflict) {
      return fail('PORT_CONFLICT', `port ${r.conflict.port} is already in use by ${r.conflict.owner.command} (pid ${r.conflict.owner.pid})`, `Stop that process, or start corral with CORRAL_HTTP_PORT=<free port>`);
    }
    return ok({ scope: 'stack', nginx: r.nginx, fpm: r.fpm, dns: { configured: r.dns.configured, hint: r.dns.hint ?? null } });
  });

  d.register(findCommand('stop')!, async (ctx) => {
    const site = str(ctx.args.site);
    if (site) {
      const r = await svc.sites.setEnabled(site, false);
      if (!r.ok) return fail(r.code, r.message, r.hint);
      return ok({ scope: 'site', site: r.site });
    }
    const r = await stopStack(svc);
    return ok({ scope: 'stack', nginxStopped: r.nginx, fpmStopped: r.fpm });
  });

  d.register(findCommand('restart')!, async (ctx) => {
    const site = str(ctx.args.site);
    if (site) {
      // R8：daemon 侧原子——先摘 vhost 再挂回，中间不让 requests 落到半死状态
      const off = await svc.sites.setEnabled(site, false);
      if (!off.ok) return fail(off.code, off.message, off.hint);
      await svc.php.stopFpm(off.site.php);
      const on = await svc.sites.setEnabled(site, true);
      if (!on.ok) return fail(on.code, on.message, on.hint);
      return ok({ scope: 'site', site: on.site });
    }
    await stopStack(svc);
    const r = await startStack(svc);
    if (r.conflict) {
      return fail('PORT_CONFLICT', `port ${r.conflict.port} is already in use by ${r.conflict.owner.command} (pid ${r.conflict.owner.pid})`, 'Stop that process and retry corral restart');
    }
    return ok({ scope: 'stack', nginx: r.nginx, fpm: r.fpm });
  });

  // ── 副作用命令（R11：--json 只返数据）────────────────────
  d.register(findCommand('open')!, async (ctx) => {
    const site = str(ctx.args.site);
    if (!site) return fail('USAGE_ERROR', 'missing required argument <site>', 'Usage: corral open <site>');
    const state = await svc.store.read();
    const record = state.sites.find((s) => s.name === site);
    if (!record) return fail('SITE_NOT_FOUND', `site "${site}" not found`, 'Run corral status to see the linked sites');
    const url = `http://${record.name}.${svc.cfg.tld}`;
    if (wantsSideEffect(ctx)) await sh('/usr/bin/open', [url], { timeoutMs: 5_000 });
    return ok({ url, site, opened: wantsSideEffect(ctx) });
  });

  d.register(findCommand('edit')!, async (ctx) => {
    const site = str(ctx.args.site);
    const target = site ? svc.nginx.siteConfPath(site) : svc.paths.configFile;
    const exists = await fs.access(target).then(() => true, () => false);
    if (site && !exists) return fail('SITE_NOT_FOUND', `no vhost for site "${site}"`, 'Run corral status to see the linked sites');
    if (wantsSideEffect(ctx)) await sh('/usr/bin/open', ['-R', target], { timeoutMs: 5_000 });
    return ok({ site: site ?? null, configDir: site ? path.dirname(target) : svc.paths.dataDir, path: target, revealed: wantsSideEffect(ctx) });
  });

  // ── logs（I1 先做静态 tail；WS 流通道随 Console 落地，R10）──
  d.register(findCommand('logs')!, async (ctx) => {
    const lines = num(ctx.args.lines) ?? 50;
    const site = str(ctx.args.site);
    const state = await svc.store.read();
    const version = site ? state.sites.find((s) => s.name === site)?.php : state.settings.globalPhp;
    if (site && !version) return fail('SITE_NOT_FOUND', `site "${site}" not found`, 'Run corral status to see the linked sites');
    const files = [path.join(svc.paths.logsDir, 'nginx-error.log'), path.join(svc.paths.logsDir, `php-${version ?? ''}.error.log`)];
    const out: Array<{ file: string; lines: string[] }> = [];
    for (const f of files) {
      const content = await fs.readFile(f, 'utf8').catch(() => '');
      out.push({ file: f, lines: content.trim() ? content.trim().split('\n').slice(-lines) : [] });
    }
    return ok({ site: site ?? null, streams: out });
  });

  // ── doctor ─────────────────────────────────────────────
  d.register(findCommand('doctor')!, async () => {
    const r = await runDoctor(svc);
    return ok({ healthy: r.healthy, checks: r.checks });
  });
}

/**
 * doctor 自检（Spec §9 / §12：装完即过自检，错误必须带可执行指引）
 *
 * 每项检查都是真实探针（不是读缓存配置），失败项必须给 hint。
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Services } from './index.js';
import { portOwner } from './nginx.js';

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
  hint?: string;
}

/** ADR-009 硬需求（Laravel 框架必需）与开发默认集 */
const LARAVEL_REQUIRED = ['ctype', 'curl', 'dom', 'fileinfo', 'filter', 'hash', 'mbstring', 'openssl', 'pcre', 'pdo', 'session', 'tokenizer', 'xml'];
const LARAVEL_DEV = ['zip', 'bcmath', 'intl', 'gd', 'pdo_mysql', 'pdo_pgsql', 'sqlite3', 'redis', 'xdebug'];

/** 扩展缺口检查：硬需求缺失 = 站点跑不起来（fail）；开发集缺失 = 降级提示（仍 pass） */
export function extensionGaps(extensions: string[]): { missingRequired: string[]; missingDev: string[] } {
  const set = new Set(extensions.map((e) => e.toLowerCase()));
  return {
    missingRequired: LARAVEL_REQUIRED.filter((e) => !set.has(e)),
    missingDev: LARAVEL_DEV.filter((e) => !set.has(e)),
  };
}

export async function runDoctor(svc: Services): Promise<{ checks: DoctorCheck[]; healthy: boolean }> {
  const checks: DoctorCheck[] = [];

  // 1. 数据目录可写
  try {
    const probe = path.join(svc.paths.dataDir, '.doctor-probe');
    await fs.writeFile(probe, 'ok', 'utf8');
    await fs.rm(probe, { force: true });
    checks.push({ name: 'data-dir', ok: true, detail: svc.paths.dataDir });
  } catch (err) {
    checks.push({ name: 'data-dir', ok: false, detail: String(err), hint: `Ensure ${svc.paths.dataDir} is writable` });
  }

  // 2. nginx 二进制
  const nginxBin = await svc.nginx.resolveBin();
  checks.push(
    nginxBin
      ? { name: 'nginx-binary', ok: true, detail: nginxBin }
      : { name: 'nginx-binary', ok: false, detail: 'not found', hint: 'Set CORRAL_NGINX_BIN to an nginx binary, or install via the app bundle' },
  );

  // 3. nginx 配置可解析
  if (nginxBin) {
    await svc.nginx.renderMain();
    const t = await svc.nginx.test();
    checks.push({ name: 'nginx-config', ok: t.ok, detail: t.ok ? 'syntax ok' : t.output.slice(0, 400), ...(t.ok ? {} : { hint: `Inspect ${svc.paths.nginxConf}` }) });
  }

  // 4. HTTP 端口
  const owner = await portOwner(svc.cfg.httpPort);
  const self = await svc.nginx.running();
  const selfBin = nginxBin ? path.basename(nginxBin) : '';
  // lsof -Fc 只回 9 字符命令名（nginx-arm64 → nginx-arm），按前缀判定是否自家 worker
  const ownedBySelf = self.running && !!owner && !!selfBin && selfBin.startsWith(owner.command);
  if (!owner) checks.push({ name: `port-${svc.cfg.httpPort}`, ok: true, detail: 'free' });
  else if (ownedBySelf) checks.push({ name: `port-${svc.cfg.httpPort}`, ok: true, detail: `held by corral nginx (master ${self.pid})` });
  else checks.push({ name: `port-${svc.cfg.httpPort}`, ok: false, detail: `${owner.command} (pid ${owner.pid})`, hint: `Stop that process, or run corral with CORRAL_HTTP_PORT=<other port>` });

  // 5. DNS 通配
  const dns = await svc.dns.status();
  checks.push({
    name: `dns-.${svc.cfg.tld}`,
    ok: dns.configured,
    detail: dns.configured ? `${dns.resolverPath} → 127.0.0.1` : (dns.reason ?? 'not configured'),
    ...(dns.configured ? {} : { hint: dns.hint ?? 'Run corral start' }),
  });

  // 6. 已装 PHP 可用性
  const installed = await svc.php.installedVersions();
  const stateForPhp = await svc.store.read();
  if (!installed.length) {
    checks.push({ name: 'php-installed', ok: false, detail: 'none', hint: `Run corral php:install ${svc.cfg.defaultPhpMinor}` });
  } else {
    for (const v of installed) {
      const r = await svc.php.verify(v);
      checks.push({ name: `php-${v}`, ok: r.ok, detail: r.detail, ...(r.ok ? {} : { hint: `Reinstall: corral php:uninstall ${v} && corral php:install ${v}` }) });

      // ADR-009 扩展集核对（静态构建扩展集固定，缺了只能换构建变体，pecl 不可用）
      const exts = stateForPhp.phpVersions.find((p) => p.version === v)?.extensions ?? (await svc.php.readExtensions(v));
      const gaps = extensionGaps(exts);
      checks.push({
        name: `php-ext-${v}`,
        ok: gaps.missingRequired.length === 0,
        detail: gaps.missingDev.length ? `missing dev defaults: ${gaps.missingDev.join(', ')}` : 'Laravel extension set complete',
        ...(gaps.missingRequired.length
          ? { hint: `Missing REQUIRED extensions: ${gaps.missingRequired.join(', ')} — switch build variant (config.phpBuild = bulk) or ship a custom build` }
          : gaps.missingDev.length
            ? { hint: `Dev defaults missing (${gaps.missingDev.join(', ')}): static builds cannot use pecl — set phpBuild=bulk or ship a custom build` }
            : {}),
      });
    }
  }

  // 7. 站点五态汇总（error/missing 必须暴露，Spec §9 边界）
  const sites = await svc.sites.list();
  const broken = sites.filter((s) => s.state === 'error' || s.state === 'missing');
  checks.push({
    name: 'sites',
    ok: broken.length === 0,
    detail: `${sites.length} linked, ${broken.length} need attention`,
    ...(broken.length ? { hint: broken.map((s) => `${s.name}: ${s.state}`).join('; ') } : {}),
  });

  // 8. .env 建议（服务未装则不展示假值，Spec §7 纪律）
  const state = await svc.store.read();
  const envLines = state.services
    .filter((s) => s.status === 'running')
    .map((s) => (s.name === 'mysql' ? `DB_CONNECTION=mysql\nDB_HOST=127.0.0.1\nDB_PORT=${s.port}` : `REDIS_HOST=127.0.0.1\nREDIS_PORT=${s.port}`));
  checks.push({ name: 'env-suggestions', ok: true, detail: envLines.length ? envLines.join('\n') : 'no services running (MySQL/Redis are I3)' });

  return { checks, healthy: checks.every((c) => c.ok) };
}

/**
 * 服务族装配（daemon 内唯一实例化点）
 *
 * 纪律：服务之间不互相 new，由本工厂统一注入——保证 paths/config 单实例，
 * 也保证 handler 层只拿到接口、拿不到构造细节。
 */

import { loadConfig, corralPaths, type CorralConfig, type CorralPaths } from '../config.js';
import type { PlatformAdapter } from '../platform/types.js';
import { detectPlatform } from '../platform/index.js';
import type { JsonStore } from '../daemon/state.js';
import { NginxManager, portOwner, type PortOwner } from './nginx.js';
import { PhpManager } from './php.js';
import { SiteManager } from './sites.js';
import { DnsManager, type DnsReport } from './dns.js';

export interface Services {
  dataDir: string;
  paths: CorralPaths;
  cfg: CorralConfig;
  store: JsonStore;
  platform: PlatformAdapter;
  nginx: NginxManager;
  php: PhpManager;
  sites: SiteManager;
  dns: DnsManager;
}

export async function createServices(dataDir: string, store: JsonStore): Promise<Services> {
  const paths = corralPaths(dataDir);
  const cfg = await loadConfig(paths);
  const nginx = new NginxManager(paths, cfg);
  const php = new PhpManager(paths, cfg, store);
  return {
    dataDir,
    paths,
    cfg,
    store,
    platform: detectPlatform(),
    nginx,
    php,
    sites: new SiteManager(paths, cfg, store, nginx, php),
    dns: new DnsManager(paths, cfg),
  };
}

export interface StackStartResult {
  nginx: 'started' | 'already-running';
  fpm: Array<{ version: string; started: boolean; reason?: string }>;
  dns: DnsReport;
  conflict?: { port: number; owner: PortOwner };
}

/** 整栈启动（`corral start` 无参 = 本函数）：DNS 探测 → nginx → 各启用站点的 FPM */
export async function startStack(svc: Services): Promise<StackStartResult> {
  const state = await svc.store.read();
  const dns = await svc.dns.ensure();

  const fpm: StackStartResult['fpm'] = [];
  for (const site of state.sites.filter((s) => s.enabled)) {
    const r = await svc.php.startFpm(site.php);
    fpm.push({ version: site.php, started: r.started, ...(r.reason ? { reason: r.reason } : {}) });
  }

  const wasRunning = (await svc.nginx.running()).running;
  const started = await svc.nginx.start();
  if (!started.started && started.code === 'PORT_CONFLICT' && started.owner) {
    return { nginx: wasRunning ? 'already-running' : 'started', fpm, dns, conflict: { port: svc.cfg.httpPort, owner: started.owner } };
  }

  return { nginx: wasRunning ? 'already-running' : started.started ? 'started' : 'already-running', fpm, dns };
}

/** 整栈停止：先摘站点（让 in-flight 请求自然结束），再停 nginx，最后停 FPM */
export async function stopStack(svc: Services): Promise<{ nginx: boolean; fpm: string[] }> {
  const nginxStopped = await svc.nginx.stop();
  const state = await svc.store.read();
  const stopped: string[] = [];
  for (const version of new Set(state.sites.map((s) => s.php))) {
    if (await svc.php.stopFpm(version)) stopped.push(version);
  }
  return { nginx: nginxStopped, fpm: stopped };
}

export { portOwner };

/**
 * daemon 配置（唯一配置源在 daemon 侧，GUI 本地偏好不进此处——R10 数据层边界）
 *
 * 覆盖优先级：env > config.json > 默认值。
 * env 覆盖是开发/测试对称性的一部分（CI 与本地可以跑两套独立栈，不抢端口）。
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface CorralConfig {
  /** 通配域名后缀（macOS: /etc/resolver/<tld>） */
  tld: string;
  /** 本机监听端口（80 需提权；开发默认经 env 覆盖为非特权端口） */
  httpPort: number;
  httpsPort: number;
  /** nginx 二进制（空 = 自动探测：config → PATH → 随包 runtime/nginx） */
  nginxBin?: string;
  /** dnsmasq 二进制（空 = 自动探测；未装则 DNS 层降级为「已生成配置未接管」） */
  dnsmasqBin?: string;
  /** PHP catalog 通道（与 app 更新解耦，ADR-001） */
  catalogUrl: string;
  /** 默认随装的 PHP 次版本（ADR-004：8.1–8.4） */
  defaultPhpMinor: string;
  /**
   * 静态构建变体（上游按扩展集分档）：
   * - common：默认档，体积小；实测缺 intl / xdebug（ADR-009 的必需项）
   * - bulk  ：扩展更全，体积更大；待 I2 用真实归档验证扩展清单后决定是否设为默认
   */
  phpBuild: 'common' | 'bulk';
}

export const CATALOG_URL = 'https://dl.static-php.dev/static-php-cli/common/?format=json';

const DEFAULTS: CorralConfig = {
  tld: 'test',
  httpPort: 80,
  httpsPort: 443,
  catalogUrl: CATALOG_URL,
  defaultPhpMinor: '8.4',
  phpBuild: 'common',
};

/** daemon 数据目录全部派生路径（单一来源，服务层不得自行拼） */
export interface CorralPaths {
  dataDir: string;
  configFile: string;
  stateFile: string;
  logsDir: string;
  runtimeDir: string;
  phpDir: string;
  nginxDir: string;
  nginxConf: string;
  sitesConfDir: string;
  certsDir: string;
  catalogCache: string;
  dnsDir: string;
}

export function corralPaths(dataDir: string): CorralPaths {
  return {
    dataDir,
    configFile: path.join(dataDir, 'config.json'),
    stateFile: path.join(dataDir, 'state.json'),
    logsDir: path.join(dataDir, 'logs'),
    runtimeDir: path.join(dataDir, 'runtime'),
    phpDir: path.join(dataDir, 'php'),
    nginxDir: path.join(dataDir, 'nginx'),
    nginxConf: path.join(dataDir, 'nginx', 'nginx.conf'),
    sitesConfDir: path.join(dataDir, 'nginx', 'sites'),
    certsDir: path.join(dataDir, 'certs'),
    catalogCache: path.join(dataDir, 'catalog-cache.json'),
    dnsDir: path.join(dataDir, 'dns'),
  };
}

function envInt(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** 读配置：env > config.json > 默认值（配置文件不存在则用默认值，不自动写盘） */
export async function loadConfig(paths: CorralPaths): Promise<CorralConfig> {
  let fileCfg: Partial<CorralConfig> = {};
  try {
    fileCfg = JSON.parse(await fs.readFile(paths.configFile, 'utf8')) as Partial<CorralConfig>;
  } catch {
    /* 无配置文件 = 全默认 */
  }
  const cfg: CorralConfig = { ...DEFAULTS, ...fileCfg };
  if (process.env.CORRAL_TLD) cfg.tld = process.env.CORRAL_TLD;
  const http = envInt('CORRAL_HTTP_PORT');
  const https = envInt('CORRAL_HTTPS_PORT');
  if (http !== undefined) cfg.httpPort = http;
  if (https !== undefined) cfg.httpsPort = https;
  if (process.env.CORRAL_NGINX_BIN) cfg.nginxBin = process.env.CORRAL_NGINX_BIN;
  if (process.env.CORRAL_DNSMASQ_BIN) cfg.dnsmasqBin = process.env.CORRAL_DNSMASQ_BIN;
  return cfg;
}

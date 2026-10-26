/**
 * CLI/GUI 同词表类型（权威：Spec §5.1/§5.2 · consistency-check §3）
 * 站点五态与服务五态独立词表；CLI 与 GUI 消费同一组字符串。
 */

export const SITE_STATUSES = ['running', 'stopped', 'starting', 'error', 'missing'] as const;
export type SiteStatus = (typeof SITE_STATUSES)[number];

export const SERVICE_STATUSES = ['running', 'stopped', 'starting', 'error', 'not-installed'] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export type ServiceName = 'mysql' | 'redis';

export interface Site {
  name: string;
  path: string;
  php: string;
  port: number;
  secure: boolean;
  enabled: boolean;
  status: SiteStatus;
}

export interface PhpVersion {
  version: string;
  installed: boolean;
  isDefault: boolean;
  path?: string;
  extensions?: string[];
}

export interface Service {
  name: ServiceName;
  version?: string;
  status: ServiceStatus;
  port: number;
  pid?: number;
  dataDir?: string;
  env?: Record<string, string>;
}

export interface StatusData {
  globalPhp: string;
  daemonRunning: boolean;
  sites: Site[];
  services: Service[];
}

/**
 * Windows 平台接口桩（v1.1 启用冻结设计，ADR-003 Amendment · R14）
 *
 * 设计已冻结（不重新设计，只实现）：
 * - DNS：hosts 精确条目 + SYSTEM helper（NSSM 注册，白名单：写 hosts + 装证书）——无通配符，已知不对称
 * - TLS：helper 写 LocalMachine\Root（需管理员）
 * - 进程模型：无 php-fpm，php-cgi.exe 进程池自写（每版本独占 FastCGI 端口）
 * - 提权：helper 安装 + CA 信任（一次性，不可避免）
 *
 * v1.0 所有方法抛 NOT_IMPLEMENTED——保证 v1.1 补 Windows = 填桩 + 复用全部上层。
 */

import type { DnsSetup, PlatformAdapter, TrustResult } from './types.js';

export class WinPlatformStub implements PlatformAdapter {
  readonly id = 'win' as const;

  private notImplemented(): never {
    throw new Error(
      'Windows support is deferred to v1.1 (frozen design — ADR-003 Amendment). ' +
        'This stub exists for the platform abstraction contract; do not call in v1.0.',
    );
  }

  appDataDir(): string {
    this.notImplemented();
  }

  logDir(): string {
    this.notImplemented();
  }

  setupDns(_setup: DnsSetup): Promise<void> {
    this.notImplemented();
  }

  restoreDns(): Promise<void> {
    this.notImplemented();
  }

  trustCertificateAuthority(_certPath: string): Promise<TrustResult> {
    this.notImplemented();
  }

  removeTrustedCertificateAuthority(_certPath: string): Promise<void> {
    this.notImplemented();
  }

  ensurePrivileges(_reason: string): Promise<boolean> {
    this.notImplemented();
  }

  enableLoginItem(): Promise<void> {
    this.notImplemented();
  }

  disableLoginItem(): Promise<void> {
    this.notImplemented();
  }

  serviceUnitPath(_serviceName: string): string {
    this.notImplemented();
  }

  quitOnWindowAllClosed(): boolean {
    this.notImplemented();
  }
}

/**
 * 平台抽象层（R14 平台抽象铁律 · Spec §10）
 *
 * 纪律：所有平台差异必须实现本接口；业务代码禁止裸 process.platform 判断
 * （CI lint:platform 守护，见 scripts/lint-platform.mjs）。
 * v1.0 仅实现 macOS；Windows 为接口桩（v1.1 启用冻结设计，ADR-003 Amendment）。
 */

export interface DnsSetup {
  /** 通配符域名（.test） */
  domain: string;
  /** dnsmasq 监听地址 */
  listen: string;
  /** 上游 DNS */
  upstream: string[];
}

export interface TrustResult {
  trusted: boolean;
  /** 被拒绝时的人工操作指引 */
  manualSteps?: string[];
}

export interface PlatformAdapter {
  readonly id: 'mac' | 'win';

  // ── 路径 ────────────────────────────────────────────────
  appDataDir(): string;
  logDir(): string;

  // ── DNS（ADR-003）───────────────────────────────────────
  /** macOS: /etc/resolver + dnsmasq 通配；Windows(v1.1): hosts 精确条目 + helper */
  setupDns(setup: DnsSetup): Promise<void>;
  restoreDns(): Promise<void>;

  // ── TLS（ADR-005）───────────────────────────────────────
  /** macOS: security add-trusted-cert (System keychain)；Windows(v1.1): helper 写 LocalMachine\Root */
  trustCertificateAuthority(certPath: string): Promise<TrustResult>;
  removeTrustedCertificateAuthority(certPath: string): Promise<void>;

  // ── 提权 ────────────────────────────────────────────────
  /** macOS: 首次 CA 信任 + launchd 特权端口；Windows(v1.1): helper 安装（一次性，不可避免） */
  ensurePrivileges(reason: string): Promise<boolean>;

  // ── 登录自启 ────────────────────────────────────────────
  /** daemon 登录自启（自装登录项，不依赖壳插件） */
  enableLoginItem(): Promise<void>;
  disableLoginItem(): Promise<void>;

  // ── 服务托管辅助 ────────────────────────────────────────
  /** macOS: launchd plist 路径生成；Windows(v1.1): NSSM（helper 白名单制） */
  serviceUnitPath(serviceName: string): string;

  /** 关窗是否退出 app：macOS = false（daemon 常驻，托盘重开）；Windows(v1.1) = true */
  quitOnWindowAllClosed(): boolean;
}

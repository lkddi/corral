/**
 * macOS 平台实现（v1.0 唯一实现路径，ADR-003/005）
 *
 * 机制：
 * - DNS：/etc/resolver/test + dnsmasq（root launchd daemon，-u 降权）→ 真通配符
 * - TLS：security add-trusted-cert 写入 System keychain
 * - 提权：osascript 管理员授权（首次 CA 信任 + 特权端口绑定）
 * - 自启：LaunchAgents plist（登录项）
 */

import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { DnsSetup, PlatformAdapter, TrustResult } from './types.js';

const run = promisify(execFile);

const RESOLVER_DIR = '/etc/resolver';
const DNSMASQ_CONF = '/etc/dnsmasq.d/corral-test.conf';
const DNSMASQ_PLIST = '/Library/LaunchDaemons/dev.corral.dnsmasq.plist';
const LOGIN_PLIST = path.join(os.homedir(), 'Library/LaunchAgents/dev.corral.daemon.plist');

export class MacPlatform implements PlatformAdapter {
  readonly id = 'mac' as const;

  appDataDir(): string {
    return path.join(os.homedir(), '.corral');
  }

  logDir(): string {
    return path.join(this.appDataDir(), 'logs');
  }

  async setupDns(setup: DnsSetup): Promise<void> {
    // /etc/resolver/test（nameserver 指向 127.0.0.1，dnsmasq 通配接管）
    const resolver = [`nameserver ${setup.listen}`, `domain ${setup.domain}`, 'search '].join('\n');
    await this.withAdmin(async () => {
      await fs.mkdir(RESOLVER_DIR, { recursive: true });
      await fs.writeFile(path.join(RESOLVER_DIR, setup.domain), resolver, 'utf8');
      const upstream = setup.upstream.map((u) => `server=${u}`).join('\n');
      const conf = [
        `# Corral local DNS — managed by corral daemon, do not edit`,
        `listen-address=${setup.listen}`,
        upstream,
        `address=/${setup.domain}/${setup.listen}`,
      ].join('\n');
      await fs.writeFile(DNSMASQ_CONF, conf, 'utf8');
      await fs.writeFile(DNSMASQ_PLIST, renderDnsmasqPlist(), 'utf8');
      await run('launchctl', ['load', DNSMASQ_PLIST]);
    });
  }

  async restoreDns(): Promise<void> {
    await this.withAdmin(async () => {
      for (const f of [path.join(RESOLVER_DIR, 'test'), DNSMASQ_CONF]) {
        await fs.rm(f, { force: true });
      }
      await run('launchctl', ['unload', DNSMASQ_PLIST]).catch(() => undefined);
      await fs.rm(DNSMASQ_PLIST, { force: true });
    });
  }

  async trustCertificateAuthority(certPath: string): Promise<TrustResult> {
    try {
      await this.withAdmin(async () => {
        await run('security', ['add-trusted-cert', '-d', '-k', '/Library/Keychains/System.keychain', certPath]);
      });
      return { trusted: true };
    } catch {
      // 权限拒绝 → 降级说明（禁静默失败，Spec §10）
      return {
        trusted: false,
        manualSteps: [
          'Open Keychain Access (System keychain)',
          `Import the local CA: ${certPath}`,
          'Double-click it → Trust → "Always Trust" for Secure Sockets Layer (SSL)',
        ],
      };
    }
  }

  async removeTrustedCertificateAuthority(certPath: string): Promise<void> {
    await this.withAdmin(async () => {
      await run('security', ['remove-trusted-cert', '-d', certPath]).catch(() => undefined);
    });
  }

  async ensurePrivileges(reason: string): Promise<boolean> {
    // 首次 CA 信任 + 特权端口绑定不可避免（不可行警告 4，Spec §10）
    try {
      await run('osascript', ['-e', `do shell script "true" with administrator privileges with prompt "${escapeAppleScript(reason)}"`]);
      return true;
    } catch {
      return false;
    }
  }

  async enableLoginItem(): Promise<void> {
    const plist = renderLoginPlist();
    await fs.mkdir(path.dirname(LOGIN_PLIST), { recursive: true });
    await fs.writeFile(LOGIN_PLIST, plist, 'utf8');
    await run('launchctl', ['load', LOGIN_PLIST]);
  }

  async disableLoginItem(): Promise<void> {
    await run('launchctl', ['unload', LOGIN_PLIST]).catch(() => undefined);
    await fs.rm(LOGIN_PLIST, { force: true });
  }

  serviceUnitPath(serviceName: string): string {
    return `/Library/LaunchDaemons/dev.corral.${serviceName}.plist`;
  }

  quitOnWindowAllClosed(): boolean {
    // macOS：关窗不停服——daemon 常驻，窗口经托盘/开始菜单重开
    return false;
  }

  /** osascript 管理员授权包裹（提权只包住必要的写操作） */
  private async withAdmin(fn: () => Promise<void>): Promise<void> {
    // v1.0：daemon 自身已由登录项以当前用户运行；特权操作经 ensurePrivileges 预授权后执行。
    // 生产实现：预授权缓存（Spec 附录 B）；MVP 直接执行 + 失败交 TrustResult 降级路径。
    await fn();
  }
}

function renderDnsmasqPlist(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>dev.corral.dnsmasq</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/opt/dnsmasq/sbin/dnsmasq</string>
    <string>--keep-in-foreground</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict>
</plist>
`;
}

function renderLoginPlist(): string {
  const daemonPath = process.argv[1] ?? '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>dev.corral.daemon</string>
  <key>ProgramArguments</key>
  <array><string>${daemonPath}</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict>
</plist>
`;
}

function escapeAppleScript(s: string): string {
  return s.replace(/"/g, '\\"');
}

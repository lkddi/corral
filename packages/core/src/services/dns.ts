/**
 * 本地 DNS（ADR-003 macOS 路径）
 *
 * 机制：/etc/resolver/<tld> 把该后缀全部查询指向 127.0.0.1 → dnsmasq 通配应答 → 真通配符。
 * 提权边界：写 /etc/resolver 与 launchd 加载必须 root。daemon 自身非 root 运行，
 * 因此本模块分两段：
 *   1) plan/status —— 纯读取 + 生成配置（无提权，随时可跑，doctor 用）
 *   2) ensure       —— 经平台适配器提权落地（失败返回可执行的人工步骤，禁静默失败）
 * 若本机已有其他工具（Herd/Valet）接管同后缀，status 会如实报告「已被接管」，不覆盖。
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { CorralConfig, CorralPaths } from '../config.js';
import { run, which } from '../util/exec.js';

export interface DnsReport {
  configured: boolean;
  tld: string;
  resolverPath: string;
  /** /etc/resolver/<tld> 是否存在 */
  resolverPresent: boolean;
  /** 该 resolver 是否指向 127.0.0.1 */
  pointsToLoopback: boolean;
  dnsmasqBin: string | null;
  /** 已生成的配置副本（审计用，daemon 数据目录内） */
  planPath: string;
  reason?: string;
  hint?: string;
  manualSteps?: string[];
}

export class DnsManager {
  constructor(
    private readonly paths: CorralPaths,
    private readonly cfg: CorralConfig,
  ) {}

  private get resolverPath(): string {
    return `/etc/resolver/${this.cfg.tld}`;
  }

  /** 生成两份配置（写 daemon 数据目录，可审计；不触碰系统） */
  async plan(): Promise<{ resolver: string; dnsmasq: string; planPath: string }> {
    await fs.mkdir(this.paths.dnsDir, { recursive: true });
    const resolver = [`# Corral local DNS for .${this.cfg.tld}`, 'nameserver 127.0.0.1', `domain ${this.cfg.tld}`, ''].join('\n');
    const dnsmasq = [
      `# Corral dnsmasq for .${this.cfg.tld} — managed by the corral daemon`,
      'listen-address=127.0.0.1',
      'bind-interfaces',
      `address=/.${this.cfg.tld}/127.0.0.1`,
      '',
    ].join('\n');
    const resolverFile = path.join(this.paths.dnsDir, `resolver-${this.cfg.tld}`);
    const dnsmasqFile = path.join(this.paths.dnsDir, `dnsmasq-${this.cfg.tld}.conf`);
    await fs.writeFile(resolverFile, resolver, 'utf8');
    await fs.writeFile(dnsmasqFile, dnsmasq, 'utf8');
    return { resolver, dnsmasq, planPath: this.paths.dnsDir };
  }

  async resolveDnsmasqBin(): Promise<string | null> {
    if (this.cfg.dnsmasqBin) {
      return (await fs.access(this.cfg.dnsmasqBin).then(() => true, () => false)) ? this.cfg.dnsmasqBin : null;
    }
    const onPath = await which('dnsmasq');
    if (onPath) return onPath;
    const bundled = path.join(this.paths.runtimeDir, 'dnsmasq', 'sbin', 'dnsmasq');
    return (await fs.access(bundled).then(() => true, () => false)) ? bundled : null;
  }

  async status(): Promise<DnsReport> {
    const plan = await this.plan();
    const bin = await this.resolveDnsmasqBin();
    let resolverContent = '';
    try {
      resolverContent = await fs.readFile(this.resolverPath, 'utf8');
    } catch {
      /* 未配置 */
    }
    const resolverPresent = resolverContent.length > 0;
    const pointsToLoopback = /nameserver\s+127\.0\.0\.1/.test(resolverContent);
    const configured = resolverPresent && pointsToLoopback && bin !== null;

    let reason: string | undefined;
    let hint: string | undefined;
    if (!resolverPresent) {
      reason = 'resolver-not-configured';
      hint = `Run corral start to install /etc/resolver/${this.cfg.tld} (one-time admin prompt)`;
    } else if (!pointsToLoopback) {
      reason = 'resolver-points-elsewhere';
      hint = `${this.resolverPath} exists but does not point at 127.0.0.1 — another tool may own .${this.cfg.tld}`;
    } else if (!bin) {
      reason = 'dnsmasq-binary-missing';
      hint = 'dnsmasq ships with the corral app bundle; set CORRAL_DNSMASQ_BIN for a local build';
    }

    return {
      configured,
      tld: this.cfg.tld,
      resolverPath: this.resolverPath,
      resolverPresent,
      pointsToLoopback,
      dnsmasqBin: bin,
      planPath: plan.planPath,
      ...(reason ? { reason } : {}),
      ...(hint ? { hint } : {}),
      ...(configured ? {} : { manualSteps: this.manualSteps(bin !== null) }),
    };
  }

  /**
   * 落地 DNS。daemon 非 root → 只能在「已预授权」或「用户已手工装好 resolver」时成功。
   * 返回的 report 就是真话：没接管成功就说没成功，禁止假装 configured。
   */
  async ensure(): Promise<DnsReport> {
    const before = await this.status();
    if (before.configured) return before;

    const bin = before.dnsmasqBin;
    if (bin) {
      // dnsmasq 若已在跑（可能由 Herd/Valet 拉起），先确认它能服务我们的后缀——避免抢跑冲突
      const probe = await run('/usr/bin/dig', ['+short', '+time=1', '+tries=1', `probe.${this.cfg.tld}`, '@127.0.0.1'], { timeoutMs: 3_000 });
      if (probe.code !== 0 || !probe.stdout.trim()) {
        await run(bin, ['--conf-file=' + path.join(this.paths.dnsDir, `dnsmasq-${this.cfg.tld}.conf`)], { timeoutMs: 3_000 });
      }
    }
    return this.status();
  }

  private manualSteps(hasDnsmasq: boolean): string[] {
    const steps = [
      `echo "nameserver 127.0.0.1" | sudo tee /etc/resolver/${this.cfg.tld}`,
    ];
    if (!hasDnsmasq) steps.unshift('Install dnsmasq (brew install dnsmasq) or use the app bundle copy');
    steps.push(`Make sure dnsmasq answers .${this.cfg.tld} on 127.0.0.1:53`);
    steps.push(`Verify: dig +short anything.${this.cfg.tld}`);
    return steps;
  }
}

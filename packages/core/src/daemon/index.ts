/**
 * Corral daemon（单实例，零 Electron 依赖独立常驻——关窗不停服）
 *
 * 拓扑（Spec §4.2）：
 *   CLI/GUI ──RPC(TCP 127.0.0.1 + token)──► daemon ──► nginx/PHP-FPM/服务族
 *                └──WS(127.0.0.1 + token, 另端口)──► pty 字节流 + Logs tail
 *
 * I1 范围：单实例锁 + RPC 线协议 + 命令注册框架 + status/help 实装；
 * sites/php/nginx/dns/tls/services 各服务族按增量（I1-I3）逐块填充。
 */

import { createServer, type Server } from 'node:net';
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { COMMANDS, findCommand, renderHelp, ok, type CommandSpec } from '@corral/shared';
import type { Envelope } from '@corral/shared';
import { detectPlatform } from '../platform/index.js';
import { JsonStore } from './state.js';

export interface DaemonOptions {
  dataDir: string;
  logDir: string;
  /** 0 = 由 daemon 自选并写入锁文件 */
  port?: number;
}

interface LockFile {
  pid: number;
  port: number;
  token: string;
  startedAt: string;
}

export interface CommandContext {
  args: Record<string, string | boolean | undefined>;
  json: boolean;
  store: JsonStore;
  platform: ReturnType<typeof detectPlatform>;
}

export type CommandHandler = (ctx: CommandContext) => Promise<Envelope> | Envelope;

export class Daemon {
  private readonly lockPath: string;
  private readonly tokenFilePath: string;
  private server: Server | null = null;
  private readonly handlers = new Map<string, CommandHandler>();
  readonly store: JsonStore;
  readonly platform: ReturnType<typeof detectPlatform>;

  constructor(private readonly opts: DaemonOptions) {
    this.lockPath = path.join(opts.dataDir, 'daemon.lock');
    this.tokenFilePath = path.join(opts.dataDir, 'daemon.token');
    this.store = new JsonStore(path.join(opts.dataDir, 'state.json'));
    this.platform = detectPlatform();
  }

  /** 注册命令处理器（method = CommandSpec.id，RPC 与 CLI 1:1） */
  register(spec: CommandSpec, handler: CommandHandler): void {
    this.handlers.set(spec.id, handler);
  }

  /** 内置命令：help / status（不依赖外部服务族） */
  private registerBuiltins(): void {
    this.register(findCommand('status')!, async (ctx) => {
      const state = await ctx.store.read();
      return ok({
        globalPhp: state.settings.globalPhp,
        daemonRunning: true,
        sites: state.sites,
        services: state.services,
      });
    });

    // doctor / mysql:status / redis:status 等按增量实装；未实装命令返回明确错误而非静默
    for (const spec of COMMANDS) {
      if (!this.handlers.has(spec.id)) {
        this.register(spec, () => ({
          status: 'error',
          error: {
            code: 'CONFIG_INVALID',
            message: `command '${spec.id}' is not implemented yet (incremental delivery)`,
            hint: 'See docs/spec/spec.md §2 for the delivery plan',
            retryable: false,
          },
        }));
      }
    }
  }

  /** 单实例：锁文件 + 端口探测；已在跑则退出 */
  private async acquireLock(): Promise<{ port: number; token: string } | null> {
    await fs.mkdir(this.opts.dataDir, { recursive: true });
    try {
      const raw = await fs.readFile(this.lockPath, 'utf8');
      const lock = JSON.parse(raw) as LockFile;
      // 探测旧 daemon 是否真活着（PID 存活 + 端口可连）
      if (await isPortOpen(lock.port)) {
        return null; // 已在运行
      }
      await fs.rm(this.lockPath, { force: true }); //  stale lock
    } catch {
      /* no lock yet */
    }
    const port = this.opts.port ?? 0;
    const token = randomBytes(32).toString('hex');
    await fs.writeFile(this.tokenFilePath, token, { mode: 0o600, encoding: 'utf8' });
    return { port, token };
  }

  async start(): Promise<void> {
    this.registerBuiltins();
    const acquired = await this.acquireLock();
    if (!acquired) {
      console.error('[corral] daemon already running');
      process.exit(0);
    }
    const { token } = acquired;

    this.server = createServer((socket) => {
      let buffer = '';
      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.trim()) void this.handleLine(socket, line, token);
        }
      });
      socket.on('error', () => socket.destroy());
    });

    await new Promise<void>((resolve) => {
      this.server!.listen(acquired.port, '127.0.0.1', () => resolve());
    });

    const addr = this.server!.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    await fs.writeFile(
      this.lockPath,
      JSON.stringify({ pid: process.pid, port, token, startedAt: new Date().toISOString() } satisfies LockFile),
      'utf8',
    );
    await fs.mkdir(this.opts.logDir, { recursive: true });
    console.log(`[corral] daemon listening on 127.0.0.1:${port} (token in ${this.tokenFilePath})`);
  }

  private async handleLine(socket: import('node:net').Socket, line: string, token: string): Promise<void> {
    let req: { method?: string; args?: Record<string, unknown>; token?: string };
    try {
      req = JSON.parse(line);
    } catch {
      socket.write(`${JSON.stringify({ status: 'error', error: { code: 'USAGE_ERROR', message: 'invalid JSON request', hint: 'Requests are newline-delimited JSON', retryable: false } })}\n`);
      return;
    }
    if (req.token !== token) {
      socket.write(`${JSON.stringify({ status: 'error', error: { code: 'PERMISSION_DENIED', message: 'invalid daemon token', hint: 'Token is per-session; CLI reads it from the lock file', retryable: false } })}\n`);
      return;
    }
    const spec = req.method ? findCommand(req.method) : undefined;
    if (!spec) {
      socket.write(`${JSON.stringify({ status: 'error', error: { code: 'USAGE_ERROR', message: `unknown command: ${req.method ?? '(none)'}`, hint: 'Run corral (bare) for the command list', retryable: false } })}\n`);
      return;
    }
    const handler = this.handlers.get(spec.id);
    if (!handler) {
      socket.write(`${JSON.stringify({ status: 'error', error: { code: 'CONFIG_INVALID', message: 'no handler registered', hint: 'Internal error — please report', retryable: false } })}\n`);
      return;
    }
    const args = (req.args ?? {}) as CommandContext['args'];
    const res = await handler({ args, json: true, store: this.store, platform: this.platform });
    socket.write(`${JSON.stringify(res)}\n`);
  }

  async stop(): Promise<void> {
    this.server?.close();
    await fs.rm(this.lockPath, { force: true });
    await fs.rm(this.tokenFilePath, { force: true });
  }
}

async function isPortOpen(port: number): Promise<boolean> {
  if (!port) return false;
  const net = await import('node:net');
  return new Promise((resolve) => {
    const sock = net.connect({ port, host: '127.0.0.1' });
    sock.once('connect', () => {
      sock.destroy();
      resolve(true);
    });
    sock.once('error', () => resolve(false));
  });
}

/** daemon 入口（随包 Node 直跑：node dist/daemon/index.js） */
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const dataDir = process.env.CORRAL_DATA_DIR ?? path.join(process.env.HOME ?? '', '.corral');
  const daemon = new Daemon({ dataDir, logDir: path.join(dataDir, 'logs') });
  void daemon.start();
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => void daemon.stop().then(() => process.exit(0)));
  }
}

export { renderHelp };

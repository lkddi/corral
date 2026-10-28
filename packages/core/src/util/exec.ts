/**
 * 子进程与 liveness 工具（零依赖：直接用 node:child_process）
 *
 * 纪律：所有外部命令经此进入，超时必设，失败必带 stderr（禁静默吞错）。
 */

import { execFile, spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** 执行并等待（非 0 退出码不抛，交调用方判定） */
export async function run(
  cmd: string,
  args: string[] = [],
  opts: { cwd?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv } = {},
): Promise<RunResult> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      cwd: opts.cwd,
      timeout: opts.timeoutMs ?? 20_000,
      env: opts.env ?? process.env,
      maxBuffer: 8 * 1024 * 1024,
    });
    return { code: 0, stdout: String(stdout), stderr: String(stderr) };
  } catch (err) {
    const e = err as { code?: number | string; stdout?: string; stderr?: string; message?: string };
    return {
      code: typeof e.code === 'number' ? e.code : 1,
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? e.message ?? String(err),
    };
  }
}

/** 分离启动（daemon 化进程：不随父进程退出） */
export function spawnDetached(cmd: string, args: string[], opts: { cwd?: string } = {}): ChildProcess {
  const child = spawn(cmd, args, {
    cwd: opts.cwd,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  return child;
}

/** PATH 查找（macOS/Linux；Windows v1.1 走 where.exe，平台抽象层补） */
export async function which(bin: string): Promise<string | null> {
  const r = await run('/usr/bin/which', [bin], { timeoutMs: 5_000 });
  const out = r.stdout.trim();
  return r.code === 0 && out ? out.split('\n')[0]! : null;
}

export function pidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** 端口是否已被监听（0.0.0.0 / 127.0.0.1 都算） */
export async function isPortInUse(port: number): Promise<boolean> {
  const net = await import('node:net');
  return new Promise((resolve) => {
    const sock = net.connect({ port, host: '127.0.0.1' });
    const done = (v: boolean) => {
      sock.destroy();
      resolve(v);
    };
    sock.once('connect', () => done(true));
    sock.once('error', () => done(false));
    sock.setTimeout(800, () => done(false));
  });
}

/** 等条件成立（socket 出现 / 端口可连），超时返回 false */
export async function waitFor(check: () => Promise<boolean>, timeoutMs: number, intervalMs = 100): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

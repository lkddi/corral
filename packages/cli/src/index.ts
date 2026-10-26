/**
 * Corral CLI（随包 Node + esbuild 零依赖 JS，即用即退）
 *
 * 契约（consistency-check §3 · Spec §5.1）：
 * - 统一信封输出（--json）；交互模式人类可读
 * - R11：OS 级副作用命令（open/edit）在 --json 下只返目标数据、不执行副作用（daemon 侧执行）
 * - R12 无参语义三类：整栈动作（start/stop）/ 帮助（裸 corral）/ 用法错误（open、use）
 * - 冷启动 <250ms：懒连接（仅 help/usage 错误不连 daemon）、零运行时依赖、禁 require node-pty/ws
 */

import { connect, type Socket } from 'node:net';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { COMMANDS, findCommand, renderHelp, normalizeVersion } from '@corral/shared';
import type { CommandSpec, Envelope } from '@corral/shared';

interface ParsedArgs {
  command: string | null;
  positionals: string[];
  flags: Record<string, string | boolean>;
  json: boolean;
}

export function parseArgv(argv: string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  let command: string | null = null;
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i]!;
    if (tok === '--json') {
      json = true;
    } else if (tok.startsWith('--')) {
      const eq = tok.indexOf('=');
      if (eq !== -1) {
        flags[tok.slice(2, eq)] = tok.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next && !next.startsWith('--')) {
          flags[tok.slice(2)] = next;
          i++;
        } else {
          flags[tok.slice(2)] = true;
        }
      }
    } else if (command === null) {
      command = tok;
    } else {
      positionals.push(tok);
    }
  }
  return { command, positionals, flags, json };
}

/** 本地用法校验（不连 daemon，省冷启动预算） */
function validateUsage(spec: CommandSpec, parsed: ParsedArgs): string | null {
  for (const [flagName] of Object.entries(parsed.flags)) {
    if (flagName === 'json') continue;
    const known = spec.flags.some((f) => f.name === flagName);
    if (!known) return `unknown option --${flagName} for '${spec.id}'`;
  }
  let posIdx = 0;
  for (const arg of spec.args) {
    const value = parsed.positionals[posIdx];
    if (arg.required && value === undefined) return `missing required argument <${arg.name}>`;
    if (value !== undefined) posIdx++;
  }
  if (parsed.positionals.length > posIdx) return `too many arguments for '${spec.id}'`;
  return null;
}

interface DaemonEndpoint {
  port: number;
  token: string;
}

function corralDataDir(): string {
  // 与 daemon 对称：env 覆盖（测试/多开），默认 ~/.corral
  return process.env.CORRAL_DATA_DIR ?? path.join(os.homedir(), '.corral');
}

async function discoverDaemon(): Promise<DaemonEndpoint | null> {
  const dataDir = corralDataDir();
  const lockPath = path.join(dataDir, 'daemon.lock');
  try {
    const lock = JSON.parse(await fs.readFile(lockPath, 'utf8')) as DaemonEndpoint;
    const token = await fs.readFile(path.join(dataDir, 'daemon.token'), 'utf8');
    return { port: lock.port, token: token.trim() };
  } catch {
    return null;
  }
}

function rpcCall(endpoint: DaemonEndpoint, method: string, args: Record<string, unknown>): Promise<Envelope<never>> {
  return new Promise((resolve, reject) => {
    const sock: Socket = connect({ port: endpoint.port, host: '127.0.0.1' }, () => {
      sock.write(`${JSON.stringify({ method, args, token: endpoint.token })}\n`);
    });
    let buffer = '';
    sock.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const idx = buffer.indexOf('\n');
      if (idx !== -1) {
        sock.destroy();
        try {
          resolve(JSON.parse(buffer.slice(0, idx)) as Envelope<never>);
        } catch (e) {
          reject(e);
        }
      }
    });
    sock.on('error', reject);
  });
}

function renderHuman(envelope: Envelope<never>, spec: CommandSpec | undefined): string {
  if (envelope.status === 'error') {
    const err = envelope.error!;
    return `error: ${err.message}\n  hint: ${err.hint}`;
  }
  if (spec?.id === 'status') {
    const d = envelope.data as unknown as { globalPhp: string; sites: Array<{ name: string; status: string; php: string }>; services: Array<{ name: string; status: string; port: number }> };
    const lines = [`Global PHP: ${d.globalPhp}`, '', 'Sites:'];
    lines.push(d.sites.length ? d.sites.map((s) => `  ${s.name.padEnd(24)} ${s.status.padEnd(10)} php ${s.php}`).join('\n') : '  (none — run corral link in a project directory)');
    lines.push('', 'Services:');
    lines.push(d.services.map((s) => `  ${s.name.padEnd(24)} ${s.status.padEnd(16)} :${s.port}`).join('\n'));
    return lines.join('\n');
  }
  return JSON.stringify(envelope.data ?? {}, null, 2);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const parsed = parseArgv(argv);

  // 裸 corral = 帮助（R12，不连 daemon）
  if (parsed.command === null) {
    process.stdout.write(renderHelp() + '\n');
    return;
  }

  const spec = findCommand(parsed.command);
  if (!spec) {
    const env: Envelope<never> = {
      status: 'error',
      error: { code: 'USAGE_ERROR', message: `unknown command: ${parsed.command}`, hint: 'Run corral (bare) for the command list', retryable: false },
    };
    if (parsed.json) process.stdout.write(JSON.stringify(env) + '\n');
    else process.stderr.write(renderHuman(env, undefined) + '\n');
    process.exitCode = 2;
    return;
  }

  // 无参语义（R12）
  if (spec.args.some((a) => a.required) && spec.args.every((a) => a.required) && parsed.positionals.length === 0) {
    if (spec.noArgBehavior === 'usage-error') {
      const env: Envelope<never> = {
        status: 'error',
        error: { code: 'USAGE_ERROR', message: `missing required argument for '${spec.id}'`, hint: `Usage: ${spec.usage}`, retryable: false },
      };
      if (parsed.json) process.stdout.write(JSON.stringify(env) + '\n');
      else process.stderr.write(renderHuman(env, spec) + '\n');
      process.exitCode = 2;
      return;
    }
  }

  const usageError = validateUsage(spec, parsed);
  if (usageError) {
    const env: Envelope<never> = {
      status: 'error',
      error: { code: 'USAGE_ERROR', message: usageError, hint: `Usage: ${spec.usage}`, retryable: false },
    };
    if (parsed.json) process.stdout.write(JSON.stringify(env) + '\n');
    else process.stderr.write(renderHuman(env, spec) + '\n');
    process.exitCode = 2;
    return;
  }

  // 组装 daemon 参数（版本参数单一归一化，R12）
  const args: Record<string, unknown> = { ...parsed.flags };
  spec.args.forEach((arg, i) => {
    const value = parsed.positionals[i];
    if (value !== undefined) {
      args[arg.name] = arg.version ? normalizeVersion(value) : value;
    }
  });
  if (parsed.json) args.__json = true;

  const endpoint = await discoverDaemon();
  if (!endpoint) {
    const env: Envelope<never> = {
      status: 'error',
      error: { code: 'DAEMON_NOT_RUNNING', message: 'corral daemon is not running', hint: 'It restarts automatically at login. Run corral doctor if this persists.', retryable: true },
    };
    if (parsed.json) process.stdout.write(JSON.stringify(env) + '\n');
    else process.stderr.write(renderHuman(env, spec) + '\n');
    process.exitCode = 3;
    return;
  }

  try {
    const res = await rpcCall(endpoint, spec.id, args);
    if (parsed.json) {
      process.stdout.write(JSON.stringify(res) + '\n');
    } else {
      process.stdout.write(renderHuman(res, spec) + '\n');
    }
    if (res.status === 'error') process.exitCode = 1;
  } catch {
    const env: Envelope<never> = {
      status: 'error',
      error: { code: 'DAEMON_NOT_RUNNING', message: 'lost connection to corral daemon', hint: 'It restarts automatically. Retry in a moment.', retryable: true },
    };
    if (parsed.json) process.stdout.write(JSON.stringify(env) + '\n');
    else process.stderr.write(renderHuman(env, spec) + '\n');
    process.exitCode = 3;
  }
}

void main();

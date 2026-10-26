/**
 * 命令注册表——CLI/GUI 命令同源的单一事实源（权威：consistency-check §3 · Spec §5.1，R13 扩至 18 组）
 *
 * 纪律：
 * - RPC 与 CLI 1:1：每个 CommandSpec 对应 daemon 一个 RPC 方法（method = spec.id）
 * - GUI 命令 chip 一律从本注册表模板渲染，组件内禁手写命令字符串（DESIGN.md §9.4）
 * - 改本文件 = 改命令面契约，须走 Spec 变更流程
 * - php@<v> 别名归一化在解析层单一完成（normalizeVersion），UI 只渲染 canonical 裸版本形（R12）
 */

export type CommandGroup =
  | 'parked'
  | 'sites'
  | 'tls'
  | 'php'
  | 'stack'
  | 'services'
  | 'debug'
  | 'meta';

/** 无参语义三类（R12）：整栈动作 / 帮助 / 用法错误 */
export type NoArgBehavior = 'stack' | 'help' | 'usage-error';

export interface CommandArg {
  name: string;
  required: boolean;
  /** 版本参数：接受 php@<v> 别名，归一化为裸版本号（R12：扩展到所有版本入口） */
  version?: boolean;
}

export interface CommandFlag {
  name: string;
  /** true = 布尔旗标；缺省 = 带值旗标 */
  boolean?: boolean;
}

export interface CommandSpec {
  id: string;
  group: CommandGroup;
  /** 完整形（chip 复制用）：`corral link [--php <v>] [--port <n>]` */
  usage: string;
  /** 窄容器短形（GUI 显示用） */
  shortUsage: string;
  summary: string;
  args: CommandArg[];
  flags: CommandFlag[];
  /** OS 级副作用命令：--json 模式下只返回目标数据、不执行副作用（R11） */
  osSideEffect?: boolean;
  noArgBehavior?: NoArgBehavior;
  /** cwd 形动词族：GUI 完整形 = `cd <path> && corral <cmd>`（R10 衍生 chip 动词族拆分） */
  cwdForm?: boolean;
}

/** php@<v> 别名归一化（R12：单一实现，CLI 与 daemon 共用） */
export function normalizeVersion(input: string): string {
  return input.startsWith('php@') ? input.slice(4) : input;
}

const noArgs: CommandArg[] = [];

export const COMMANDS: CommandSpec[] = [
  // ── parked ──────────────────────────────────────────────
  {
    id: 'park',
    group: 'parked',
    usage: 'corral park <dir>',
    shortUsage: 'corral park',
    summary: 'Mount a parked directory (new folders auto-link within 60s)',
    args: [{ name: 'dir', required: true }],
    flags: [],
    cwdForm: false,
  },
  {
    id: 'unpark',
    group: 'parked',
    usage: 'corral unpark <dir>',
    shortUsage: 'corral unpark',
    summary: 'Unmount a parked directory',
    args: [{ name: 'dir', required: true }],
    flags: [],
  },

  // ── sites ───────────────────────────────────────────────
  {
    id: 'link',
    group: 'sites',
    usage: 'corral link [--php <v>] [--port <n>]',
    shortUsage: 'corral link',
    summary: 'Link the current directory as a site (name = directory name)',
    args: [],
    flags: [
      { name: 'php' },
      { name: 'port' },
    ],
    cwdForm: true,
  },
  {
    id: 'unlink',
    group: 'sites',
    usage: 'corral unlink',
    shortUsage: 'corral unlink',
    summary: 'Unlink the site for the current directory',
    args: noArgs,
    flags: [],
    cwdForm: true,
  },

  // ── tls ─────────────────────────────────────────────────
  {
    id: 'secure',
    group: 'tls',
    usage: 'corral secure',
    shortUsage: 'corral secure',
    summary: 'Enable HTTPS for the current site (local CA + system trust)',
    args: noArgs,
    flags: [],
    cwdForm: true,
  },
  {
    id: 'unsecure',
    group: 'tls',
    usage: 'corral unsecure',
    shortUsage: 'corral unsecure',
    summary: 'Disable HTTPS for the current site',
    args: noArgs,
    flags: [],
    cwdForm: true,
  },

  // ── php（版本管理）──────────────────────────────────────
  {
    id: 'isolate',
    group: 'php',
    usage: 'corral isolate <v>',
    shortUsage: 'corral isolate',
    summary: 'Pin the current site to a PHP version (accepts php@<v>)',
    args: [{ name: 'v', required: true, version: true }],
    flags: [],
    cwdForm: true,
  },
  {
    id: 'unisolate',
    group: 'php',
    usage: 'corral unisolate',
    shortUsage: 'corral unisolate',
    summary: 'Remove the PHP version pin from the current site',
    args: noArgs,
    flags: [],
    cwdForm: true,
  },
  {
    id: 'use',
    group: 'php',
    usage: 'corral use <v>',
    shortUsage: 'corral use',
    summary: 'Switch the global PHP version (accepts php@<v>)',
    args: [{ name: 'v', required: true, version: true }],
    flags: [],
    // R12：无参 = 用法错误（当前版本查询走 corral status）
    noArgBehavior: 'usage-error',
  },
  {
    id: 'php:list',
    group: 'php',
    usage: 'corral php:list',
    shortUsage: 'corral php:list',
    summary: 'List PHP versions (installed + available, with extensions)',
    args: noArgs,
    flags: [],
  },
  {
    id: 'php:install',
    group: 'php',
    usage: 'corral php:install <v>',
    shortUsage: 'corral php:install',
    summary: 'Install a PHP version (catalog download + SHA256)',
    args: [{ name: 'v', required: true, version: true }],
    flags: [],
  },
  {
    id: 'php:uninstall',
    group: 'php',
    usage: 'corral php:uninstall <v>',
    shortUsage: 'corral php:uninstall',
    summary: 'Uninstall a PHP version',
    args: [{ name: 'v', required: true, version: true }],
    flags: [],
  },

  // ── stack ───────────────────────────────────────────────
  {
    id: 'start',
    group: 'stack',
    usage: 'corral start [site]',
    shortUsage: 'corral start',
    summary: 'Enable a site (vhost + un-stop page); no arg = start the whole local stack',
    args: [{ name: 'site', required: false }],
    flags: [],
    // R8：无参 = 整栈；--all 已取消
    noArgBehavior: 'stack',
  },
  {
    id: 'stop',
    group: 'stack',
    usage: 'corral stop [site]',
    shortUsage: 'corral stop',
    summary: 'Disable a site (remove vhost + stop page); no arg = stop the whole stack',
    args: [{ name: 'site', required: false }],
    flags: [],
    noArgBehavior: 'stack',
  },
  {
    id: 'restart',
    group: 'stack',
    usage: 'corral restart [site]',
    shortUsage: 'corral restart',
    summary: 'Restart a site or the whole stack (atomic on daemon side)',
    args: [{ name: 'site', required: false }],
    flags: [],
    noArgBehavior: 'stack',
  },
  {
    id: 'status',
    group: 'stack',
    usage: 'corral status',
    shortUsage: 'corral status',
    summary: 'Global status + sites (five states) + services',
    args: noArgs,
    flags: [],
  },
  {
    id: 'logs',
    group: 'stack',
    usage: 'corral logs [--site <name>] [--lines <n>]',
    shortUsage: 'corral logs',
    summary: 'Read recent logs (live tail via WS stream channel)',
    args: [],
    flags: [
      { name: 'site' },
      { name: 'lines' },
    ],
  },
  {
    id: 'open',
    group: 'sites',
    usage: 'corral open <site>',
    shortUsage: 'corral open',
    summary: 'Open a site URL in the browser (site required; CLI never opens GUI windows)',
    args: [{ name: 'site', required: true }],
    flags: [],
    // R9 v2：site 必填；R11：--json 只返 data.url 不执行
    osSideEffect: true,
    noArgBehavior: 'usage-error',
  },
  {
    id: 'edit',
    group: 'meta',
    usage: 'corral edit [site]',
    shortUsage: 'corral edit',
    summary: 'Reveal generated config dir for a site; no arg = open main config in editor',
    args: [{ name: 'site', required: false }],
    flags: [],
    osSideEffect: true,
  },

  // ── meta ────────────────────────────────────────────────
  {
    id: 'new',
    group: 'meta',
    usage: 'corral new <framework> <name> [--php <v>]',
    shortUsage: 'corral new',
    summary: 'Scaffold a new project (Laravel first; generic/static fallback)',
    args: [
      { name: 'framework', required: true },
      { name: 'name', required: true },
    ],
    flags: [{ name: 'php' }],
  },
  {
    id: 'doctor',
    group: 'meta',
    usage: 'corral doctor',
    shortUsage: 'corral doctor',
    summary: 'Self-check (ports, CA, binaries, data dirs, .env suggestions)',
    args: noArgs,
    flags: [],
  },
  {
    id: 'uninstall',
    group: 'meta',
    usage: 'corral uninstall',
    shortUsage: 'corral uninstall',
    summary: 'Full uninstall (CA removal + DNS restore + config cleanup)',
    args: noArgs,
    flags: [],
  },

  // ── services（R13：附加服务）────────────────────────────
  {
    id: 'mysql:start',
    group: 'services',
    usage: 'corral mysql:start',
    shortUsage: 'corral mysql:start',
    summary: 'Start the MySQL service (not auto-started at login)',
    args: noArgs,
    flags: [],
  },
  {
    id: 'mysql:stop',
    group: 'services',
    usage: 'corral mysql:stop',
    shortUsage: 'corral mysql:stop',
    summary: 'Stop the MySQL service (data directory is kept)',
    args: noArgs,
    flags: [],
  },
  {
    id: 'mysql:restart',
    group: 'services',
    usage: 'corral mysql:restart',
    shortUsage: 'corral mysql:restart',
    summary: 'Restart the MySQL service (atomic on daemon side)',
    args: noArgs,
    flags: [],
  },
  {
    id: 'mysql:status',
    group: 'services',
    usage: 'corral mysql:status',
    shortUsage: 'corral mysql:status',
    summary: 'MySQL service status + connection info + .env suggestions',
    args: noArgs,
    flags: [],
  },
  {
    id: 'mysql:install',
    group: 'services',
    usage: 'corral mysql:install <v>',
    shortUsage: 'corral mysql:install',
    summary: 'Install MySQL (8.4 LTS first; catalog download + SHA256)',
    args: [{ name: 'v', required: true, version: true }],
    flags: [],
  },
  {
    id: 'mysql:uninstall',
    group: 'services',
    usage: 'corral mysql:uninstall <v>',
    shortUsage: 'corral mysql:uninstall',
    summary: 'Uninstall MySQL (data dir kept unless --purge --confirm)',
    args: [{ name: 'v', required: true, version: true }],
    flags: [
      { name: 'purge', boolean: true },
      { name: 'confirm', boolean: true },
    ],
  },
  {
    id: 'redis:start',
    group: 'services',
    usage: 'corral redis:start',
    shortUsage: 'corral redis:start',
    summary: 'Start the Redis service',
    args: noArgs,
    flags: [],
  },
  {
    id: 'redis:stop',
    group: 'services',
    usage: 'corral redis:stop',
    shortUsage: 'corral redis:stop',
    summary: 'Stop the Redis service (data directory is kept)',
    args: noArgs,
    flags: [],
  },
  {
    id: 'redis:restart',
    group: 'services',
    usage: 'corral redis:restart',
    shortUsage: 'corral redis:restart',
    summary: 'Restart the Redis service (atomic on daemon side)',
    args: noArgs,
    flags: [],
  },
  {
    id: 'redis:status',
    group: 'services',
    usage: 'corral redis:status',
    shortUsage: 'corral redis:status',
    summary: 'Redis service status + connection info + .env suggestions',
    args: noArgs,
    flags: [],
  },
  {
    id: 'redis:install',
    group: 'services',
    usage: 'corral redis:install',
    shortUsage: 'corral redis:install',
    summary: 'Install Redis (7.x single version — no version arg)',
    args: noArgs,
    flags: [],
  },
  {
    id: 'redis:uninstall',
    group: 'services',
    usage: 'corral redis:uninstall',
    shortUsage: 'corral redis:uninstall',
    summary: 'Uninstall Redis (data dir kept unless --purge --confirm)',
    args: noArgs,
    flags: [
      { name: 'purge', boolean: true },
      { name: 'confirm', boolean: true },
    ],
  },

  // ── debug（R13：Xdebug）─────────────────────────────────
  {
    id: 'debug:on',
    group: 'debug',
    usage: 'corral debug:on [site]',
    shortUsage: 'corral debug:on',
    summary: 'Turn Xdebug on for a scope (no arg = global)',
    args: [{ name: 'site', required: false }],
    flags: [],
  },
  {
    id: 'debug:off',
    group: 'debug',
    usage: 'corral debug:off [site]',
    shortUsage: 'corral debug:off',
    summary: 'Turn Xdebug off for a scope (no arg = global)',
    args: [{ name: 'site', required: false }],
    flags: [],
  },
];

export const COMMAND_IDS = COMMANDS.map((c) => c.id);

export function findCommand(id: string): CommandSpec | undefined {
  return COMMANDS.find((c) => c.id === id);
}

/** 帮助文本渲染（裸 `corral` = 帮助，R12） */
export function renderHelp(): string {
  const lines = ['Corral — local development environment manager', '', 'Usage: corral <command> [options]', ''];
  const byGroup = new Map<CommandGroup, CommandSpec[]>();
  for (const c of COMMANDS) {
    const list = byGroup.get(c.group) ?? [];
    list.push(c);
    byGroup.set(c.group, list);
  }
  for (const [group, specs] of byGroup) {
    lines.push(`  ${group}`);
    for (const s of specs) lines.push(`    ${s.usage.padEnd(46)} ${s.summary}`);
    lines.push('');
  }
  lines.push('All commands support --json for machine-readable output.');
  return lines.join('\n');
}

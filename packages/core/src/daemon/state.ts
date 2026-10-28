/**
 * JSON 状态存储（ADR-007：JSON 原子写 + schema 版本号 + repository 接口抽象）
 *
 * MVP 无数据库（better-sqlite3 需按 ABI 重编、node:sqlite 带实验标记）；
 * 数据量/并发成瓶颈时切 SQLite，业务层零改动（repository 接口已抽象）。
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface SchemaVersioned {
  schemaVersion: number;
}

export interface SiteRecord extends SchemaVersioned {
  name: string;
  path: string;
  php: string;
  port: number;
  secure: boolean;
  enabled: boolean;
  status: string;
}

export interface StateFile extends SchemaVersioned {
  sites: SiteRecord[];
  settings: {
    globalPhp: string;
    theme: 'light' | 'dark' | 'system';
    shellChain: string[];
  };
  parkedDirs: string[];
  phpVersions: Array<{
    version: string;
    path: string;
    installedAt: string;
    extensions: string[];
    /** 落盘归档摘要（TOFU 基线或 catalog 钉死值） */
    sha256?: string;
    /** pinned = catalog 提供摘要；tofu = 首次下载记录 */
    checksumSource?: 'pinned' | 'tofu';
  }>;
  services: Array<{
    name: string;
    version: string;
    status: string;
    port: number;
    pid?: number;
    dataDir?: string;
  }>;
}

const CURRENT_SCHEMA = 1;

export function emptyState(): StateFile {
  return {
    schemaVersion: CURRENT_SCHEMA,
    sites: [],
    settings: { globalPhp: '8.4', theme: 'system', shellChain: ['pwsh', 'powershell.exe', 'cmd.exe'] },
    parkedDirs: [],
    phpVersions: [],
    services: [
      { name: 'mysql', version: '8.4', status: 'not-installed', port: 3306 },
      { name: 'redis', version: '7.x', status: 'not-installed', port: 6379 },
    ],
  };
}

export class JsonStore {
  constructor(private readonly filePath: string) {}

  async read(): Promise<StateFile> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as StateFile;
      if (parsed.schemaVersion !== CURRENT_SCHEMA) {
        // MVP：schema 变更即报 CONFIG_INVALID，迁移逻辑 v1.x 补
        throw new Error(`unsupported schema version: ${parsed.schemaVersion}`);
      }
      return parsed;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return emptyState();
      throw err;
    }
  }

  /** 原子写：tmp + rename（同目录保证同文件系统 rename 原子性） */
  async write(state: StateFile): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8');
    await fs.rename(tmp, this.filePath);
  }

  /** 读-改-写（并发以后写入者为准并提示，Spec §10） */
  async update(mutator: (state: StateFile) => void | Promise<void>): Promise<StateFile> {
    const state = await this.read();
    await mutator(state);
    await this.write(state);
    return state;
  }
}

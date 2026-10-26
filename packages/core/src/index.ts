export { detectPlatform, MacPlatform, WinPlatformStub } from './platform/index.js';
export type { PlatformAdapter, DnsSetup, TrustResult } from './platform/index.js';
export { Daemon } from './daemon/index.js';
export type { DaemonOptions, CommandContext, CommandHandler } from './daemon/index.js';
export { JsonStore, emptyState } from './daemon/state.js';
export type { StateFile, SiteRecord } from './daemon/state.js';

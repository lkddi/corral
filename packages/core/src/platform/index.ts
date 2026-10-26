import { MacPlatform } from './mac.js';
import { WinPlatformStub } from './win.js';
import type { PlatformAdapter } from './types.js';

export type { PlatformAdapter, DnsSetup, TrustResult } from './types.js';
export { MacPlatform } from './mac.js';
export { WinPlatformStub } from './win.js';

/** 平台工厂（全项目唯一 process.platform 读取点） */
export function detectPlatform(): PlatformAdapter {
  if (process.platform === 'darwin') return new MacPlatform();
  if (process.platform === 'win32') return new WinPlatformStub();
  throw new Error(`Unsupported platform: ${process.platform} (v1.0 supports macOS only)`);
}

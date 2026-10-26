/**
 * Electron main（GUI 壳，frame:false · Spec §4.2）
 *
 * 职责边界（ADR-002）：main 只做壳——建窗、拉起/守护 daemon 子进程、转发 RPC。
 * 业务全在 daemon；main 禁直接操作 nginx/php/服务。
 */
import { app, BrowserWindow } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectPlatform } from '@corral/core';

const platform = detectPlatform();

const here = path.dirname(fileURLToPath(import.meta.url));
let daemon: ChildProcess | null = null;
let win: BrowserWindow | null = null;

function ensureDaemon(): void {
  if (daemon) return;
  // daemon = core 包产物（零 Electron 依赖，关窗不停服）
  const daemonEntry = path.join(here, '../core/dist/daemon/index.js');
  daemon = spawn(process.execPath, [daemonEntry], {
    env: { ...process.env, CORRAL_DATA_DIR: path.join(app.getPath('home'), '.corral') },
    stdio: 'ignore',
  });
  daemon.on('exit', (code) => {
    daemon = null;
    // launchd 自启场景 daemon 可能已由登录项拉起；非 0 退出才重拉
    if (code !== 0) setTimeout(ensureDaemon, 1000);
  });
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 960,
    height: 640,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0f766e', // TODO(I4): 改 design-tokens 引用，消除硬编码（P0-3 纪律）
    webPreferences: {
      preload: path.join(here, '../preload/index.mjs'),
      contextIsolation: true,
      sandbox: false,
    },
  });
  void win.loadFile(path.join(here, '../renderer/index.html'));
}

app.whenReady().then(() => {
  ensureDaemon();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // 关窗不停服（平台语义收敛在 PlatformAdapter.quitOnWindowAllClosed）
  if (platform.quitOnWindowAllClosed()) app.quit();
});

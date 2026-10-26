/**
 * Preload（contextBridge 最小面，I4 展开）
 * GUI 与 daemon 通信经 main 转发；禁在 renderer 直连 daemon。
 */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('corral', {
  /** RPC 调用（main → daemon 转发，I1 起为 stub） */
  invoke: (method: string, args: Record<string, unknown>) => ipcRenderer.invoke('corral:rpc', method, args),
});

# 页面：Console（底部集成终端 dock）

> 路由/表面：主窗口内容区底部 dock（非侧导航项）| 版本 v1.3 | 2026-10-26
> Master + Overrides：本文件只写与 MASTER.md 的差异与页面专属细节
> 定位：team-lead 2026-10-26 裁决——「GUI 每操作暴露等价 CLI」差异化的落点：agent 工作流不离开应用；Zellij 式底部 dock，默认打开
> v1.1：终端栈锁定（架构师：xterm.js + node-pty 宿主 daemon + WS 流通道）；dock 几何归 renderer settings JSON
> v1.2：shell 探测链按总监意图落为 pwsh → powershell.exe → cmd（R10 配套）
> v1.3：shell 偏好修正为 daemon 配置项（数据层边界：禁落 renderer settings，CLI 起的会话要读）；shell 链补全第三跳 cmd.exe

## 布局

```
┌─────────────────────────────────────────────────┐
│ 内容区视图（Sites / PHP / Logs，flex-1）          │
├─────────────────────────────────────────────────┤
│ dock 头 32px：[square-terminal] Console · ~/Code/my-app   [Open in system terminal] [chevron-down] │
├─────────────────────────────────────────────────┤
│ 终端面（code-surface，flex-1，mono 12px，行高 1.6）        │
│ $ corral status                                   │
│ …                                                  │
└─────────────────────────────────────────────────┘
```

- dock 高 = 内容区高 40%（`--console-dock-h`），min 160px / max 70%；MVP 不支持拖拽调高（fast-follow），只可折叠
- 折叠态 = slim 条 28px（`--console-dock-collapsed-h`）：`square-terminal` 16px + "Console" + 右侧 `chevron-up`（aria "Show console"）
- 折叠状态与 dock 高度 = **renderer settings JSON**（GUI 本地偏好，架构师裁决；不涉 daemon 状态词汇表，HC-2/3 不受影响；窗口尺寸位置仍走配置文件，两者分流）；**shell 偏好归 daemon 配置项**（见实现备注——视图偏好与数据层配置不混存）
- 终端面 = `--code-bg` 深色（两主题皆深，与日志窗同表面语言）+ `--code-fg` + mono `--text-sm`；超长行横向滚动禁 wrap（同日志窗）
- dock 头 cwd 标签：mono `--text-sm` `--meta`，ellipsis + tooltip 全路径；**显示 spawn 时的工作目录（静态），不跟踪 cd（OSC 7 跟踪 = v1.1）**
- dock 头右侧：[Open in system terminal]（ghost，`external-link` 16px + 文字，打开 Terminal.app / Windows Terminal 于当前 cwd）+ 折叠钮（`chevron-down` 16px，aria "Hide console"）

## 核心组件与状态（矩阵见 component-states.md §14）

- **Loading（spawn）**：终端面内 "Starting shell…"（`--meta` mono）+ 16px `loader-circle`；≤2s，禁无限转圈
- **Ready**：shell prompt 可见，可直接输入
- **First-run hint**：prompt 上方一行 `--meta` `--text-sm`：「Every action in Corral shows its CLI command. Run it here.」——首次输入或 Esc 后不再显示（写配置文件）
- **Error（spawn 失败）**：「Couldn't start the shell. {reason}」+ [Open in system terminal] + [Retry]（`rotate-cw` 16px）
- **Exited（shell 退出/被杀）**：「Shell exited.」+ [Restart shell]（secondary，`rotate-cw` 16px + 文字）
- **Edge（超长输出/高频刷屏）**：原生滚动回退（终端模拟器 backbuffer）；MVP 无搜索增强，清屏用 shell 自己的 clear

## 交互

- spawn cwd = Sites 视图当前选中站点目录；无选中 = 用户 home；**不跟随选区变化自动重启 shell**（不抢夺用户当前会话）
- dock 是 renderer 内部分栏，无新壳层窗口（与 v1.1 托盘富面板的独立 BrowserWindow 不同）；daemon 不参与终端生命周期
- GUI 动作不往终端写东西——终端是用户的地盘；终端内状态不属于 daemon 状态词汇表（HC-2 不适用）
- [Open in system terminal] = OS 级动作，无 corral 命令等价，不渲染 CommandChip
- 首次启动 dock 默认打开（40%）；用户折叠选择持久化（settings JSON）

## 键盘

⌃` / Ctrl+` 折叠切换 · 终端聚焦后按键全部透传 shell（**esc 不关 dock**——会破坏终端语义）· dock 未聚焦时 ⌘K/⌃K 仍可达命令面板（含 Show/Hide console 动作）

## 响应式（窗口缩放）

<720px：dock 保持 40%（侧导航收图标条不影响 dock）；窗口 min 640×480 时 dock min 160px 仍可容纳一行 prompt

## 文案 deck

见上状态段。dock 折叠/展开无 toast（即时视觉反馈）；复用 toast："Copied `{command}`"

## 实现备注（转架构师 Spec 的输入 · 栈已锁定）

- **终端栈（架构师 2026-10-26 锁定）**：xterm.js（renderer 终端模拟层）+ **node-pty 宿主 = daemon**（独立 Node 24.22.0，ABI 匹配；原生模块不进 Electron main——避免 electron-rebuild，壳保持薄、全系统单一运行时）
- node-pty 二进制由 CI 按平台构建、随包分发（macOS x64/arm64 + Windows x64），与 nginx/mkcert/dnsmasq 同一管线，用户零编译
- pty 字节流走 daemon 新增 **WS 流通道**（127.0.0.1 only + token 鉴权，与 RPC 的 TCP 控制通道分端口）；renderer 是 Chromium 页面只能走 WebSocket——必需项；Logs 视图实时 tail 复用同一通道（无文件轮询）
- 风险备案（架构侧，不阻塞设计）：node-pty 上游维护慢 + Node 24 兼容需实现前一次双端编译+冒烟 spike；**本设计按完整终端能力出稿，若降级管道模式（非交互）不改稿**
- shell 探测链（R10 配套，三跳完整形）：macOS 默认探测起点 = `$SHELL`；Windows = **pwsh → powershell.exe → cmd.exe**（PowerShell 全版本自带，中间加一级）；**shell 偏好 = daemon 配置项**（pty 宿主在 daemon——默认 shell / 探测链的「可配置」写 daemon 配置，**禁落 renderer settings**，否则 CLI 起的 Console 会话读不到；MVP 无 GUI 设置入口，与 parked 目录同纪律：改配置文件，v1.1 设置窗口经 RPC 写 daemon 侧）
- reduced-motion：终端光标闪烁关闭（xterm cursorBlink=false）

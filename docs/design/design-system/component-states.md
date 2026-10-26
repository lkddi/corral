# Corral — 组件状态矩阵（component-states.md）

> 版本 v1.5 | 2026-10-26 | 每个交互组件必须覆盖：Default / Hover / Focus / Active / Disabled / Loading / Error / Empty / Edge
> 状态词汇表（CLI/GUI 共享 enum）：`running` → Running · `stopped` → Stopped · `starting` → Starting… · `error` → Error · `missing` → Missing（parked 目录被删，PRD §8）

---

## 1. SiteRow（站点行）— 核心组件

| 状态 | 视觉 | 交互 |
|---|---|---|
| Default（stopped） | meta 空心点 + "Stopped"；域名 mono；操作钮隐藏 | click 选中；hover 显操作 |
| Hover | 行底 `--surface`（或 sunken 微染）；行尾浮现 Open/Logs/More | 操作钮 28×28 逐一 hover 出底 |
| Focus-visible | `--focus-ring` 双环 | Tab 可达；↵ = Open |
| Selected | 整行 `--accent-subtle` 底 + `--accent-strong` 字 | 再次 click 或 esc 取消选中 |
| Running | success 实心点 + "Running" | Open 可用；Stop 可用；Start 禁用 |
| Starting | warn 点 + 脉冲（reduced-motion 静态）+ "Starting… (Ns)" 实时秒表 | Stop 可用（取消启动）；Open 禁用 + tooltip "Site is starting" |
| Error | danger 点 + "Error" + 行内摘要（如 "Port 80 in use"） | click 摘要展开错误面板 E1 |
| Disabled（操作级） | 单钮 opacity 0.5 + tooltip 说明原因 | 例：stopped 时 Open 禁用 |
| Edge（超长域名） | ellipsis 截断 + tooltip 全域名 | 列宽不撑破布局 |
| Missing（ parked 目录被删） | meta 空心点 + "Missing" + 整行 opacity 0.6 | Open/Logs 禁用 + tooltip "The folder for {name} no longer exists. It comes back if the folder returns."；Unlink 可用；行不消失（PRD §8：标记失效而非静默消失） |

## 2. PrimaryButton（主操作按钮）

Default：accent 底 + accent-on 字 / Hover：accent-hover（120ms）/ Focus：focus-ring / Active：accent-active / Disabled：opacity 0.5 + not-allowed / Loading：16px loader-circle + 文字保留（宽度防抖）/ Error：转 danger 底（仅破坏性主操作，如确认卸载）/ Empty：n/a / Edge：超长标签 wrap 或 ellipsis。

## 3. IconButton（行内图标钮，28×28）

Default：透明底 20px 图标 `--fg-2` / Hover：`--surface-sunken` 圆底 / Focus：focus-ring / Active：图标缩放 0.92（120ms）/ Disabled：opacity 0.5 + tooltip 原因 / Loading：n/a / Error：n/a / Empty：n/a / Edge：tooltip 含动态插值（`{name}`/`{domain}`）。全部 aria-label（icons.md 文案表）。

## 4. SegmentedControl（全局 PHP 分段）

Default：sunken 容器 + muted 文字 / 选中段：surface 底 + elev-ring + fg 字（accent 角色①）/ Hover 未选中段：fg-2 文字 / Focus：段可 Tab + focus-ring / Disabled：段禁用（版本安装中）/ Loading：切换中该段出 16px spinner 200ms 内收敛 / Error：切换失败 toast + 段回滚 / Empty：仅 1 个已装版本时隐藏控件显示静态版本 / Edge：>4 个已装版本 → 收起为「当前值 + chevron」跳 PHP 页。

## 5. PHPInstallRow（安装行）

| 状态 | 视觉 |
|---|---|
| Idle | 版本号 mono + [Install] secondary 钮 |
| Installing（Loading） | 行变进度态：4px accent 进度条 + mono "42% · 3.2 MB/s · ~18s left" + [Cancel]；禁无限动画 |
| Success | 进度满 → 行移入 Installed 区 + toast "Installed PHP 8.3" |
| Canceled | 进度停 + 文案 "Download canceled" + [Install] 复位 |
| Error-网络（E3a） | wifi-off 图标 + "Couldn't reach the PHP download server. Check your connection and try again." + [Retry] |
| Error-校验（E3b） | shield-alert 图标 + "The download finished but the checksum didn't match. The file may be corrupted or tampered with." + [Retry] [Report issue] |
| Edge（断网续传） | MVP 不做续传：取消即弃，重来全量（文案不承诺断点续传） |

## 6. SiteStartAction（启动动作 → Starting 状态机）

Idle → 点击 Start → **Starting**（warn 脉冲 + 秒表）→ 三种出口：
- ≤10s → Running（success 点 + toast "Started my-app.test"）
- >10s → **Error**（"This is taking longer than usual." + [View logs] [Retry]）——禁无限转圈
- 端口冲突 → **Error E1**（circle-alert + "Port 80 is already used by nginx (PID 4821). Stop that process, or link this site on another port." + CommandChip `cd <path> && corral link --port=8080` + [Copy command] [View logs]）

Start/Stop/Restart chip 形（R8 落盘终态，chips 锁定）：`corral start my-app` / `corral stop my-app` / `corral restart my-app`（显式站点名形；无参 = 全栈启停 / 重启整栈；无 `--all` 旗标、无 cwd 缺省推断）。

## 7. SecureAction（HTTPS 动作）

Unsecured（HTTPS 列 `—`）→ Secure with HTTPS → Securing（钮内 spinner ≤3s）→ Secured（lock 图标 + tooltip "Secured with local CA"）。
失败 → **E2**（key 图标 + "macOS didn't accept the local certificate. Open Keychain Access, find "Corral Local CA" under System, double-click it, and set Always Trust." + [Open Keychain Access] [Copy steps]）。信任后徽章变 lock，无需重启。Windows 变体：证书存入本地计算机信任存储（文案按平台切换）。

## 8. CommandPalette（⌘K）

Closed（不可见）/ Open-empty（输入框 + "Type to search sites and actions"）/ Open-results（分组列表）/ Open-navigating（↑↓ 高亮行）/ Executing（↵ 后浮层关闭 + toast 回执）/ Error（动作失败：浮层关闭 + 错误面板或 toast）。esc 随时关闭；Tab 焦点圈定浮层内。

## 9. Toast

Success（4s 自动消失，16px circle-check success 色）/ Error（常驻至关闭，danger 色 + 动作钮）/ Info（4s）。同时 ≤1 条，新Toast 替换排队。位置：窗口右下 24px。

## 10. EmptyState（空状态）

- **无站点**：「No sites linked yet. Run `corral link` inside a project folder and it shows up here instantly.」+ [Copy command] + [Link a folder…]
- **搜索无结果**：「No sites match "{query}". Try `corral link` in the project folder.」+ [Clear search]
- **PHP 无可用版本**：「All available PHP versions are installed.」+ 链接文档（external-link）
- **Logs 空**：「No logs yet for {name}. Logs appear after the first request.」
- **Logs 站点已停**：「{name} is stopped. Start it to generate logs.」+ [Start]

## 11. LogPane（日志窗）

Loading（骨架：code-bg + 3 行微光块，reduced-motion 静态）/ Streaming（mono 12px + auto-tail 默认开 + 行数）/ Empty（见 §10）/ Stopped-site（见 §10）/ Error（文件不可读："Can't read the log file for {name}. [Reveal file] [Copy path]"）。Copy all 始终可用（空日志复制空串 + toast "Nothing to copy"）。

## 12. 全局交互态

所有可交互元素：focus-visible 双环保留（禁移除）；hover/active 120ms；transition 只用 `--motion-*` + `--ease-standard`；`prefers-reduced-motion: reduce` 全局降级。破坏性操作（卸载 PHP、停止站点不需确认——可逆；删除/卸载需确认对话框说后果）。

## 13. 全局与边界状态（PRD §8 + 错误契约 + R3 托盘）

### 12.1 全局横幅（窗口顶部，warn/danger，可关闭）

| 状态 | 触发 | 视觉与文案 | 动作 |
|---|---|---|---|
| Daemon 不可达 | DAEMON_NOT_RUNNING（连接失败 >3s） | `circle-alert` danger + "Can't reach the Corral daemon. It should restart automatically." + 站点行状态显示 "—" | [Retry] + CommandChip `corral doctor` |
| 配置无效 | CONFIG_INVALID | `triangle-alert` warn + {hint（来自 error.hint）} | [Open configuration]（`corral edit` 等价） |
| 首次提权未完成 | 特权设置（DNS/CA）未就绪 | `triangle-alert` warn + "Corral needs one-time administrator approval to set up local DNS and certificates." | [Approve]（触发系统授权流）+ [See manual steps]（降级说明，禁静默失败——PRD §8 权限拒绝） |

### 12.2 错误态 retryable 标注（信封 `{status,data,error:{code,message,hint,retryable?}}`，daemon 判定）

- **retryable=true → 给 [Retry]**：PORT_CONFLICT（E1， freeing 端口后重试）、PERMISSION_DENIED（E2，手动信任后重试）、NETWORK_ERROR（E3a）
- **retryable=false → 禁给 [Retry]**：CHECKSUM_MISMATCH（E3b，只给 [Report issue] + 重新下载引导）、VERSION_NOT_INSTALLED（给 [Install {v}] 内联 + [Choose another version]）、CONFIG_INVALID、**USAGE_ERROR**（hint 正确用法 + 完整形 chip，R11）、**SITE_NOT_FOUND**（核对站点名 + `corral status` chip，R11）
- UI 不得自行推断 retryable，严格按信封字段渲染

### 12.3 并发与外部变更（PRD §8：以后写入者为准并提示）

- CLI 与 GUI 同时操作同一站点：daemon 事件驱动 UI 刷新；若用户正在操作的行被外部改变 → toast "This site was changed from the terminal. Showing the latest state."
- 并行 link 多站点不互相阻塞：每行独立状态机

### 12.4 边界值（PRD §8）

- 站点名含连字符/下划线/点：行渲染不变，域名 mono 展示
- 同名重复 link（SITE_EXISTS）：PRD = 后者覆盖并提示 → toast "Replaced the existing link for {name}."（GUI Link a folder 流程同此）
- 单机 100+ 站点：列表虚拟化（视口渲染），搜索在虚拟层之上
- 符号链接目录：无特殊 UI

### 12.5 托盘（MVP 最小 · R3）

- 静态单色 template 图标（16/18px）+ tooltip 状态摘要（"Corral — 3 of 4 sites running"）；菜单 Open Corral / Quit（main 进程构建）
- alpha 变体状态图标（实心/半透明/描边）= v1.1 富面板配套

---

## 14. TerminalPane（Console dock · 集成终端）

| 状态 | 视觉 | 交互 |
|---|---|---|
| Collapsed | 28px slim 条：`square-terminal` 16 + "Console" + `chevron-up` | 点击或 ⌃` 展开；折叠态写配置文件 |
| Loading（spawn） | 终端面内 "Starting shell…"（meta mono）+ 16px `loader-circle` | ≤2s；禁无限转圈；同时禁用输入 |
| Ready | shell prompt（code-bg 深色 + mono 12px） | 按键全透传 shell；esc 不关 dock |
| First-run hint | prompt 上方一行 meta `--text-sm`：「Every action in Corral shows its CLI command. Run it here.」 | 首次输入或 Esc 后永久消失（写配置） |
| Error（spawn 失败） | 「Couldn't start the shell. {reason}」 | [Open in system terminal] + [Retry]（`rotate-cw`） |
| Exited（shell 退出） | 「Shell exited.」 | [Restart shell]（secondary） |
| Edge（超长输出） | 终端 backbuffer 原生滚动；超长行横滚禁 wrap | 无 wrap；MVP 无搜索增强 |
| A11y / motion | 终端区对屏幕阅读器不友好（品类固有）→ [Open in system terminal] 为替代路径；reduced-motion 光标闪烁关闭 | ⌃` 折叠钮 focus-visible 可达 |

dock 头 32px：`square-terminal` + "Console" + cwd mono 标签（spawn 时目录，ellipsis + tooltip，不跟踪 cd）+ [Open in system terminal]（ghost）+ 折叠钮（`chevron-down`）。dock 高 40%（min 160 / max 70），默认打开；折叠态与高度存 renderer settings JSON（GUI 本地偏好）；pty 字节流走 daemon WS 流通道（spawn ≤2s）。

---

## 变更记录

| 日期 | 变更 | 原因 |
|---|---|---|
| 2026-10-26 | v1.0 建立 | Phase 2，PRD 错误态与性能红线转译为完整矩阵 |
| 2026-10-26 | v1.1：+missing 态 / §13 全局横幅（DAEMON_NOT_RUNNING/CONFIG_INVALID/首次提权）/ retryable 标注规则 / 并发外部变更 / SITE_EXISTS 覆盖提示 / 100+ 虚拟化 / MVP 托盘最小态 | Phase 1 文档终检（PRD §8 边界 + 错误契约 + R3） |
| 2026-10-26 | v1.2：原重复编号「§12 全局与边界状态」改 §13（同步 icons/MASTER/sites 引用）；+§14 TerminalPane（Console dock 全状态：折叠/spawn 加载/首启提示/失败/退出/边界） | team-lead Console 视图裁决 + 编号去重 |
| 2026-10-26 | v1.3：§6 E1 chip 改 cd 完整形 + start/stop 预对齐注记；§14 补 settings JSON 持久化与 WS 通道口径 | 架构师终端栈 + start/stop 动词裁决 |
| 2026-10-26 | v1.4：§6 start/stop/restart chip 形转锁定态（R8 落盘：无 --all、无 cwd 推断、restart [site] 解锁） | 总监 R8/R9 v2 终态 |
| 2026-10-26 | v1.5：§12.2 retryable=false 清单 +USAGE_ERROR / SITE_NOT_FOUND（R11，错误码 8→10） | 总监 R11 错误码补行 |

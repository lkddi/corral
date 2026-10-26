# Corral — MASTER.md（全局设计源 · 机器可读优先）

> 版本 v1.6 | 2026-10-26 | 设计师：颜好看
> 检索规则：实现某页面先读本文件，再查 `pages/<page>.md`（存在则其字段覆盖本文件对应项）。
> 写入规则：本文件已存在时禁整篇重写，只追加/修正具体条目；变更在文末变更记录表加一行。

## 身份

- 产品：Corral — 开源 PHP 本地开发环境管家（CLI + 最小桌面 GUI）
- 寄存器：**product**（标杆 = 赢得熟悉感：TablePlus/Raycast/Linear 熟手坐下即信）
- 平台：desktop 双端（macOS + Windows），Electron renderer（React + TS + Tailwind + lucide-react）
- 三轴：DESIGN_VARIANCE=3 / MOTION_INTENSITY=3 / VISUAL_DENSITY=6
- UI 语言：英文；语气：man page（动词开头、短句、可执行、像编译器报错一样给修复命令）
- MVP 范围（总监 R1-R6 终裁 + team-lead 2026-10-26 追加）：主窗口三视图（Sites/PHP/Logs）+ ⌘K 面板 + Link a folder 按钮 + HTTPS Secure GUI 可点 + 原生菜单设置（主题/开机启动/Edit configuration/Star on GitHub/About/Quit）+ 只读 parked 目录行 + **托盘图标 + 最小原生菜单（Open/Quit/状态 tooltip，R3）** + **Console 底部 dock（集成终端，默认打开 40%，⌃` 折叠，Open in system terminal 逃生钮）**。富托盘面板、设置窗口、服务管理页、DNS 页、环境色标、dock 拖拽调高 = v1.1
- 技术栈锚定（consistency-check §5 实测）：Electron 45.0.0 + 随包 Node 24.22.0 + React 19.3.1 + Tailwind v4.3.3（CSS-first @theme，见 DESIGN.md §9.1）+ lucide-react 1.61.0 exact + Radix 原语 + TanStack Query/Zustand

## 主题

- 默认浅色，`data-theme="dark"` 深色对等；默认跟随系统，用户经原生菜单覆盖（写配置文件）
- Token 全集：`design-tokens.css` / `design-tokens.json`（唯一色值来源，组件禁硬编码）

## 色彩铁律

- accent 两角色：① 当前选中态 ② 主操作按钮。禁装饰性使用
- success/warn/danger 只做 6px 点/图标/徽章边框；文字用 fg / warn-text / danger
- terminal-green 只在 code-bg 深色面；code-bg 两主题皆深
- 深色 hover 变亮、浅色 hover 变暗；深色层级靠亮度递进不用阴影

## 排版铁律

- font-ui = Fira Sans 链；font-mono = Fira Code 链；mono 强制：域名/版本/端口/路径/命令/日志/秒表
- 字号 8 级 xs11/sm12/md13/base14/lg16/xl18/2xl22/3xl28；字重 400/500/600
- 行高 body1.5/list1.4/title1.2；caps ≥0.06em；标题 -0.01em；数字 tabular-nums

## 组件锚点

- 站点行 40px；列序 Name/Domain/PHP/Status/HTTPS；hover 出行操作；右键 = More 菜单同内容
- 图标钮 28×28 命中 + 20px 图标；Primary 钮 accent 底；分段控件 sunken 底
- CommandChip：mono 命令 + copy 钮；**命令字符串必须从 shared/commands.ts 注册表模板渲染，禁手写；语法唯一权威 = consistency-check.md §3 统一命令表**（park/unpark · link/unlink · secure/unsecure · isolate/unisolate · use · php:list · php:install/php:uninstall（R7）· status/restart [site]（R8）· logs · open <site>（R9 v2，site 必填）· start [site] / stop [site]（R8，无参 = 全栈，无 --all）· edit · new · doctor/uninstall，全支持 --json；use 另接受 php@<v> 别名（CLI 侧归一化；chip 只渲染 canonical 形，别名永不进 UI）；裸 `corral` = 帮助文本）；**完整形按动词族拆分（R8/R9 v2 落盘终态，chips 锁定）**：open/start/stop/restart = 显式站点名形（无 cwd 缺省推断）；link/secure/isolate/logs/unlink = cwd 形（`cd <path> && corral <cmd>`）
- 错误面板：20px 类型图标 + 定位 + CommandChip + 修复动作；E1 circle-alert / E2 key / E3a wifi-off / E3b shield-alert / error toast = circle-alert 16px（USAGE_ERROR 复用）；**retryable 由 daemon 判定（NETWORK_ERROR=true，CHECKSUM_MISMATCH=false）**，UI 按信封 retryable 决定是否给 [Retry]；10 错误码映射见 DESIGN.md §9.4（R11：+USAGE_ERROR / SITE_NOT_FOUND）
- Toast 右下 24px，success 4s / error 常驻，同时 ≤1
- 状态五态 enum：running/stopped/starting/error/missing，标签 Running/Stopped/Starting…/Error/Missing（CLI/GUI 同词；missing = parked 目录被删，PRD §8）
- Starting 秒表 10s 超时 → Error + View logs/Retry；禁无限转圈
- 全局横幅态：DAEMON_NOT_RUNNING / CONFIG_INVALID / 首次提权未完成（见 component-states.md §13）
- 全状态矩阵见 component-states.md；图标清单见 icons.md

## 布局锚点

- 主窗口 min 640×480 / default 900×560；标题工具栏 48px；侧导航 200px（<720px 收 60px 图标条）
- **Console dock**：内容区底部 40%（min 160 / max 70），默认打开；折叠 = 28px slim 条；⌃`/Ctrl+` 切换；折叠态与高度存 renderer settings JSON（GUI 本地偏好，窗口尺寸仍走配置文件）；**shell 偏好 = daemon 配置项**（pty 宿主在 daemon，禁落 renderer settings——CLI 起的会话要读；MVP 改配置文件，v1.1 设置窗口经 RPC 写 daemon 侧）；dock 是 renderer 内部分栏无新壳层窗口；终端栈 = xterm.js（renderer）+ node-pty 宿主 daemon + WS 流通道（127.0.0.1 only + token 鉴权；Logs 实时 tail 复用同通道）（规格 DESIGN.md §4.16，页面 pages/console.md）
- 侧导航 3 项 Sites/PHP/Logs；底部只读 parked 行（ Watching N directories + 路径，mono meta 11px，点击复制 `corral park <dir>` 提示——写入路径只有 CLI + 配置文件）
- 间距 4px 网格；圆角 sm6/md8/lg12（上限）/pill；z：dropdown1000/modal1200/palette1300/toast1400

## 文案锚点（关键串，全量见 pages/*.md）

- 空状态：「No sites linked yet. Run `corral link` inside a project folder and it shows up here instantly.」
- 切换 PHP：「Now using PHP 8.4 in terminal and new sites.」
- 复制：「Copied `{command}`」
- 卸载确认：「Uninstall PHP {version}? Sites pinned to it will stop working until you reinstall.」

## 页面清单

- pages/sites.md — Sites 视图（站点列表核心循环）
- pages/php.md — PHP 视图（全局切换 + 安装/卸载 + 进度/失败双型）
- pages/logs.md — Logs 视图（站点选择 + tail + Copy all + Reveal file）
- pages/console.md — Console 底部 dock（集成终端，默认打开 40%）
- pages/command-palette.md — ⌘K 面板
- （v1.1 预留：托盘/菜单栏面板 400px，设计存档于 Phase 1 报告 v0.1 §9 表面 A）

## 变更记录

| 日期 | 变更 | 原因 | 影响范围 |
|---|---|---|---|
| 2026-10-26 | v1.0 建立 | Phase 2 立项，PRD 范围裁决 + 架构栈锁定并入 | 全部 |
| 2026-10-26 | v1.1 同步：R3 托盘最小菜单进 MVP / 统一 CLI 命令表为命令 chip 唯一权威 / 五态（+missing）/ 错误契约 retryable 映射 / 版本锚定（Electron 45、Tailwind v4、lucide 1.61.0）/ Tailwind v4 CSS-first 配置 | Phase 1 文档终检（consistency-check.md R1-R6 + 架构师 lucide 实证） | 全部 |
| 2026-10-26 | v1.2：+Console 底部 dock（team-lead 裁决：默认打开 40%、⌃` 折叠、Open in system terminal 逃生钮）/ R7 `php:install/php:uninstall` 进命令表（PHP 视图 chip 解禁）/ `use` 接受 `php@<v` 别名 / 驱动口径 Laravel 首选 + generic 兜底（Symfony/WordPress v1.x）/ 日志 MVP 范围 = tail + auto-tail + Copy all + Reveal file（级别过滤 v1.1）/ 交付物归档至 docs/design/ | team-lead 四项裁决 + consistency-check R7 + 权威路径收敛 | 全部 |
| 2026-10-26 | v1.3：终端栈锁定（xterm.js + node-pty 宿主 daemon + WS 流通道，Logs tail 复用；dock 几何归 renderer settings JSON）/ `corral open <site>` 语义钉死（无参 = 用法错误，CLI 不开 GUI 窗口）/ start/stop 动词裁决（§3 回执已交付，R8/R9/R11 锁定）/ `corral edit [site]` 语义 / chip 完整形按动词族拆分 | 架构师四项裁决回执 | 全部 |
| 2026-10-26 | v1.4：命令终态锁定（consistency-check §2 R8/R9 v2/R10 落盘）——start/stop/restart [site] 入表、无 --all 旗标、无 cwd 缺省推断、裸 corral = 帮助、行级 Restart chip 解锁；过渡措辞（预对齐/待回执）全清；shell 探测链 = pwsh → powershell.exe → cmd | 总监 R8/R9 v2 裁决 + 架构师终态便签 | 全部 |
| 2026-10-26 | v1.5：R11 错误码 8→10（+USAGE_ERROR：常驻 error toast + 正确用法 hint + 完整形 chip；+SITE_NOT_FOUND：SiteRow Error 行态 + `corral status` chip）——「GUI 教 CLI」落地错误态；icons.md 补 error toast 图标位（circle-alert 16px） | 总监 R11 错误码补行 | 全部 |
| 2026-10-26 | v1.6：shell 偏好归 daemon 配置项（数据层边界：pty 宿主在 daemon，禁落 renderer settings——CLI 起的 Console 会话要读；MVP 改配置文件 / v1.1 经 RPC）；shell 链补全第三跳 cmd.exe；alias 纪律收紧（chip 只渲染 canonical `corral use <v>`，php@<v> 永不进 UI） | 架构师 §3 回执两处边界确认 | 全部 |

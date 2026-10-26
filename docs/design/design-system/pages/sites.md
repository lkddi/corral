# 页面：Sites（站点列表 · 核心循环）

> 路由/表面：主窗口内容区默认视图 | 版本 v1.4 | 2026-10-26
> Master + Overrides：本文件只写与 MASTER.md 的差异与页面专属细节
> v1.1：+驱动检测口径（team-lead 裁决：Laravel 首选 / generic 兜底 / Symfony+WordPress v1.x）；Name tooltip 带驱动信息
> v1.2：chip 形式按动词族拆分（open/start/stop/restart = 显式站点名形，R8/R9 v2 落盘锁定）；Missing 态修复入口口径（自动恢复 + Unlink）
> v1.3：start/stop/restart chip 形转锁定态（R8 落盘：无 --all、无 cwd 推断；restart [site] 行级 chip 解锁）
> v1.4：+SITE_NOT_FOUND 竞态行指引（R11）

## 布局

- 工具栏（高 48px）：左 = 搜索框（320px，16px `search` 行内图标，placeholder "Search sites…"，⌘F/⌃F 聚焦）；右 = **[Link a folder…]** Primary 钮（16px `link` 图标 + 文字）
- 表头行（高 32px，`--text-sm` `--muted`）：Name / Domain / PHP / Status / HTTPS /（hover 时才出现的操作列头留白）
- 站点行列表：行高 40px，行间 1px `--border-soft` 分隔，**不用卡片盒子**
- 底部 watched-directories 行（高 28px，`--meta` 11px mono）：「Watching 2 directories · ~/Herd · ~/Code」+ 末尾 "Manage with `corral park <dir>` / `corral unpark <dir>`"（点击复制；写入路径只有 CLI + 配置文件）
- **100+ 站点**：列表虚拟化（视口渲染），搜索过滤在虚拟层之上
- **全局横幅位**（窗口顶部，component-states.md §13）：daemon 不可达 / 配置无效 / 首次提权未完成

## 核心组件与状态

- **SiteRow**（矩阵见 component-states.md §1）：列序 Name / Domain / PHP / Status / HTTPS
  - Name：`--text-base`/500，超长 ellipsis + tooltip（tooltip = `{name} · {driver} driver`，如 "my-app · Laravel driver"；驱动自动检测，Laravel 首选，generic 兜底，Symfony/WordPress = v1.x——MVP 无 Driver 列，I4 最小面，驱动信息只在 tooltip）
  - Domain：mono `--text-base`（如 `my-app.test`）
  - PHP：Badge（mono `--text-xs`；与全局版本不同 = pinned，Badge 加 1px `--badge-border` 区分，不用彩色）
  - Status：6px 点 + 文字（Running/Stopped/Starting… (Ns)/Error）
  - HTTPS：secured = 16px `lock`（`--fg-2`）+ tooltip "Secured with local CA"；未 secured = `—`（mono `--meta`）
- **行操作**（hover 浮现，20px 图标 + 28×28 命中）：Open（`external-link`，stopped/starting 时禁用 + tooltip）/ Logs（`file-text`）/ More（`ellipsis`）
- **More 菜单**（右键或点击 More，`--surface` + `--elev-panel` + `--radius-md`，项高 32px）：
  Secure with HTTPS（`shield-check`；已 secured → checkmark + 文案 "Secured"）/ Pin PHP version（`pin`，子菜单列已装版本，当前 pin 项 checkmark）/ Restart（`rotate-cw`）/ Stop（`square`，stopped 时禁用）/ Start（`play`，running 时禁用）/ Copy CLI command（`copy`）
  （**chip 形式按动词族拆分（R8/R9 v2 落盘终态，chips 锁定）**：Restart chip = `corral restart my-app`（restart [site] 已入表，行级 chip 解锁）；Start chip = `corral start my-app` / Stop chip = `corral stop my-app`（无参 = 全栈启停；无 `--all` 旗标、无 cwd 缺省推断）；link 系保持 cwd 形：Secure chip = `cd <path> && corral secure`，Pin chip = `cd <path> && corral isolate <v>`）
- **错误面板**（click Error 行展开，行下 44px 内联区或右侧 drawer——MVP 用行下展开）：
  - E1 端口占用：`circle-alert` danger 20px + "Port 80 is already used by **nginx (PID 4821)**. Stop that process, or link this site on another port." + CommandChip `cd <path> && corral link --port=8080` + [Copy command] + [View logs]（平台感知：macOS 附 `sudo nginx -s stop`，Windows 附 `net stop` 变体；PORT_CONFLICT，retryable=true——释放端口后给 [Retry]）
  - SITE_NOT_FOUND（daemon 回报指定站点不存在——并发 unlink 竞态，PRD §8）：行内摘要 "{name} not found"；展开 = 提示核对站点名 + `corral status` chip 引导查看可用站点（retryable=false，无 [Retry]；R11 映射）
  - Missing 态行：click 不展开错误面板，tooltip "The folder for {name} no longer exists. It comes back if the folder returns."；**修复入口 = More 菜单 Unlink**（删除失效注册）；路径恢复后 daemon 自动转回 running（架构师裁决：missing 五态锁定，行不得静默消失）
- **空状态**（24px `link` 图标 + 标题 + 正文 + 动作）：
  标题："No sites linked yet"
  正文："Run `corral link` inside a project folder and it shows up here instantly."
  动作：[Copy command]（复制 `corral link`）+ [Link a folder…]（Primary）
- **搜索无结果**：行内空态 "No sites match "{query}". Try `corral link` in the project folder." + [Clear search]
- **骨架屏**（首屏）：3 个骨架行（sunken 块 + radius-sm + 1.2s 低强度脉冲；reduced-motion 静态）

## 交互

- click 行 = 选中（accent-subtle）；↵ = Open；右键 = More 菜单；⌘K = 命令面板
- Start/Stop/Restart → 立即改行状态（乐观 UI，daemon 事件校正）+ toast 回执
- Link a folder… → 系统文件夹选择器 → **驱动自动检测**（Laravel 首选默认驱动；generic/static 兜底保证任意目录能上线；Symfony/WordPress 驱动 v1.x 社区化）→ 选中后调 `corral link` 同逻辑 → 新行以 Starting→Running 进入列表 + toast "Linked {name}.test"
- Copy CLI command → CommandChip 复制（注册表模板）→ toast "Copied `{command}`"

## 键盘

⌘F/⌃F 聚焦搜索 · ↑↓ 行导航 · ↵ 打开 · esc 清除搜索/取消选中 · ⌘K 面板 · Shift+F10 行上下文菜单

## 响应式（窗口缩放）

<720px：侧导航收图标条（60px），表格列宽压缩，Domain 列优先保留；搜索框缩至 200px；操作钮组不变。

## 文案 deck（本页全部字符串）

见上（空状态/无结果/E1/toast）。toast 集："Started {domain}." / "Stopped {domain}." / "Restarted {domain}." / "Linked {name}.test." / "Replaced the existing link for {name}."（SITE_EXISTS 覆盖提示，PRD §8）/ "This site was changed from the terminal. Showing the latest state."（并发外部变更）/ "Copied `{command}`"

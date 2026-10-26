# Corral DESIGN.md — 项目级设计契约

> 生成日期：2026-10-26 | 设计师：颜好看 | 版本：v1.6（Phase 2 · R3 托盘 MVP / Console dock / R7 命令表 / R8·R9v2 命令终态 / R11 错误码 10 个 / shell 配置数据层边界）
> 基于：PRD（PM 终稿，范围裁决已并入）+ 架构 Spec 要点（Electron + React + TS + Tailwind + lucide-react）
> 三轴刻度：DESIGN_VARIANCE=3（可预测）/ MOTION_INTENSITY=3（功能动效）/ VISUAL_DENSITY=6（紧凑工具）
> 设计寄存器：**Product**（标杆是赢得熟悉感——TablePlus / Raycast / Linear 的熟手用户坐下即信）
> 平台轴：双桌面（macOS + Windows），同一套 React 组件 + 同一套 Token，差异仅在外壳行为
> UI 语言：**英文**（man page 语气：动词开头、短句、可执行）
> 命名状态：Corral（PRD §12 需总监最终确认，确认前全局按 Corral 推进）

---

## 1. Visual Theme & Atmosphere（视觉主题与氛围）

**主题关键词**：安静、精准、快速、高信噪比、终端原生

**氛围描述**：一个住在终端里的工具长出的窗口。用户打开 Corral 的 3 秒内要能回答三个问题：我的站点在跑吗？现在全局是什么 PHP 版本？服务正常吗？界面像一台调试良好的仪器——中性色承担几乎全部视觉重量，一个 Teal 强调色只出现在「当前选中」和「主操作」两个位置，状态用圆点 + 文字双编码，所有数据（域名/版本/端口/命令）一律等宽字体。深色代码面（日志、命令 chip）在两个主题下都保持深色，让终端用户在任何模式下都有熟悉的落脚点。

**对标品牌**：
- **TablePlus**（主对标）——原生桌面工具的完成度标杆：sparse UI、快捷键优先、主题跟随系统、颜色编码降低误操作
- **Raycast**（次对标）——常驻效率工具的情绪标杆：毫秒响应、键盘优先、零装饰
- **Laravel Herd**（架构对标）——菜单栏面板信息架构直接对标（v1.1 fast-follow 复用），在其付费墙与 Windows 短板上做差异化
- **Laragon**（Windows 侧参考）——托盘右键 + 服务行密度范式

**产品姿态**：GUI 是 daemon 的「取景器」，不是控制器。daemon 常驻持有唯一配置源；GUI 关闭不停服；任何 GUI 可见状态都能被 CLI 等价查询（CLI/GUI 对等，无「仅 GUI 可见」状态）。

---

## 2. Color Palette & Roles（色彩与角色）

### 2.1 A1-identity（浅色默认 `:root`）

| Token | 值 | 角色 |
|---|---|---|
| `--bg` | `#F7F8FA` | 窗口/面板底（极轻冷蓝灰，非纯白减刺眼） |
| `--surface` | `#FFFFFF` | 卡片/行悬浮/弹层底 |
| `--fg` | `#1A1D24` | 主文本（非纯黑），对 bg 15.1:1 |
| `--muted` | `#646B7A` | 副文本，对 bg 4.9:1 |
| `--accent` | `#0F766E` | teal-700，对白 5.4:1。按钮底/链接/选中文字 |
| `--border` | `#DFE2E8` | 默认边框 |

### 2.2 Accent 派生（A2）

| Token | 浅色 | 深色 |
|---|---|---|
| `--accent-hover` | `#115E59` | `#5EEAD4` |
| `--accent-active` | `#134E4A` | `#99F6E4` |
| `--accent-on` | `#FFFFFF` | `#052E2B` |
| `--accent-subtle` | `#D9F0EC` | `rgba(45,212,191,0.12)` |
| `--accent-strong` | `#0B5E58` | `#5EEAD4` |

**深色 accent 主值 `#2DD4BF`（teal-400，对 surface 9.4:1）；深色下 hover 变亮（与浅色相反）。**

### 2.3 A2 语义色

| Token | 浅色 | 深色 | 纪律 |
|---|---|---|---|
| `--success` | `#16A34A` | `#3FB950` | **只做 6px 状态点/图标/徽章边框**，上白底 3.3:1 禁作文字 |
| `--warn` | `#D97706` | `#D29922` | 同上（点/图标专用） |
| `--warn-text` | `#B45309` | `#D29922` | warn 的文字变体，5.0:1 |
| `--danger` | `#DC2626` | `#F85149` | 错误/危险，4.8:1 可作文字 |
| `--info` | `#0369A1` | `#58A6FF` | 信息提示 |

### 2.4 B-slot 别名

| Token | 浅色 | 深色 | 角色 |
|---|---|---|---|
| `--fg-2` | `#3D434F` | `#B9C2CF` | 次级文本 |
| `--meta` | `#6E7684` | `#7D8697` | 三级元数据，对 surface 4.6:1 |
| `--surface-sunken` | `#EEF0F4` | `#1A2029` | 三级表面：分组底/输入框/骨架屏 |
| `--border-soft` | `#EDEFF3` | `rgba(255,255,255,0.05)` | 行分隔线 |
| `--badge-bg/fg/border` | 继承 sunken/fg-2/border | 同 | PHP 版本徽章三件套 |

### 2.5 C-extension 终端品牌色（范围化纪律）

| Token | 值 | 纪律 |
|---|---|---|
| `--terminal-green` | `#22C55E` | **仅允许出现在 `--code-bg` 深色代码面上**（命令 chip、代码块、日志窗、wordmark pill）。禁止作为 UI 强调色，禁止上浅色底（2.5:1 不达标） |
| `--code-bg` | `#0E1116` / 深色主题 `#0A0D12` | 代码/命令/日志面，**两个主题下均为深色**（IDE 惯例） |
| `--code-fg` | `#D6DEE8` | 代码面正文 |

### 2.6 每屏 accent 规则（两角色制）

accent 只出现在两个角色：**① 当前选中态**（选中站点行、当前 PHP 分段、当前日志站点）**② 主操作按钮**（Link a folder、Install、Start/Stop 主操作、进度条）。永不装饰性使用。语义色（success/warn/danger）不计入 accent 预算，但只做点/图标/边框。

### 2.7 选色理由存档

Teal 而非 PRD 初版的靛蓝：① 语义冲突——产品核心职责是展示服务状态，绿 accent 与绿「Running」同屏混色属 UX 正确性问题；② 靛蓝 #6366F1 是业界公认 AI 模板首罪色，差异化定位不该长成模板脸；③ Teal 与 success 绿色相相距足够（偏蓝 vs 偏黄绿），同屏不混。PM 已批准定稿（撤回靛蓝建议）。

---

## 3. Typography（排版）

### 3.1 字体栈

```css
--font-ui:   "Fira Sans", "Noto Sans SC", -apple-system, "PingFang SC",
             "Microsoft YaHei", sans-serif;
--font-mono: "Fira Code", "JetBrains Mono", "SF Mono", "Cascadia Code",
             Consolas, monospace;
```

- Fira Sans 400/500/600 三字重 + Fira Code 400/500 两字重，woff2 随 renderer 经 Vite 打包（约 150-250KB），**禁止 CDN webfont（离线优先工具）**
- 中文 fallback 保留在栈中（i18n 就绪），MVP 英文界面不启用
- 走 typography-pairings.md 第 25 套「Dashboard Data」，绕开反射拒绝清单（Inter 不作展示字 / DM Sans / Space Grotesk / IBM Plex / Plus Jakarta Sans / Outfit 全部拒绝）

### 3.2 字号阶梯（8 级，桌面紧凑 UI）

| Token | px | 用途 |
|---|---|---|
| `--text-xs` | 11 | Badge、版本号、时间戳（mono） |
| `--text-sm` | 12 | 辅助说明、端口、meta |
| `--text-md` | 13 | 面板次级行文 |
| `--text-base` | 14 | 正文/列表行/表单 |
| `--text-lg` | 16 | 区块标题 |
| `--text-xl` | 18 | 页标题 |
| `--text-2xl` | 22 | 弹层标题 |
| `--text-3xl` | 28 | 空状态引导标题 |

### 3.3 字重 / 字距 / 行高

- 字重三级：Read 400（正文）/ Emphasize 500（小标题、按钮）/ Announce 600（页标题）
- 字距：正文 0；域名/版本号/端口/命令（mono）0；ALL CAPS 标签 ≥0.06em；标题 -0.01em
- 行高：正文 1.5 / 列表行 1.4 / 标题 1.2
- **等宽强制场景**：域名、PHP/Node 版本号、端口、路径、CLI 命令、`php -v` 输出、日志行、秒表数字；表格数字 `font-variant-numeric: tabular-nums`

---

## 4. Components（组件规范）

> 图标全部 Lucide（架构师已锁定，ISC，24×24 网格 / 2px outline），清单与 tooltip 文案见 `design-system/icons.md`。尺寸：16px 行内 / 20px 按钮与导航 / 24px 空状态。纯图标按钮必须 `aria-label` + tooltip；伴随可见文字的图标 `aria-hidden` 即可。**状态点不是图标**：五态用 6px CSS 圆点 + 文字双编码。

### 4.1 按钮

| 变体 | 底 | 字 | 圆角 | 内边距 | 字号 |
|---|---|---|---|---|---|
| Primary | `--accent` | `--accent-on` | `--radius-sm` | 8px 14px | `--text-base`/500 |
| Secondary | transparent + 1px `--border` | `--fg` | `--radius-sm` | 8px 14px | `--text-base`/500 |
| Ghost | transparent | `--fg-2` | `--radius-sm` | 8px 10px | `--text-sm`/500 |
| Danger | `--danger` | `#fff` | `--radius-sm` | 8px 14px | `--text-base`/500 |

状态：default / hover（bg 换 `--accent-hover` 等，120ms）/ focus-visible（`--focus-ring`）/ active（`--accent-active`，按下即反馈）/ disabled（opacity 0.5，cursor not-allowed，禁 hover 效果）/ loading（按钮内 16px `loader-circle` + 文字保留，宽度防抖动）。

### 4.2 图标按钮（行内操作，28×28 命中区）

20px 图标居中，透明底，hover 出 `--surface-sunken` 圆底，focus-visible 出环。行内 Open / Logs / More、错误面板动作均此规格。禁用态 opacity 0.5。

### 4.3 站点行（SiteRow，核心组件）

- 行高 40px，列序（PRD I4）：**Name / Domain / PHP / Status / HTTPS**；hover 时行尾浮现操作图标钮组；整行 click = 选中（选中行 `--accent-subtle` 底 + `--accent-strong` 字）
- Domain 列 mono `--text-base`；PHP 列 Badge（`--badge-bg` 底 + mono `--text-xs`）；Status 列 6px 点 + 文字；HTTPS 列 lock 图标（secured）或 `—`（mono meta）
- 状态五态（PRD §8 边界 + I4 运行状态列）：Running（success 实心点 + "Running"）/ Stopped（meta 空心点 + "Stopped"）/ Starting（warn 点 + 脉冲 + "Starting… (Ns)" 秒表）/ Error（danger 点 + "Error" + 行内摘要）/ **Missing**（meta 空心点 + "Missing" + 整行变暗——parked 目录被删，站点标记失效而非静默消失，PRD §8 明文；`missing` 需 daemon 枚举扩展，已提 Spec，见 §9.4）
- 右键行 = 上下文菜单（More 菜单同内容，键盘 Shift+F10 可达）

### 4.4 More 菜单（行操作）

菜单项 20px 图标 + 文字 + 右侧快捷键提示（如有）：Secure with HTTPS（`shield-check`，已 secured 时显示 checkmark + 文案变 "Secured"）/ Pin PHP version（`pin`）/ Restart（`rotate-cw`）/ Stop|Start（`square`|`play`）/ Copy CLI command（`copy`）。菜单面板 `--surface` 底 + `--elev-panel` + `--radius-md`，项高 32px。

### 4.5 分段控件（Segmented，全局 PHP 切换）

`--surface-sunken` 底圆角容器，段间 2px 间隙；选中段 `--surface` 底 + `--elev-ring` + `--fg` 文字；未选中 `--muted` 文字。段内版本号 mono。切换 = 即时生效 + toast 回执。标题工具栏常驻（已装版本 ≤4 时全显，>4 时显当前值 + 箭头跳 PHP 页）。

### 4.6 Badge（PHP 版本 / HTTPS / Default）

`--badge-bg` 底 + `--badge-fg` 字 + 1px `--badge-border` + `--radius-sm` + mono `--text-xs` + padding 2px 6px。Default 徽章同款（文字 "Default"）。

### 4.7 命令芯片（CommandChip）—「GUI 教 CLI」的核心组件

mono `--text-sm` 命令字符串（如 `corral restart my-app`）+ 右侧 16px `copy` 图标按钮；底 `--badge-bg`（或 `--code-bg` 深色变体用于 ⌘K 面板右侧）。**命令字符串必须从 daemon 的 shared/commands.ts 注册表模板渲染，禁止组件内手写**（CLI/GUI 同源的 UI 落地）。点击复制 → toast "Copied `corral restart my-app`"。

### 4.8 命令面板（⌘K / Ctrl+K）

560px 宽顶部居中浮层，`--surface` 底 + `--elev-panel` + `--radius-lg` + `--z-palette`。输入框（16px `search` 行内图标 + placeholder "Search sites and actions…"）+ 分组结果（Sites 带状态点 / Actions）。结果行高 36px：20px 图标 + 名称 + 右侧 CommandChip。底部提示行：`corner-down-left` "run" · ↑↓ "navigate" · esc "close"（`--meta` 12px）。

### 4.9 进度条（PHP 下载）

高 4px 圆角轨道（`--surface-sunken`）+ 填充 `--accent`（此场景 = 当前主操作角色）；旁文案 mono tabular："42% · 3.2 MB/s · ~18s left" + `x` 图标钮 Cancel。确定性进度（有总量），禁无限转圈。

### 4.10 错误面板（E1/E2/E3，行内展开）

`--surface` 底 + 1px `--border` + `--radius-md`；头部 20px 图标（E1 `circle-alert` danger / E2 `key` warn / E3a `wifi-off` danger / E3b `shield-alert` danger）+ 标题；正文 `--text-sm` `--fg-2`；动作行：CommandChip + [Copy command]/[Copy steps] + [View logs] / [Retry] / [Report issue]。文案见 `pages/*.md`。

### 4.11 Toast

窗口右下角，距边 24px，`--surface` + `--elev-panel` + `--radius-md`，16px 图标 + `--text-sm` 文字；success 4s 自动消失，error 常驻至手动关闭；同时最多 1 条（排队）。`--z-toast`。

### 4.12 空状态（EmptyState）

24px 图标（`--meta` 色）+ `--text-2xl` 标题 + `--text-base` `--muted` 正文 + 动作组。Sites 空状态文案见 `pages/sites.md`。

### 4.13 骨架屏（Skeleton）

首屏加载：3 个骨架行（`--surface-sunken` 块 + `--radius-sm`），1.2s 低强度透明度脉冲；reduced-motion 下降级静态。窗口出现即渲染骨架（窗口本身就是加载态，禁「应用加载中」阻塞屏）。

### 4.14 原生菜单与托盘（MVP 最小 · R3 裁定）

**原生菜单**（macOS 应用菜单 / Windows 窗口菜单，text-only 平台原生项，由 Electron main 进程构建，不用 Lucide）：主题子菜单（System / Light / Dark，radio 语义）/ Start at Login（checkmark 开关）/ Edit configuration…（打开配置文件进默认编辑器，`corral edit` 等价）/ Star on GitHub（打开仓库，埋点 star_clicked）/ About Corral / Quit（⌘Q / Ctrl+Q）。

**托盘图标 + 最小原生菜单**（R3：留 MVP，成本低且满足「常驻」）：静态单色 template 图标（16/18px 两档，壳层资源目录，品牌美术资产豁免 Lucide 锁定）；tooltip 显示状态摘要（如 "Corral — 3 of 4 sites running"）；菜单 = Open Corral / Quit（text-only，main 进程构建，菜单状态由 daemon 推送）。**alpha 变体状态图标语言（实心/半透明/描边）与富面板移 v1.1**（Phase 1 报告 v0.1 §9 表面 A 已存档完整面板设计可直接复用）。

### 4.15 窗口外壳

| 平台 | 行为 |
|---|---|
| 双端 | frame:false 自绘标题栏；`backgroundColor` 按主题设为 `#F7F8FA`/`#0E1116`（**防 1-3s 冷开白闪**）；min 640×480，default 900×560；尺寸位置记忆进配置文件（可审计） |
| macOS | `titleBarStyle: 'hiddenInset'`，红绿灯 inset 16px，工具栏内容从 x=80px 起 |
| Windows | 自定义标题栏右侧最小化/最大化/关闭（28×28 命中区） |
| 语义 | 关窗 = 关窗口（daemon 不停服）；重开 = `corral open` / dock / 开始菜单 / 托盘 Open。**MVP 含托盘图标 + 最小菜单**（R3）；富面板 v1.1 |

### 4.16 Console dock（底部集成终端 · team-lead 2026-10-26 裁决）

Zellij 式底部 dock，**默认打开**（内容区高 40%，`--console-dock-h`，min 160px / max 70%），⌃`/Ctrl+` 折叠为 28px slim 条（折叠状态与 dock 高度存 **renderer settings JSON**——GUI 本地偏好，架构师裁决；窗口尺寸位置仍走配置文件，两者分流；**shell 偏好属 daemon 配置项**——pty 宿主在 daemon，禁落 renderer settings，视图偏好与数据层配置不混存）。dock 头 32px：`square-terminal` 16px + "Console" + cwd mono 标签（spawn 时工作目录，ellipsis + tooltip，不跟踪 cd）+ 右侧 [Open in system terminal]（ghost，`external-link` 16px）+ 折叠钮（`chevron-down`，aria "Hide console"）。终端面 = `--code-bg` 深色（两主题皆深，与日志窗同表面语言）+ mono `--text-sm`，超长行横滚禁 wrap。**终端栈（架构师锁定）**：xterm.js（renderer 终端模拟）+ node-pty 宿主 = daemon（独立 Node 24.22.0，ABI 匹配，原生模块不进 Electron main）+ pty 字节流走 daemon WS 流通道（127.0.0.1 only + token 鉴权，与 RPC TCP 控制通道分端口）；Logs 视图实时 tail 复用同一通道（无文件轮询）。spawn cwd = Sites 当前选中站点目录或 home，**不跟随选区变化自动重启 shell**。[Open in system terminal] 是 OS 级动作、无 corral 命令等价，不渲染 CommandChip。dock 为 renderer 内部分栏，无新壳层窗口（区别于 v1.1 托盘富面板的独立 BrowserWindow）。完整规范见 `design-system/pages/console.md`，状态矩阵见 `design-system/component-states.md` §14。

---

## 5. Layout & Spacing（布局与间距）

### 5.1 主窗口结构（MVP 唯一核心表面）

```
┌──────────────────────────────────────────────────────────────┐
│ 标题工具栏 48px：wordmark pill + 全局 PHP 分段 + 搜索框        │
├─────────────┬────────────────────────────────────────────────┤
│ 侧导航 200px │ 内容区（Sites / PHP / Logs 三视图，flex-1）     │
│  Sites      ├────────────────────────────────────────────────┤
│  PHP        │ Console dock 40%（默认打开；⌃` 折叠为 28px 条） │
│  Logs       │ $ corral status …                               │
│             │                                                  │
│ （底部）    │                                                  │
│  主题指示   │                                                  │
└─────────────┴────────────────────────────────────────────────┘
```

- 侧导航 3 项（≤5 防过载）：Sites / PHP / Logs，项高 36px，20px 图标 + 14px 文字；选中项 `--accent-subtle` 底 + `--accent-strong` 字
- **Console 是底部 dock 不是侧导航项**（R2 三视图不变）：dock 高 = 内容区 40%（min 160px / max 70%），折叠态 28px slim 条；⌃`/Ctrl+` 切换，折叠状态与 dock 高度存 renderer settings JSON（GUI 本地偏好，窗口尺寸仍走配置文件）；规格见 §4.16，页面提示词见 `pages/console.md`
- 导航底部：只读 parked 目录可见性行（PM 批准近零成本项）：`--meta` 11px mono "Watching 2 directories · ~/Herd · ~/Code"，点击复制 `corral park <dir>` 提示——**只读，写入路径只有 CLI + 配置文件（阿伟可审计）**
- 内容区内边距 24px；区块间距 24px；窗口可缩放，内容流式（无横向滚动）

### 5.2 间距纪律

4px 网格：4/8/12/16/20/24/32/40/48/64。禁 5/7/13/15/22/30 等非标值。行内紧凑（密度 6）：图标-文字 8px，行操作间距 4px。

### 5.3 Sites 视图布局

工具栏（搜索框 + [Link a folder…] primary 钮）→ 表头行（`--text-sm` `--muted`，列宽同数据行）→ 站点行列表 → 底部 watched-directories 行。无数据 = 空状态（见 pages/sites.md）。**100+ 站点（PRD §8 边界）**：列表虚拟化（只渲染视口行），搜索过滤在虚拟层之上；行高 40px 不变。

### 5.4 响应式策略

桌面工具无移动端。窗口 <720px 时侧导航收为图标条（60px，tooltip 显示文字）；<640px 不允许（min 尺寸）。Console dock 在 <720px 仍保持 40%（侧导航收窄不影响 dock）。**v1.1 托盘面板 400px 宽设计已在 v0.1 存档，届时单独出页面提示词。**

---

## 6. Depth & Elevation（深度与层级）

| Token | 浅色 | 深色 | 用途 |
|---|---|---|---|
| `--elev-flat` | none | none | 行/列表（用 1px `--border-soft` 分隔，不用卡片盒子堆叠） |
| `--elev-ring` | 1px border 环 | 1px 白色 6% 环 | 分段选中段、输入框 |
| `--elev-raised` | 双层柔和阴影 | **none** | 浅色 toast/菜单；深色用亮度递进代替阴影 |
| `--elev-panel` | border + 32px 大扩散 | border + 32px 黑扩散 | 浮层（⌘K 面板、错误面板、菜单） |

**深色模式层级靠亮度递进**：bg #0E1116 → surface #151A21 → sunken #1A2029，禁阴影。z-index：base 0 / sticky 100 / dropdown 1000 / modal 1200 / palette 1300 / toast 1400。**默认毛玻璃禁令**：MVP 全项目零 vibrancy/零装饰性模糊（托盘面板 v1.1 若用需功能目的 + Reduce Transparency 测试）。

---

## 7. Do's & Don'ts（设计守则）

### DO — 应该做的

1. 每个服务操作旁渲染等价 CLI 命令（CommandChip，注册表模板渲染）——「CLI 可脚本化」的 UI 落地
2. 状态五态全部点 + 文字双编码；任何等待都有出口（Starting 秒表 10s 超时转 Error + View logs/Retry）
3. 错误信息像编译器输出：现象 + 定位（进程名/PID/文件）+ 一条可复制的修复命令
4. 域名/版本/端口/路径/命令/日志一律 mono；数字 tabular-nums
5. accent 只用两角色（当前选中 + 主操作）；语义色只做点/图标/边框
6. 空状态教真实命令（`corral link`），按钮是快捷方式不是 CLI 替代品
7. 键盘全可达：⌘K 全操作、↑↓+↵ 列表、esc 关闭、focus-visible 环全项目统一
8. 深色代码面两个主题都深——终端用户任何模式都有熟悉落脚点

### DON'T — 不应该做的

1. **禁 emoji 作功能图标**（P0）——全 Lucide，16/20/24px 三档
2. **禁紫→粉渐变主视觉**（P0）——teal 纯色单色系，零渐变；禁渐变文字
3. **禁空洞占位**（P0）——无 "Welcome to" / "Lorem ipsum" / "Get started"；无虚构指标（"10,000+ users"）
4. **禁硬编码色值**（P0）——组件内只出现 Token（唯一例外 #fff/#000 美术资源内部）
5. 禁彩色左边框卡片（>1px border-left/right 强调）——选中态用整行 accent-subtle 底
6. 禁 ≥24px 圆角与装饰性毛玻璃/发光边框；卡片圆角上限 12px
7. 禁纯黑 #000 / 纯灰直出；禁 Tailwind 默认靛蓝 #6366F1 作 accent
8. 禁「仅 GUI 可见」状态——GUI 每个状态必须有 CLI 等价查询（daemon 同源天然成立，UI 不得发明 GUI 独有概念）；**禁发明 CLI 命令语法**——GUI 渲染的命令字符串唯一来源 = consistency-check.md §3 统一命令表 + shared/commands.ts 注册表模板，表中没有的动作（如 PHP 版本安装/卸载的 CLI 形）先提 Spec 补条目，禁自行编造
9. 禁无限转圈——所有等待有秒表/进度/超时/出口
10. 禁每节小型大写追踪标签 / 编号 section 标记 / 千篇一律 Hero 卡片网格（AI 语法）

---

## 8. Responsive & Accessibility（响应式与无障碍）

### 8.1 响应式（桌面特化）

- 断点行为：窗口宽 ≥720px 完整侧导航（200px）；<720px 侧导航收图标条（60px + tooltip）；min 640×480 硬限
- 窗口缩放内容流式，无横向滚动；表格列宽比例固定，Domain 列可截断（ellipsis + tooltip 全域名）
- 触摸目标按桌面鼠标规格：图标钮 28×28 命中区（20px 图标），间距 ≥4px；触屏设备不属 MVP 目标

### 8.2 无障碍基线（PRD P2：WCAG 2.1 AA 基本）

**对比度实测（浅色主题）**：

| 前景/背景 | 比值 | 用途 |
|---|---|---|
| fg #1A1D24 / bg #F7F8FA | 15.1:1 | 正文 |
| muted #646B7A / bg #F7F8FA | 4.9:1 | 副文本 |
| meta #6E7684 / surface #FFFFFF | 4.6:1 | 元数据 |
| accent #0F766E / surface #FFFFFF | 5.4:1 | 链接/选中文字 |
| accent-strong #0B5E58 / accent-subtle #D9F0EC | 6.4:1 | 选中行文字 |
| warn-text #B45309 / surface | 5.0:1 | warn 文字 |
| danger #DC2626 / surface | 4.8:1 | 错误文字 |
| terminal-green #22C55E / code-bg #0E1116 | 8.3:1 | 命令 chip 文字 |
| muted #8A94A3 / surface #151A21（深色） | 5.7:1 | 深色副文本 |
| accent #2DD4BF / surface #151A21（深色） | 9.4:1 | 深色链接/选中 |

success/warn 原值**只做点/图标**（文字不达标），状态文字用 `--fg`。

**键盘与焦点**：⌘K/⌃K 面板、⌘F/⌃F 搜索、↑↓ 列表导航、↵ 打开、esc 关闭/清除；全交互元素 `:focus-visible` 统一双环（`--focus-ring`）；菜单/浮层焦点圈定（Tab 不出浮层）；图标按钮全部 `aria-label`（文案见 icons.md）。

**动效**：120/180/240ms 三档 + `--ease-standard`；`prefers-reduced-motion: reduce` 全局降级（脉冲/旋转/微光 → 静态，过渡 → 0.01ms）。

**状态双编码**：颜色永不单独承载语义——状态点必配文字标签；HTTPS 用 lock 图标 + tooltip；下载失败双型图标不同（wifi-off vs shield-alert）且文案不同。

### 8.3 五态覆盖标准

每个有状态 UI 必须覆盖：Loading（骨架/进度/秒表）/ Empty（引导 + 真实命令 + 动作）/ Error（具体定位 + 修复命令 + 重试）/ Populated / Edge（超长域名截断 + tooltip、零站点、端口冲突、校验失败）。完整矩阵见 `design-system/component-states.md`。

---

## 9. Agent Implementation Guide（实现指南）

### 9.1 Tailwind 配置（renderer，Tailwind v4.3.3 · CSS-first）

Tailwind v4 无 tailwind.config.js——主题在 CSS 里用 `@theme` 声明。**Token 单一来源仍是 design-tokens.css**；此处用 `@theme inline` 做 Tailwind 工具类别名，双主题切换由 `:root` / `[data-theme="dark"]` 上的 CSS 变量在运行时接管。

```css
/* src/styles/theme.css */
@import "tailwindcss";
@import "./design-tokens.css";

/* 暗色变体按 data-theme 属性（renderer 自治，见 §9.2 第 3 条） */
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-sunken: var(--surface-sunken);
  --color-fg: var(--fg);
  --color-fg-2: var(--fg-2);
  --color-muted: var(--muted);
  --color-meta: var(--meta);
  --color-border: var(--border);
  --color-border-soft: var(--border-soft);
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-accent-active: var(--accent-active);
  --color-accent-on: var(--accent-on);
  --color-accent-subtle: var(--accent-subtle);
  --color-accent-strong: var(--accent-strong);
  --color-success: var(--success);
  --color-warn: var(--warn);
  --color-warn-text: var(--warn-text);
  --color-danger: var(--danger);
  --color-info: var(--info);
  --color-code-bg: var(--code-bg);
  --color-code-fg: var(--code-fg);
  --color-code-border: var(--code-border);
  --color-code-green: var(--terminal-green);
  --font-ui: "Fira Sans", "Noto Sans SC", -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-mono: "Fira Code", "JetBrains Mono", "SF Mono", "Cascadia Code", Consolas, monospace;
  --text-xs: 11px; --text-sm: 12px; --text-md: 13px; --text-base: 14px;
  --text-lg: 16px; --text-xl: 18px; --text-2xl: 22px; --text-3xl: 28px;
  --radius-sm: 6px; --radius-md: 8px; --radius-lg: 12px; --radius-pill: 9999px;
  --shadow-ring: var(--elev-ring);
  --shadow-raised: var(--elev-raised);
  --shadow-panel: var(--elev-panel);
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
}
```

**版本锚定**（consistency-check.md §5 实测，Spec 锁定依据）：electron 45.0.0（45.x）· 随包 Node 24.22.0 · react 19.3.1 · tailwindcss 4.3.3 · **lucide-react 1.61.0（exact pin，叶子依赖，升级走 ADR-lite）**。其余依赖走 pnpm-lock.yaml + CI frozen-lockfile。

### 9.2 Electron 壳层规格（架构师已锁定，设计侧要求）

1. **窗口创建**：`backgroundColor` 按当前主题设为 `#F7F8FA`/`#0E1116`——防冷开白闪；窗口出现即渲染骨架行，禁阻塞式加载屏。性能口径（PRD 非功能修订）：**首屏 <2s（热启动）/ 冷启动 <3s（含拉起 daemon，必须有明确加载态——骨架行 + 状态渐进）**
2. **标题栏**：`frame: false` 自绘；macOS `titleBarStyle: 'hiddenInset'` + trafficLightPosition {x:16,y:16}，工具栏内容 x≥80px；Windows 自绘右侧窗口钮（28×28）
3. **主题同步**：renderer 监听 `matchMedia('(prefers-color-scheme: dark)')` 自主切换 `<html data-theme>`；main 进程 `nativeTheme.themeSource` 同步系统明暗给原生控件（菜单/滚动条）；用户菜单覆盖写配置文件。两层互不覆盖（架构师确认）
4. **原生菜单与托盘**：main 进程构建 text-only（主题 radio / Start at Login checkmark / Edit configuration… / Star on GitHub / About / Quit）；**MVP 托盘** = 静态单色 template 图标（16/18px 两档，壳层资源目录）+ tooltip 状态摘要（"Corral — 3 of 4 sites running"）+ 菜单 Open Corral / Quit；托盘菜单状态由 daemon 推送，renderer 不参与
5. **v1.1 面板窗口预参数**（富面板，当前不实现，存档）：BrowserWindow `frame:false + alwaysOnTop + showInactive(macOS 不抢焦点) + width:400`，blur → hide（点击外部关闭），esc 关闭，同时只开一个

### 9.3 字体与图标落地

- 字体：`src/assets/fonts/` 放 Fira Sans 400/500/600 + Fira Code 400/500 的 woff2，`@font-face` + `font-display: swap`；**禁 CDN**（离线优先）
- 图标：`lucide-react@1.61.0`（exact pin）按需 import（tree-shaking）；`size={16|20|24} strokeWidth={2}`，16px 行内加 `absoluteStrokeWidth`；清单与 aria 文案见 `design-system/icons.md`；规范名（ellipsis / circle-alert / triangle-alert / trash / square-terminal），旧别名 1.61.0 仍可导入但项目禁用

### 9.4 CLI/GUI 同源落地（架构师确认）

- daemon 持唯一配置源；`shared/commands.ts` 注册表每个 RPC 与一条 CLI 命令 1:1（含参数 schema + 命令字符串模板）
- **GUI 所有命令字符串从注册表模板渲染，组件内禁手写**；「Copy CLI command」一律走 CommandChip。命令语法唯一权威 = consistency-check.md §3 统一命令表（`corral park/unpark`、`link/unlink`、`secure/unsecure`、`isolate/unisolate`、`use`、`php:list`、`php:install/php:uninstall`（R7 新增，PHP 视图 Install/Uninstall 按钮的 CLI 等价落地）、`status/restart/logs`、`open/edit`、`new`、`doctor/uninstall`，全部支持 `--json`；`corral use` 另接受 `php@<v>` 别名（CLI 侧归一化；**chip 只渲染 canonical 形，别名永不进 UI**——Herd 肌肉记忆由 CLI 兼容层承担）
- **chip 完整形按动词族拆分**（架构师 2026-10-26 裁决）：
  - **显式站点名形**：`corral open <site>` / `corral start <site>` / `corral stop <site>` / `corral restart [site]`——`corral open` **site 必填、无参 = 用法错误**；**裸 `corral` = 帮助文本**（git/npm 惯例，不开窗口）；CLI 故意不提供开窗命令（重开走 dock / 托盘 Open Corral / 开始菜单；无头环境里开窗口命令无意义）
  - **cwd 形**：`corral link` / `corral secure` / `corral isolate <v>` / `corral logs` / `corral unlink` 等（表定「当前目录」语义；GUI 侧完整形 = `cd <path> && corral <cmd>`，保证从任意目录可复制执行）
- **Start/Stop/Restart 动词（R8 落盘终态，chips 锁定）**：`corral start <site>` / `corral stop <site>`——带站点 = 启用/停用该站点（停用 = 摘除 vhost + nginx default_server 返回停止页，状态入注册表重启后保持）；**无参 = 启停整个本地栈**；**无 `--all` 旗标、无 cwd 缺省推断**（v1 的 cwd 语境魔法已由 R9 v2 明文作废）；`corral restart [site]` 带可选站点参（无参 = 重启整栈），行级 Restart chip 已解锁
- **`corral edit [site]`**：无参 = 主配置文件进默认编辑器（原生菜单 Edit configuration… 等价）；带站点 = 文件管理器揭示该站点生成配置目录（「在 IDE 中打开项目」是 GUI 菜单特权，不进 CLI 命令面）
- 状态词汇表共享 enum：`running | stopped | starting | error | missing`（`missing` 为 PRD §8 parked 目录删除态，需 daemon 枚举扩展，已提 Spec），标签 Running/Stopped/Starting…/Error/Missing——CLI 输出与 GUI 用同一套词，禁 GUI 独有状态概念
- **错误契约**（架构师约束族）：统一信封 `{status, data, error:{code, message, hint, retryable?}}`，`retryable` 由 daemon 判定。GUI 错误态映射：

| 错误码 | GUI 呈现 | retryable | 设计动作 |
|---|---|---|---|
| PORT_CONFLICT | E1 端口占用面板 | true | 定位进程名+PID + `cd <path> && corral link --port=<n>` chip |
| PERMISSION_DENIED | E2 CA 信任 / 提权被拒面板 | true | 手动信任步骤 + 平台感知 hint |
| NETWORK_ERROR | E3a | **true** | [Retry] |
| CHECKSUM_MISMATCH | E3b | **false**（校验类不可重试） | 无 [Retry]，仅 [Report issue] + 重新下载引导 |
| DAEMON_NOT_RUNNING | 全局横幅 + 行状态未知 | true | "It should restart automatically." + [Retry] + `corral doctor` hint |
| SITE_EXISTS | link 同名覆盖 | — | PRD §8：后者覆盖并提示（toast "Replaced the existing link for {name}."） |
| VERSION_NOT_INSTALLED | 行内错误 | false | [Install {v}] 内联提供 + [Choose another version] |
| CONFIG_INVALID | 全局横幅 | false | {hint} + [Open configuration] |
| USAGE_ERROR | error toast（常驻至手动关闭，§4.11 规则） | false | hint 显示正确用法 + 完整形 CommandChip（如 `corral open <site>`）——「GUI 教 CLI」在错误态的落地；⌘K 面板执行缺参动作时同一映射 |
| SITE_NOT_FOUND | SiteRow Error 行态（行内摘要 "{name} not found"） | false | 提示核对站点名 + `corral status` chip 引导查看可用站点；⌘K 无匹配结果复用 "No matches for…" 文案 |

### 9.5 已知坑（pitfalls）

1. 组件内出现硬编码 hex → review 打回（唯一例外 #fff/#000 美术资源内部）
2. 窗口 backgroundColor 与 token 不同步 → 冷开白闪（Electron 特有问题）
3. 命令字符串手写 → CLI 改版后 GUI 显示过期命令（必须走注册表）
4. success/warn 当文字色 → 对比度不达标（只做点/图标）
5. 脉冲动画忘写 reduced-motion 降级 → 前庭敏感用户受害
6. 长域名不截断 → 布局撑破（ellipsis + tooltip）
7. 下载进度用无限动画 → PRD 明禁（必须有确定性进度 + 速度 + ETA + Cancel）
8. macOS 深色下 hover 用「变暗」→ 深色 hover 一律变亮（token 已处理，组件禁自造 hover 色）

---

## 10. 交付物索引（Phase 2 产出）

| 文件 | 内容 |
|---|---|
| `design-system/design-tokens.css` | 四层 Token 双主题完整 CSS 变量 + 全局基线 |
| `design-system/design-tokens.json` | 机器可读 Token（前端 import，Phase 3 门禁物） |
| `design-system/MASTER.md` | 机器可读全局设计源（页面检索入口） |
| `design-system/icons.md` | Lucide 完整清单 + 尺寸 + a11y 文案 + 更名适配 |
| `design-system/component-states.md` | 核心组件全状态矩阵（Loading/Empty/Error/Populated/Edge） |
| `design-system/pages/sites.md` | Sites 视图页面提示词 + 文案 deck |
| `design-system/pages/php.md` | PHP 视图页面提示词 + 文案 deck |
| `design-system/pages/logs.md` | Logs 视图页面提示词 + 文案 deck |
| `design-system/pages/console.md` | Console 底部 dock（集成终端）页面提示词 + 文案 deck |
| `design-system/pages/command-palette.md` | ⌘K 命令面板提示词 + 文案 deck |

> Master + Overrides 规则：实现某页面先读 MASTER.md，再查 `pages/<page>.md` 覆盖项；页面文件只写差异。变更在 MASTER.md 变更记录表追加，禁整篇重写。

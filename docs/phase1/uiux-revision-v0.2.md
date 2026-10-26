# 设计方向修订 v0.2 — 对齐 PRD（设计师 颜好看）

> 输入：PM 同步的 PRD 设计约束 + 用户画像（老张/小林/阿伟）
> 本修订只改与 PRD 冲突或需定稿的部分；v0.1（Phase 1 调研报告）其余结论继续有效

---

## 1. 配色定稿（PM 委托项，最终裁决）

**维持 Teal 主色，终端绿范围化采纳。** 理由三条：

1. **语义冲突（决定性理由）**：本产品核心职责就是展示服务状态——running/stopped/error。如果 UI 强调色用绿色，品牌绿与状态绿在同一块屏幕上无法区分。终端绿因此**只允许出现在终端语境的深色代码面上**（命令 chip、代码块、日志窗、wordmark 终端 pill），永不作为 UI 强调色、永不上浅色底。
2. **反 AI 模板**：靛蓝 #6366F1 是「一眼 AI」首罪色；石板蓝每个 Linear-clone 都在用。Teal 更有个性且同样满足「专业、可靠、高效」。
3. **Teal 与 success 绿可区分**：teal 偏蓝（#0F766E），success 偏黄绿（#16A34A），色相环相距足够，同屏不混。

**v0.2 Token 变更（在 v0.1 基础上新增，不改动 v0.1 已定稿值）**：

```css
:root {
  --terminal-green: #22C55E;   /* 只出现在 --code-bg 上；浅色底禁用 */
  --code-bg: #0E1116;          /* 代码/命令/日志面：两个主题下都是深色（IDE 惯例） */
  --code-fg: #D6DEE8;
  --badge-bg: var(--surface-sunken);
  --badge-fg: var(--fg-2);
  --badge-border: var(--border);
}
:root[data-theme="dark"] {
  --code-bg: #0A0D12;
}
```

**强调色使用规则（精化为两个角色）**：accent 只出现在 ① 当前选中态（选中站点行、当前 PHP 分段）② 主操作按钮。永不装饰性使用。状态色只做 6px 圆点、图标、徽章边框，不承载正文小字。

---

## 2. 品牌方向：Corral

从 PRD 命令示例确认产品名 **Corral**（`corral link`）——与 Herd（牧场）同意象不同词，本地站点「圈养」起来，名字好记且 CLI 友好。

- **Wordmark**：小写 `corral`，Fira Code，放在深色终端 pill 里（--code-bg 底 + --terminal-green 字）——GUI 头部一眼传达「这是个终端原生产品」
- **应用图标/托盘图标方向**：几何「栅栏门」意象——三根立柱 + 一道横栏（或 C 形围栏弧），单色、16px 可辨、macOS template image 兼容。终稿美术在 Phase 2 asset pass
- **语气**：短句、动词开头、像 man page 一样精确；错误信息像编译器报错——指出问题 + 位置 + 修复命令，不道歉不卖萌

---

## 3. MVP I4 界面范围重定

**主窗口 = 唯一核心表面**（默认 900×560，最小 640×480）：左侧导航 + 右侧内容。菜单栏弹出面板、服务管理页、DNS 设置、环境色标——全部移出 MVP，标记为 fast-follow。

### 3.1 窗口结构

```
┌──────────────────────────────────────────────────────────────┐
│ (traffic lights) [corral]   Global PHP: ( 8.3 )( 8.4 ● )   [Search ⌘K] │  标题工具栏
├────────────┬─────────────────────────────────────────────────┤
│  Sites     │  [search sites...]              [Link a folder…]│
│  PHP       │  ─────────────────────────────────────────────── │
│  Logs      │  Name    Domain        PHP   Status    HTTPS    │
│            │  ● my-app    my-app.test   8.4   Running  lock  │
│  (底部)    │  ● acme      acme.test     8.3   Running  lock  │
│  主题/关于  │  ○ legacy    legacy.test   7.4   Stopped  —     │
│            │  ◐ starting… new-app.test   8.4   Starting (3s) │
└────────────┴─────────────────────────────────────────────────┘
```

- **左导航仅 3 项**：Sites（globe）/ PHP（package）/ Logs（file-text）。设置不进导航——走原生菜单（macOS 应用菜单 / Windows 窗口菜单）：主题、开机启动、关于、退出
- **标题工具栏**：全局 PHP 分段控件常驻；右侧搜索框承接 ⌘K/⌘F
- **站点列严格按 PRD I4**：Name / Domain / PHP / Status / HTTPS。行高 40px（一屏 10+ 行）。hover 行显现操作图标钮（20px 图标 + 28×28 命中区）：Open / Logs / More（Secure、Pin PHP、Restart、Stop、Copy CLI command）
- **状态四态**：Running（success 实心点+文字）/ Stopped（meta 空心点+文字）/ Starting（warn 点+脉冲+秒表）/ Error（danger 点+行内错误摘要）。点+文字双编码
- **空状态（英文真实文案）**："No sites linked yet. Run `corral link` inside a project folder and it shows up here instantly." + [Copy command] + [Link a folder…]

### 3.2 PHP 页
- **Global version**：分段控件，切换后 toast 回执 "CLI now uses PHP 8.4" 并显示 `php -v` 首行预览（mono）
- **Installed**：版本行 = 版本号（mono）+ Default 徽章 + `php -v` 预览 + Set as default + Uninstall（二次确认）
- **Available**：每版本 Install 按钮 → 行内确定性进度条

### 3.3 Logs 页
- 顶部站点选择器 + 日志窗：深色代码面（--code-bg）、mono 12px、自动 tail 开关、行数、Copy all 按钮（**把报错直接粘给 Claude Code 的动线**）、Reveal log file
- MVP 只做原始 tail，不做级别过滤（fast-follow）

### 3.4 命令面板（Cmd+K / Ctrl+K，Raycast 范式）
- 560px 宽顶部居浮层：输入框 + 模糊匹配列表，分两组：Sites（带状态点）/ Quick actions（Start all、Stop all、Switch global PHP、Link a folder…）
- 每个结果行右侧显示等价 CLI 命令 chip（mono，--meta 色）——**GUI 的每一页都在教 CLI**，这是「CLI 可脚本化」硬约束在 UI 层的落地
- 键盘：⌘K 开关、↑↓、↵ 执行、esc 关闭

---

## 4. 三大错误状态的具体设计（PRD 点名要求）

设计原则：错误信息像编译器输出——**现象 + 定位（进程名/PID/文件）+ 一条可复制的修复命令**。全部英文。

**E1 端口占用**：站点行转 Error，行内摘要 "Port 80 in use"，展开详情：
> "Port 80 is already used by **nginx (PID 4821)**. Stop that process, or link this site on another port."
> `corral link --port=8080` [Copy command] [View logs]
> 修复指引分平台感知（macOS 提示 `sudo nginx -s stop`；Windows 提示 `net stop` 变体）

**E2 CA 信任被拒**：详情面板给手动信任步骤：
> "macOS didn't accept the local certificate. Open Keychain Access, find "Corral Local CA" under System, double-click it, and set **Always Trust**."
> [Open Keychain Access] [Copy steps]

**E3 PHP 下载失败（区分两种，恢复动作不同）**：
- 网络错误："Couldn't reach the PHP download server. Check your connection and try again." [Retry]
- 校验失败："The download finished but the checksum didn't match. The file may be corrupted or tampered with." [Retry] [Report issue → GitHub]

---

## 5. 性能红线 → UX 规则（PRD 五条红线逐条转译）

1. **CLI 冷启动 <300ms** → GUI 任何操作不得出现「应用加载中」阻塞态；窗口本身就是加载态
2. **GUI 首屏 <2s** → 站点列表先用本地缓存状态立即渲染（骨架行过渡到真实状态）；服务探测后台进行
3. **PHP 下载进度** → 确定性进度条：百分比 + 速度 + 剩余时间 + Cancel；用 accent 色（此场景即「当前主操作」角色）
4. **站点启动禁无限转圈** → Starting 态 warn 脉冲点 + 实时秒表；**10s 超时自动转 Error**，附 [View logs] [Retry]
5. **动效纪律**：状态切换 120-180ms、面板/浮层 240ms；全部尊重 prefers-reduced-motion

---

## 6. 英文文案系统（MVP 界面语言：英文）

- 全界面英文；语气 = 精确的 man page：动词开头、短句、可执行
- 关键文案基样：
  - 切换全局 PHP 成功："Now using PHP 8.4 in terminal and new sites."
  - 停止站点："Stopped my-app.test."（toast）
  - 卸载 PHP 确认："Uninstall PHP 8.2? Sites pinned to it will stop working until you reinstall."（说后果）
  - 无搜索结果："No sites match "acme". Try `corral link` in the project folder."（借机教命令）
- 中文 fallback 保留在字体栈中（i18n 就绪），MVP 不启用

---

## 7. PM 裁决结果（报备确认）

1. 托盘/菜单栏面板：**移出 MVP**，H1 fast-follow（v1.1）——I4 最小面 + 一人小步快跑，先证明核心循环
2. 「Link a folder…」按钮：**进 MVP**——新人第一天不敢碰终端，文件夹选择器闭合首次体验
3. HTTPS Secure：**GUI 可点**——一键 HTTPS 是原始需求硬约束，GUI-only 用户不能被卡在 CLI
4. Corral 命名 + wordmark 终端 pill：认可，待用户终确认后全局锁定
5. 设置面：**MVP 只走原生菜单**（主题/开机启动/关于/退出）；parked 目录走 CLI + 配置文件（可审计），GUI 至多只读展示

---

## 8. 人设校验

- **老张**（多站点/脚本化/双机）：一屏 10+ 行 + 搜索 + ⌘K；标题栏常驻全局 PHP 切换；每操作旁有等价 CLI 命令可复制；双端同一套界面
- **小林**（AI 优先）：⌘K 面板是主入口；Logs Copy all 直粘 Claude Code；命令 chip 让 GUI 成为 CLI 的学习器
- **阿伟**（team lead）：空状态一句话教会新人唯一命令；错误信息带定位和修复命令；配置走文件可进 git 审计

---

## 9. P0 红线自检（v0.2）

- [x] 无 emoji 图标——HTTPS 用 lock 图标徽章（Lucide，架构师 ADR-006 已锁定）
- [x] 无紫→粉渐变——teal 纯色系 + 范围化终端绿，零渐变
- [x] 无空洞占位——全部真实可执行英文文案
- [x] 无硬编码颜色——全部 Token 引用
- [x] 无千篇一律 Hero——工具窗口，首屏即站点列表
- [x] a11y P2 基线：键盘可达、focus-visible 环、状态双编码、reduced-motion

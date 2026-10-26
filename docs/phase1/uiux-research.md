# Phase 1 设计调研报告 — 开源免费「本地开发环境管家」（macOS + Windows 双端）

> 设计师：颜好看 | 阶段：Phase 1 设计调研 | 寄存器判定：**Product**（工具 UI，标杆是赢得熟悉感，不是营销官网）
> 三轴刻度：DESIGN_VARIANCE=3（可预测）/ MOTION_INTENSITY=3（功能动效）/ VISUAL_DENSITY=6（紧凑面板）

---

## 0. 结论速览（TL;DR）

- **对标锁定**：TablePlus（原生桌面质感）+ Raycast（键盘优先、毫秒响应）+ Laravel Herd（菜单栏面板信息架构直接对标并找差异化缝隙）+ Laragon（Windows 托盘范式）
- **设计语言**：极简瑞士风 × 原生桌面工具感。浅色主题优先，深色为完整对等集，跟随系统切换
- **主色**：Teal `#0F766E`（浅色）/ `#2DD4BF`（深色）——绕开 Tailwind 默认 Indigo（AI 模板味首罪）和 Laravel 橙红（避免抄竞品）
- **字体**：Fira Sans（UI 正文）+ Fira Code（域名/版本/端口/CLI 数据）+ 中文系统 fallback 链
- **图标**：锁定 **Lucide**（ISC 协议，2px 描边，24×24 网格，16/20/24px 三档）
- **界面形态**：macOS 菜单栏弹出面板（400px）+ Windows 托盘子面板（同构）+ Dashboard 主窗口（站点/服务/PHP/设置 4 区）+ 站点编辑 sheet + 原生通知
- **差异化缝隙**（对 Herd）：免费无墙——把 Herd Pro 付费墙后的 Log 查看器、服务管理、Dump 查看做进免费版；CLI 可脚本化做成一等公民；Windows 端同一套设计语言

---

## 1. 竞品调研（联网调研）

### 1.1 Laravel Herd（直接对标）
- 菜单栏常驻：状态行 + 站点列表；PHP 版本快捷键 ⌘1-5 直切全局版本（键盘优先标杆）
- 设置分 Tab：General / PHP / JavaScript / AI / Services / Pro / Sharing / Shortcuts / About
- 站点级：URL、workspaces、服务绑定、PHP/Node 版本、HTTPS
- 架构：Dnsmasq + Caddy 代理，静态编译 PHP/nginx（无容器）
- **付费墙（机会）**：Dumps、Mail、Log Viewer、服务管理（MySQL/Redis/Meilisearch/Reverb）、Xdebug 检测全在 Pro $99/年——高频刚需被锁
- **另一机会**：Windows 支持是后期补的，双端一致性有优化空间

### 1.2 Laragon（Windows 直接对标）
- 双入口：主窗口 Dashboard + 系统托盘右键菜单
- 服务一行一条目、端口直接可见、Reload 就近可点——控制台式信息密度
- 弱点：Win32 传统控件风、信息架构陈旧——视觉超越空间明确

### 1.3 Docker Desktop（跨端工具标杆）
- Light/Dark/System 三主题标配；Dashboard + 菜单栏/托盘 + Settings 多 Tab
- 教训：重、慢、启动慢——「启动 <1 秒」应作为产品信仰

### 1.4 TablePlus（macOS 原生质感标杆）
- sparse UI、minimal toolbar、快捷键优先、Auto/Light/Dark 跟随系统
- **连接颜色编码**（testing vs production）——借鉴到站点环境标记（local / feature / prod-like）
- 「避免 cross-platform toolkits 的 uncanny valley」——web 技术栈做桌面必须在圆角/滚动/阴影/菜单行为上逐项逼近原生

### 1.5 Raycast（键盘优先 + 常驻菜单栏范式）
- Fast. Think in milliseconds. / Keyboard First / 99.8% crash-free
- ⌘Space 全局唤出、Cmd+K 命令面板、毫秒级响应——动效必须快而功能性

### 1.6 菜单栏 App 原生规范（Apple HIG + Bjango + 开源 menu bar app 源码）
- 菜单栏高 24pt（notched 37pt，可用区 22pt）；16×16pt 单色 glyph
- 菜单栏图标用 **template image**（只读 alpha 通道，系统自动 tint）——托盘图标必须出单色版
- HIG：点击 extra 默认显示 menu；功能复杂时才用 popover；popover 点击外部自动关闭、esc 关闭、同时只显示一个
- LSUIElement 模式下**必须自带 Quit 入口**
- macOS 26 Tahoe 起菜单栏默认透明——状态色图标要保证任意壁纸下可读

### 1.7 图标库横评（Lucide vs Phosphor vs Heroicons）

| 维度 | Lucide | Phosphor | Heroicons |
|---|---|---|---|
| 数量 | 1,979 | 9,198 | 292 |
| 风格 | 单一 outline，2px stroke，24×24 网格 | 6 种字重 | outline + solid + mini |
| 协议 | ISC | MIT | MIT |
| 单图标体积（tree-shaken） | ~0.5KB | ~1KB | ~0.4KB |
| 生态 | shadcn/ui 默认，npm 周下载 5M | 周下载 700k | Tailwind 官方 |
| 密集 UI 16/20px 表现 | 统一 stroke 保持清晰 | 略有机 | 可 |

---

## 2. 开发者工具设计趋势总结

1. **主题**：Light/Dark/System 三态跟随是桌面工具标配；管理类工具浅色优先 + 完整深色集
2. **信息密度**：菜单栏/托盘面板必须紧凑（一屏 8-12 站点行，行高 ≤40px）；主窗口中等密度
3. **常驻范式收敛**：macOS = MenuBarExtra 富面板；Windows = 托盘左键面板 + 右键原生菜单
4. **状态可视化**：状态点（4-6px 圆）+ 文字标签双编码（a11y 底线）；端口/版本号/域名一律等宽字体
5. **键盘优先**：⌘1-5 PHP 版本直切、⌘, 设置、⌘K/⌘F 搜索、↑↓+↵ 导航、esc 关闭
6. **原生质感零容忍**：圆角 ≤12px、无装饰性毛玻璃、无渐变、系统字体链兜底、自定义细滚动条

---

## 3. 对标品牌锁定与理由

- **主对标：TablePlus**——原生桌面工具完成度标杆：sparse、快捷键优先、主题跟随、颜色编码降误操作
- **次对标：Raycast**——常驻效率工具情绪标杆：毫秒响应、键盘优先、零装饰
- **架构对标：Laravel Herd**——菜单栏面板 IA 直接对标，在其付费墙和 Windows 短板上做差异化
- **Windows 侧参考：Laragon**——保留信息密度、替换视觉语言
- **不选**：Docker Desktop（反面教材）；Vercel/Linear 官网（营销页语言）；Stripe（气质不符）

---

## 4. 设计寄存器与平台轴判定

- **寄存器：Product**：交付物是 app UI/设置面板/数据表；失败模式是不匹配的表单控件、无功能的动效、装饰过度的按钮
- **平台轴：双桌面**：Apple HIG（菜单栏 extra + 面板行为）+ Windows 托盘惯例；**视觉语言跨端统一**（同一套 React 组件 + 同一套 Token），差异仅在外壳行为
- 落地：调色板 Restrained；字体一族 + 等宽；动效 150-250ms 只传递状态；每个交互组件全状态（default/hover/focus/active/disabled/loading/error/empty）

---

## 5. 配色基调（浅色优先，深色对等集）

**选色逻辑**：绕开 `#6366F1`（一眼 AI）和 Laravel 橙红。选 **Teal（青绿）**：传达「安静的后台管家、运行中、可控」，与「服务运行中」的绿色语义同族但更冷更工具感。Primary 加深至 teal-700 保证 4.5:1。中性色带极轻冷蓝倾向，深色不用纯黑。

### 5.1 浅色主题（`:root`）

```css
:root {
  --bg: #F7F8FA;
  --surface: #FFFFFF;
  --surface-sunken: #EEF0F4;
  --fg: #1A1D24;
  --muted: #646B7A;
  --border: #DFE2E8;
  --accent: #0F766E;
  --accent-hover: #115E59;
  --accent-active: #134E4A;
  --accent-on: #FFFFFF;
  --accent-subtle: #D9F0EC;
  --accent-strong: #0B5E58;
  --fg-2: #3D434F;
  --meta: #6E7684;
  --border-soft: #EDEFF3;
  --success: #16A34A;
  --warn: #D97706;
  --warn-text: #B45309;
  --danger: #DC2626;
  --info: #0369A1;
  --focus-ring: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent);
  --motion-fast: 120ms;
  --motion-base: 180ms;
  --motion-slow: 240ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --elev-flat: none;
  --elev-ring: 0 0 0 1px var(--border);
  --elev-raised: 0 1px 2px rgba(16,24,40,0.04), 0 4px 12px rgba(16,24,40,0.08);
  --elev-panel: 0 0 0 1px var(--border), 0 12px 32px rgba(16,24,40,0.14);
}
```

### 5.2 深色主题（`:root[data-theme="dark"]`，完整对等，跟随系统）

```css
:root[data-theme="dark"] {
  --bg: #0E1116;
  --surface: #151A21;
  --surface-sunken: #1A2029;
  --fg: #E8ECF2;
  --muted: #8A94A3;
  --border: #262D38;
  --accent: #2DD4BF;
  --accent-hover: #5EEAD4;
  --accent-active: #99F6E4;
  --accent-on: #052E2B;
  --accent-subtle: rgba(45,212,191,0.12);
  --accent-strong: #5EEAD4;
  --fg-2: #B9C2CF;
  --meta: #7D8697;
  --border-soft: rgba(255,255,255,0.05);
  --success: #3FB950; --warn: #D29922; --warn-text: #D29922;
  --danger: #F85149; --info: #58A6FF;
  --elev-ring: 0 0 0 1px rgba(255,255,255,0.06);
  --elev-raised: none;
  --elev-panel: 0 0 0 1px rgba(255,255,255,0.08), 0 12px 32px rgba(0,0,0,0.5);
}
```

### 5.3 色彩使用规则

- **每屏可见 accent ≤2 处**：① 当前 PHP 版本选中项 ② 主操作按钮。其余中性色 + 语义色
- 语义色只做 4-6px 状态点、图标、Badge 边框，不承载正文小字（用 --warn-text 等文字变体）
- 四层配比：中性 85-90% / accent 5-10% / 语义 0-5% / 效果 <1%
- **禁项自查**：无紫→粉渐变；无彩色左边框卡片；无渐变文字；无纯黑 #000/#808080 直出

---

## 6. 字体方案

**Fira Sans（UI/正文）+ Fira Code（数据/代码）+ 中文系统 fallback 链**。走 typography-pairings 第 25 套「Dashboard Data」，绕开反射拒绝清单（Inter 不作展示字；DM Sans / Space Grotesk / IBM Plex / Plus Jakarta Sans / Outfit 全部拒绝）。Fira 系「机械、精确、无营销味」正合环境管家气质。

```css
--font-ui: "Fira Sans", "Noto Sans SC", -apple-system, "PingFang SC",
           "Microsoft YaHei", sans-serif;
--font-mono: "Fira Code", "JetBrains Mono", "SF Mono", "Cascadia Code",
             Consolas, monospace;
```

**字号阶梯（8 级，桌面紧凑 UI）**：

| Token | px | 用途 |
|---|---|---|
| --text-xs | 11 | Badge、版本号、时间戳（mono） |
| --text-sm | 12 | 辅助说明、端口、meta |
| --text-md | 13 | 面板次级行文 |
| --text-base | 14 | 正文/列表行/表单 |
| --text-lg | 16 | 面板标题、主窗口正文 |
| --text-xl | 18 | 区块标题 |
| --text-2xl | 22 | 主窗口页标题 |
| --text-3xl | 28 | 空状态引导标题 |

**字重三级**：400 正文 / 500 小标题按钮 / 600 页标题。**等宽强制场景**：域名、PHP/Node 版本号、端口、路径、CLI 命令、`php -v` 输出。

---

## 7. 图标系统锁定：Lucide

锁定 **Lucide**（lucide.dev / `lucide-react`，ISC 协议，可商用免署名）。
理由：① 单一 outline + 统一 2px stroke，密集 UI 在 16/20px 仍保清晰；② shadcn/ui 默认生态，React/TS 支持最成熟（周下载 5M）；③ tree-shakeable ~0.5KB/图标；④ Phosphor 6 字重对本项目是过剩特性。

**尺寸规范（全项目统一）**：16px 行内 / 20px 按钮内 / 24px 独立图标；描边 2px，currentColor，viewBox 24×24。

**特殊规格**：菜单栏/托盘图标不走 Lucide——macOS 用 16×16pt 单色 template 图；Windows 托盘用 16/32px ICO。产品 logo 单独设计（单色几何，16px 可辨）。

**语义映射初定**（Phase 2 固化）：server（nginx）、terminal（CLI）、globe（域名）、lock（HTTPS）、package（PHP 版本）、database、folder、play/square（停止）、rotate-cw（重启）、search、settings、external-link、check、alert-triangle、info、plus、trash-2、copy、refresh-cw。

---

## 8. 风格方向与关键工艺规则

**方向**：极简瑞士风 × 原生桌面工具。关键词：安静、精准、快速、高信噪比。打开面板 3 秒内回答：站点在跑吗？全局什么 PHP？服务正常吗？

1. 面板/窗口圆角 ≤12px（卡片 8px、浮层 12px），杜绝 ≥24px AI 过度圆滑
2. 无装饰性毛玻璃、无渐变、无发光边框；浮层靠 1px 边框 + 大扩散柔和阴影
3. 行分隔用 1px --border-soft，不用卡片盒子堆叠
4. 空状态文案全部真实功能文案
5. 加载态：服务操作按钮内 spinner + 行内 starting；版本安装进度条
6. 滚动条：面板内 6px 细滚动条，hover 才显现

---

## 9. 核心界面形态与信息架构（文字草图）

### 表面 A：macOS 菜单栏弹出面板 / Windows 托盘子面板（宽 400px，高 ≤560px，双端同一套组件）

```
┌────────────────────────────────────────────┐
│ [logo] 环境管家            ● 全部服务运行中 │  状态摘要条（点击跳服务区）
├────────────────────────────────────────────┤
│ 全局 PHP   ( 8.3 )( 8.4 ● )( 8.5 )   ⌘1/2/3│  分段控件，●=当前，⌘1-3 直切
├────────────────────────────────────────────┤
│ 站点                          [搜索 ⌘F]    │
│ ● my-app.test            [8.4] [锁]  打开  │  状态点/域名(mono)/版本Badge/HTTPS锁/操作
│ ● acme-dashboard.test    [8.3] [锁]  打开  │  hover 显现快捷操作
│ ○ legacy-shop.test       [7.4]        打开  │
├────────────────────────────────────────────┤
│ 服务                                       │
│ nginx    :80 :443    ● 运行中      [停止]  │
│ php-fpm  (8.4)       ● 运行中      [停止]  │
│ dnsmasq  *.test      ● 运行中      [停止]  │
├────────────────────────────────────────────┤
│ 打开面板 ⌘D     设置 ⌘,     退出 ⌘Q        │
└────────────────────────────────────────────┘
```

- macOS：MenuBarExtra window 风格富面板，点击外部/esc 关闭，同时只开一个；LSUIElement 自带 Quit
- Windows：托盘**左键** = 该面板（WebView2 渲染）；**右键** = 原生菜单（全部启动/停止、打开面板、退出）
- 键盘：↑↓ 导航、↵ 打开、esc 关闭、⌘1-5 PHP 版本、⌘, 设置、⌘D 主窗口

### 表面 B：Dashboard 主窗口（双端共用，默认 960×640，最小 720×480）

Sidebar 仅 4 项：**站点 / 服务 / PHP / 设置**。

- **B1 站点页**：搜索 + 添加 parked 目录；表格列：状态点/域名(mono)/路径/PHP Badge/Node/HTTPS 锁/环境标记/操作。空状态：「还没有站点。把项目文件夹放进 ~/Herd（或在设置里添加目录），刷新后它会自动出现在这里，域名就是文件夹名加 .test。」
- **B2 服务页**：每行 = 名称/状态/端口(mono)/版本/启停重启/日志入口（**免费版就给 Log 查看器，直接打 Herd 付费墙**）。MySQL/Redis 等可选服务一键安装。
- **B3 PHP 页**：版本卡片：`8.5 [已装] [默认] [卸载]` / `8.4 [已装] [设为默认]` / `8.3 [安装]`；每卡片含 php.ini 路径与 CLI 验证框（实时 `php -v`，mono）。
- **B4 设置页**：通用（开机启动 SMAppService/Windows 登录项、主题、默认 IDE、更新通道）/ 目录（parked 增删）/ DNS（.test 后缀、DNS 重置）/ **CLI 一等公民**（`herd` 命令 PATH 状态卡 + 一键复制 export + 命令速查表带复制按钮）。

### 表面 C：站点编辑 sheet（宽 ~440px）

域名（只读 mono）/ 路径 / PHP 版本 pin / Node 版本 / HTTPS 开关（自签 + 一键信任钥匙串）/ 环境标记（local/feature/prod-like 三色点，借鉴 TablePlus）/ 危险区（删除，二次确认）。

### 表面 D：托盘/菜单栏图标状态语言

运行全部 = 实心；部分停止 = 半透明；全部停止 = 仅描边（alpha 变体，系统 tint 兼容）。macOS 16×16pt template；Windows 16/32 ICO。

### 表面 E：原生通知

PHP 安装完成 / 证书已生成并信任 / 服务意外退出（含一键重启动作）。面板内 toast 仅用于操作回执。

---

## 10. 状态可视化规范

| 状态 | 视觉 | 文字编码 |
|---|---|---|
| 运行中 | 6px success 圆点 | 「运行中」 |
| 已停止 | 6px meta 空心圆 | 「已停止」 |
| 启动中 | 6px warn 圆点 + 脉冲（reduced-motion 降级静态） | 「启动中」 |
| 错误 | 6px danger 圆点 | 「错误」+ 详情入口 |

圆点旁必配文字或 tooltip；表格数字 tabular-nums；版本 Badge 用 --surface-sunken 底 + mono，钉定版本加 1px --border 区分，不用彩色。

---

## 11. 键盘与交互范式

- ⌘1-⌘5 切换全局 PHP / ⌘, 设置 / ⌘D 主窗口 / ⌘F 或 ⌘K 搜索 / esc 关面板
- ↑↓ + ↵ 站点列表导航；⌘↩ 站点编辑
- 所有破坏性操作二次确认；**所有服务操作可从 CLI 复现（面板操作旁显示等价 herd 命令，hover 可见、点击复制）——GUI 每个动作都暴露它的 CLI 对应物**

---

## 12. P0 红线自检

- [x] 无 emoji 功能图标——锁定 Lucide SVG，16/20/24px 三档
- [x] 无紫→粉渐变——teal 单色系纯色，零渐变主视觉
- [x] 无空洞占位——全部真实功能文案
- [x] 无硬编码颜色——全部 Token 引用
- [x] 无千篇一律 Hero——桌面工具首屏即状态摘要
- [x] 附加：无彩色左边框 / 无渐变文字 / 无默认毛玻璃 / 圆角 ≤12px

---

## 13. 给架构师与前端的交接输入

1. **技术栈倾向**：Tauri v2（tray-icon feature）+ React + TypeScript + Tailwind + lucide-react + Fira Sans/Fira Code 本地 woff2 打包
2. **原生边界划分**：托盘右键菜单、系统通知走原生（Rust 端）；弹出面板与主窗口是 webview（decorations:false + always-on-top + 点击外部关闭，宽 400px）
3. **字体策略**：Fira Sans 3 字重 + Fira Code 2 字重本地打包（约 150-250KB woff2），中文走系统 fallback；font-display: swap
4. **主题**：data-theme 属性切换 + 跟随系统（prefers-color-scheme）
5. **Phase 2 产出**：完整 DESIGN.md + design-tokens.json + design-tokens.css + 各表面页面设计提示词 + 组件状态矩阵

---

## 14. 调研来源

1. Laravel Herd 官网与文档：herd.laravel.com / herdphp.com
2. Herd 版本/定价第三方梳理：krishaweb.com/blog/laravel-herd、techbloat.com
3. Laragon 官网与现代版说明：laragon.org
4. Docker Desktop 设置文档：docs.docker.com/desktop/settings-and-maintenance/settings/
5. TablePlus 官网与文档：tableplus.com
6. Raycast 官网：raycast.com
7. macOS 菜单栏 App 原生规范研究（HIG/Bjango/开源源码）
8. 图标库横评：iconstash.io/compare/lucide-vs-phosphor、pkgpulse.com
9. Lucide 官网：lucide.dev
10. Tauri v2 系统托盘文档：tauri.app/develop/system-tray/

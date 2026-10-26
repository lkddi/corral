# 页面：Command Palette（⌘K 命令面板）

> 路由/表面：全局浮层（任何视图 ⌘K / Ctrl+K）| 版本 v1.5 | 2026-10-26
> 定位：键盘优先的总入口——GUI 的每一页都在教 CLI（架构师确认：GUI 操作渲染等价命令串，注册表模板渲染，禁手写）
> v1.5：命令终态锁定（consistency-check §2 R8/R9 v2/R11 落盘）——chips 全树锁定态；无 --all 旗标、无 cwd 缺省推断；restart [site] 行级 chip 解锁；+USAGE_ERROR 面板映射（R11）

## 布局

```
┌───────────────────────────────────────────────┐
│ [search 16px] Search sites and actions…        │  输入行 48px
├───────────────────────────────────────────────┤
│ SITES                                          │  分组头 28px（sm/muted/caps 0.06em）
│ ● my-app.test      corral open my-app      ↵ │  结果行 36px
│ ○ legacy.test      corral open legacy      ↵ │
├───────────────────────────────────────────────┤
│ ACTIONS                                        │
│ [power]  Start all sites     corral start   ↵ │
│ [square] Stop all sites      corral stop    ↵ │
│ [package] Switch PHP to 8.3 corral use 8.3 ↵ │
│ [link]   Link a folder…     corral link     ↵ │
│ [square-terminal] Show console        ⌃`     │
├───────────────────────────────────────────────┤
│ corner-down-left run · ↑↓ navigate · esc close │  提示行 32px（meta 12px）
└───────────────────────────────────────────────┘
```

- 宽 560px，顶部居中（距顶 20vh），`--surface` + `--elev-panel` + `--radius-lg` + `--z-palette`
- 结果行：20px 图标（Sites 用状态点 6px + 域名 mono；Actions 用 Lucide）+ 名称 + 右侧 CommandChip（mono sm，`--meta`，hover 出 copy 钮）+ 末尾 ↵ 提示
- 分组：**Sites**（全部站点，按最近使用序，带状态点）/ **Actions**（Start all、Stop all、Switch global PHP to {v} 每个已装版本一条、Link a folder…、Show console / Hide console）
- **chip 渲染规则（HC-1，R8/R9 v2 落盘终态）**：所有命令字符串从 shared/commands.ts 注册表模板渲染，组件内禁手写；**两种完整形按动词族拆分**：
  - **显式站点名形**：`corral open <site>` / `corral start <site>` / `corral stop <site>` / `corral restart [site]`——`corral open` site 必填、无参 = 用法错误；裸 `corral` = 帮助文本（git/npm 惯例，不开窗口；CLI 故意不提供开窗命令，重开走 dock / 托盘 / 开始菜单）；**无 `--all` 旗标、无 cwd 缺省推断**
  - **cwd 形**：`corral link` / `corral secure` / `corral isolate <v>` / `corral logs`（表定「当前目录」语义，GUI 侧完整形 = `cd {path} && corral <cmd>`，保证从任意目录可复制执行）
  - 窄容器显示短形 `corral <cmd>`（站点名形 = `corral open`），tooltip 与复制内容 = 完整形；全局命令（`corral use 8.3`、`corral php:install <v>` 等无 cwd/站点依赖）短=完整形
- **Start all / Stop all**：chip = 裸 `corral start` / `corral stop`（无参 = 启停整个本地栈，R8 终态；**无 `--all` 旗标**）
- **GUI 表面动作无 chip**：Show/Hide console 右侧显示快捷键 `⌃\`` 提示代替 chip；[Open in system terminal] 同（OS 级动作）
- 空结果：「No matches for "{query}".」+ [Clear]

## 交互与状态（矩阵见 component-states.md §8）

- 打开：⌘K/⌃K，浮层 + 背后内容遮罩（`--bg` 80% 不透明，禁毛玻璃）；输入框自动聚焦
- 输入即过滤（站点按 name/domain 模糊匹配；动作按名称匹配）
- ↑↓ 导航高亮行（accent-subtle 底）；↵ 执行并关闭浮层 + toast 回执
- 站点行 ↵ = Open（stopped 站点 = Start）；Actions ↵ = 执行对应命令同逻辑
- 站点行 tooltip = 完整形 `corral open my-app`（复制同完整形）；Show/Hide console ↵ = 折叠切换底部 dock（pages/console.md）
- esc 关闭；点击遮罩关闭；Tab 焦点圈定浮层
- 执行失败：浮层关闭 + 对应错误面板或 toast（不停在浮层里报错）
- USAGE_ERROR（缺参/用法错误，R11）：浮层关闭 + 常驻 error toast（`circle-alert` 16px danger）+ 正确用法 hint + 完整形 CommandChip——「GUI 教 CLI」在错误态落地

## 键盘

⌘K/⌃K 开关 · ↑↓ 导航 · ↵ 执行 · esc 关闭 · （输入框内 ⌘K 透传不关闭，防误触）

## 动效

浮层进入 240ms（opacity 0→1 + translateY -4px→0，`--ease-standard`）；关闭 120ms；reduced-motion 直显直隐。

## 文案 deck

placeholder："Search sites and actions…" / 空结果："No matches for "{query}"." / 提示行："run" "navigate" "close" / toast 复用各动作回执串（见 pages/*.md）

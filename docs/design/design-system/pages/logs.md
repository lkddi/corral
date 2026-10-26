# 页面：Logs（日志查看）

> 路由/表面：主窗口内容区第三视图 | 版本 v1.2 | 2026-10-26
> Master + Overrides：本文件只写与 MASTER.md 的差异与页面专属细节
> 定位：小林（AI 优先全栈）把报错直接粘给 Claude Code 的动线落地页；阿伟的审计面。
> v1.1：状态栏补 `corral logs` CommandChip；MVP 范围按 team-lead 裁决收敛为 tail + auto-tail + Copy all + Reveal file
> v1.2：实时 tail 走 daemon WS 流通道（与 Console dock 同一通道，非文件轮询——架构师终端栈锁定连带）

## 布局

```
┌─────────────────────────────────────────────────┐
│ 工具栏 48px：站点选择器（dropdown）  [Copy all] [Reveal file] │
├─────────────────────────────────────────────────┤
│ 日志窗（code-surface，flex-1，mono 12px，行高 1.6）        │
│  …tail 输出…                                          │
├─────────────────────────────────────────────────┤
│ 状态栏 28px：142 lines · Auto-scroll [switch] · Updated 3s ago · [corral logs ⎘] │
└─────────────────────────────────────────────────┘
```

- **站点选择器**：dropdown（默认选中 Sites 视图的选中站点/首个站点）；显示状态点 + 域名；stopped 站点可选（显示空态）
- **日志窗**：`--code-bg` 底（两主题皆深）+ `--code-fg` + mono `--text-sm`；自动 tail 默认开启（switch 关闭后停在底部，新行进 "N new lines" 按钮）；选中文本可原生复制
- **状态栏**：行数（tabular）+ Auto-scroll switch + "Updated Ns ago"（meta 11px mono）+ 右端 **CommandChip**：短形 `corral logs`（mono sm），tooltip 与复制内容 = 完整形 `cd {path} && corral logs`（注册表模板渲染，窄容器显示短形、复制完整形——同 ⌘K 面板规则，站点级命令保证从任意目录可复制执行）

## 核心组件与状态（矩阵见 component-states.md §11）

- **Loading**：日志窗内 3 行微光骨架（code-bg 上的 surface-sunken 块）；reduced-motion 静态
- **Streaming**：auto-tail 跟随；超长行横向滚动（禁 wrap，日志行 wrap 不可读）
- **Empty**：「No logs yet for {name}. Logs appear after the first request.」
- **Stopped-site**：「{name} is stopped. Start it to generate logs.」+ [Start]（secondary）
- **Error（文件不可读）**：「Can't read the log file for {name}.」+ [Reveal file] + [Copy path]
- **Copy all**：全文复制到剪贴板 → toast "Copied {n} lines from {name}"（空日志："Nothing to copy"）
- **Reveal file**：打开 Finder/资源管理器定位日志文件（`folder-open` 16px + 文字）

## 交互

- 切站点 = 重载日志窗（<200ms 骨架过渡）
- 日志实时流走 daemon WS 通道（与 Console dock 同一通道，非文件轮询）→ 增量追加（禁整窗重绘，防滚动跳动）
- 与 Sites 视图联动：站点行 Logs 按钮 = 切到本视图并选中该站点
- 日志内容只读；**MVP 范围 = tail + auto-tail + Copy all + Reveal file**（team-lead 2026-10-26 裁决）；级别过滤/搜索 = v1.1（与托盘面板同批 fast-follow，空态文案不承诺）

## 键盘

↑↓ 或 PgUp/PgDn 日志窗滚动 · Home/End 首尾 · ⌘C 复制选中 · ⌘K 面板

## 响应式

<720px：状态栏 "Updated Ns ago" 隐藏；Copy all 收进行尾 More。

## 文案 deck

见上状态段。toast："Copied {n} lines from {name}" / "Nothing to copy" / "Started {name}."

# Corral — 图标系统（Lucide 锁定 · icons.md）

> 版本 v1.3 | 2026-10-26 | 架构师已锁定并实证核验：**lucide-react 1.61.0（exact pin，ISC，24×24 网格，2px outline 唯一风格，tree-shakable）**——33 个 MVP 图标位 31 个直接命中实际包导出
> 全项目禁混用第二套图标库、禁 emoji 作功能图标（P0）。版本升级走 ADR-lite（叶子依赖，命名稳定性优先）。

## 1. 全局规格

| 项 | 规范 |
|---|---|
| 尺寸 | **16px 行内**（列表 meta、Badge 内、命令 chip 内）/ **20px 按钮与导航**（工具栏、菜单项、行操作）/ **24px 独立**（空状态插位） |
| 描边 | `strokeWidth={2}` 统一；16px 行内图标加 `absoluteStrokeWidth` 保持精确 2px |
| 颜色 | `currentColor` 继承文字色，禁为图标单独设色 |
| aria | 组件默认 `aria-hidden="true"` 保持不变；**纯图标按钮必须 `aria-label` + tooltip**（文案见下表）；伴随可见文字的图标无需额外 aria |
| 状态点 | 五态用 6px CSS 圆点 + 文字，**不是图标**，不消耗图标位 |
| 原生菜单 | macOS 应用菜单 / Windows 窗口菜单 = text-only 平台原生项，不用 Lucide |
| 品牌资产 | app icon 与（v1.1）托盘模板图 = 品牌美术资产（栅栏门几何标，单色，16px 可辨，template image 兼容），非 UI 图标，不走 Lucide |

## 2. 完整清单（MVP）

### 侧导航（20px）

| 用途 | Lucide 名 | aria-label / tooltip |
|---|---|---|
| Sites | `globe` | "Sites" |
| PHP | `package` | "PHP versions" |
| Logs | `logs` | "Logs" |

### Sites 视图

| 用途 | Lucide 名 | 尺寸 | aria-label / tooltip |
|---|---|---|---|
| 搜索框行内 | `search` | 16 | placeholder: "Search sites…" |
| Link a folder 按钮 | `link` | 16 + 可见文字 | — （文字优先） |
| 空状态插位 | `link` | 24 | — （伴随文案） |
| Copy command | `copy` | 16 + 可见文字 | — |
| 行内 Open | `external-link` | 20 | "Open {domain} in browser" |
| 行内 Logs | `file-text` | 20 | "View logs for {name}" |
| 行内 More | `ellipsis` | 20 | "More actions for {name}" |
| More: Secure | `shield-check` | 20 | "Secure with HTTPS" / 已 secured 显示 checkmark + "Secured" |
| More: Pin PHP | `pin` | 20 | "Pin PHP version" |
| More: Restart | `rotate-cw` | 20 | "Restart" |
| More: Stop / Start | `square` / `play` | 20 | "Stop" / "Start" |
| More: Copy CLI | `copy` | 20 | "Copy CLI command" |

### PHP 视图

| 用途 | Lucide 名 | 尺寸 | aria-label / tooltip |
|---|---|---|---|
| Install 按钮 | `download` | 16 + 可见文字 | — |
| 下载 spinner | `loader-circle` | 16 | CSS 旋转；reduced-motion 降级静态 |
| Cancel | `x` | 16 | "Cancel download" |
| Set as default | `check` | 16 + 可见文字 | — |
| Uninstall | `trash` | 16 | "Uninstall PHP {version}" |

### Logs 视图

| 用途 | Lucide 名 | 尺寸 | aria-label / tooltip |
|---|---|---|---|
| Copy all | `copy` | 16 + 可见文字 | — |
| Reveal log file | `folder-open` | 16 + 可见文字 | "Reveal in Finder / Explorer" |

### ⌘K 命令面板

| 用途 | Lucide 名 | 尺寸 |
|---|---|---|
| 输入框 | `search` | 16 |
| Start all / Stop all | `power` | 20 |
| Switch global PHP | `package` | 20 |
| Link a folder | `link` | 20 |
| 回车提示 | `corner-down-left` | 16 |

### Console dock（底部集成终端）

| 用途 | Lucide 名 | 尺寸 | aria-label / tooltip |
|---|---|---|---|
| dock 头标签 | `square-terminal` | 16 + 可见文字 "Console" | — （文字优先） |
| 折叠 / 展开 | `chevron-down` / `chevron-up` | 16 | "Hide console" / "Show console" |
| Open in system terminal | `external-link` | 16 + 可见文字 | — |
| Restart shell | `rotate-cw` | 16 | "Restart shell" |
| ⌘K：Show/Hide console | `square-terminal` | 20 | "Show console" / "Hide console" |

### 错误面板（图标区分错误类型）

| 错误 | Lucide 名 | 尺寸 | 色 |
|---|---|---|---|
| E1 端口占用 | `circle-alert` | 20 | danger |
| E2 CA 信任被拒 | `key` | 20 | warn |
| E3a 网络错误 | `wifi-off` | 20 | danger |
| E3b 校验失败 | `shield-alert` | 20 | danger |
| 面板动作 | `copy` / `external-link` / `file-text` | 16 + 文字 | — |
| error toast（含 USAGE_ERROR，R11） | `circle-alert` | 16 | danger |

## 3. 目录变动适配（架构师对 1.61.0 实际包实证）

1. **`github` 已从 Lucide 移除**（brand icons removal #3639，实证确认）。两类 GitHub 槽位分流：
   - **「Report issue」动作**（E3b 错误面板）→ `external-link` + 文字（架构师采纳）
   - **「Star on GitHub」入口**（原生菜单项 / 如未来有 GUI 槽位）→ `star` 图标 + 文字标签，禁任何 GitHub 品牌 logo；埋点 star_clicked
2. **规范名强制**（旧别名 1.61.0 仍可导入但项目禁用，避免兼容层清理后返工）：`more-horizontal`→`ellipsis`、`alert-circle`→`circle-alert`、`alert-triangle`→`triangle-alert`、`trash-2`→`trash`、`terminal`→`square-terminal`
3. `logs` 图标存在，直接作 Logs 导航语义
4. 新增全局横幅图标位（component-states.md §13）：DAEMON_NOT_RUNNING / CONFIG_INVALID / 首次提权横幅 = `triangle-alert` 20px（warn）或 `circle-alert` 20px（danger）

## 4. 新增图标流程

设计需要目录外图标时：设计师提交候选给架构侧评估 → 通过后入库；**禁止自绘 SVG 混入 UI**（品牌美术资产除外，见 §1）。

## 5. 变更记录

| 日期 | 变更 | 原因 |
|---|---|---|
| 2026-10-26 | v1.0 建立；github→external-link；更名适配 | Lucide brand icons 移除 + 目录更名核验 |
| 2026-10-26 | v1.1：钉死 1.61.0 exact；规范名强制（trash/ellipsis/circle-alert/triangle-alert/square-terminal）；github 槽位分流（Report issue→external-link，Star on GitHub→star+文字）；新增横幅图标位 | 架构师实际包实证 + 总监 P0 边界裁定 + PRD 埋点 star_clicked |
| 2026-10-26 | v1.2：+Console dock 图标组（square-terminal/chevron-down/chevron-up/external-link/rotate-cw；esc 语义不关 dock）；横幅引用改 §13（component-states 重编号） | team-lead Console 视图裁决 + component-states.md 编号去重 |
| 2026-10-26 | v1.3：+error toast 图标位（`circle-alert` 16px danger，USAGE_ERROR 复用——R11 补该错误码的 GUI 映射时发现 toast 图标位缺口） | 总监 R11 错误码 8→10 |

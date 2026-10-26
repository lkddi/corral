# 页面：PHP（版本管理）

> 路由/表面：主窗口内容区第二视图 | 版本 v1.2 | 2026-10-26
> Master + Overrides：本文件只写与 MASTER.md 的差异与页面专属细节
> v1.1：R7 落地——安装/卸载 chip 解禁（`corral php:install/uninstall <v>`）；`corral use` 记 `php@<v>` 别名
> v1.2：alias 纪律收紧——chip 只渲染 canonical `corral use 8.4`，`php@<v>` 别名永不进 UI（架构师 §3 回执）

## 布局

三个纵向区块，区块间距 24px，区块标题 `--text-lg`/600：

**区块 1 · Global version（全局版本）**
- SegmentedControl（已装版本；规格见 DESIGN.md §4.5），sunken 底容器，段内版本号 mono
- 控件下方 CLI 验证条（code-surface，mono `--text-sm`）：
  `$ php -v` → `PHP 8.4.10 (cli) (built: Oct 12 2026 11:02:14) (NTS)`
  （实时取当前生效版本；让 GUI 与 CLI 是同一份配置变得可见）

**区块 2 · Installed（已安装）**
版本行（行高 48px，行间 border-soft）：版本号 mono `--text-lg` + [Default] Badge（如为默认）+ `php -v` 首行预览（mono `--text-sm` `--muted`，截断）+ 右侧 [Set as default]（ghost，默认项禁用）+ [Uninstall]（ghost danger，16px `trash`）

**区块 3 · Available（可安装）**
版本行：版本号 mono + 状态说明（`--muted` "Not installed"）+ 右侧 [Install]（secondary，16px `download`）

## 核心组件与状态

- **切换全局版本**：点击段 → 200ms 内生效 → 验证条刷新 + toast "Now using PHP 8.4 in terminal and new sites."（失败：段回滚 + toast "Couldn't switch to PHP {v}. {reason}"）
- **安装进度态**（矩阵见 component-states.md §5）：行内 4px accent 进度条 + mono tabular "42% · 3.2 MB/s · ~18s left" + [Cancel]（16px `x`，aria "Cancel download"）；reduced-motion 下进度条仍平滑增长（非装饰动画，数据驱动）
- **安装失败双型**（retryable 由 daemon 信封判定，UI 不得自行推断）：
  - 网络（E3a，`wifi-off`，NETWORK_ERROR，**retryable=true**）："Couldn't reach the PHP download server. Check your connection and try again." + [Retry]
  - 校验（E3b，`shield-alert`，CHECKSUM_MISMATCH，**retryable=false——禁给 [Retry]**）："The download finished but the checksum didn't match. The file may be corrupted or tampered with." + [Report issue]（`external-link` 打开 GitHub issues）+ 引导 "Download it again from the PHP page."（重新下载是显式新动作，不是重试）
- **卸载确认**（模态，`--z-modal`）："Uninstall PHP {version}? Sites pinned to it will stop working until you reinstall." + [Cancel] [Uninstall]（danger）
- **Set as default**：点击即生效 + toast "PHP {v} is now the default for new sites and the terminal."
- **空态**：Available 区空 = "All available PHP versions are installed." + 文档链接（external-link）

## 交互

- **版本口径（R5 + PRD 非功能修订）**：MVP 默认已装 4 个主力版本 **8.1 / 8.2 / 8.3 / 8.4**；Available 区 = 7.4 / 8.0 / 8.5 按需安装；分段控件超过 4 段时收起为「当前值 + 箭头」
- 每行操作旁配 CommandChip（hover 显现或常驻右侧）：切换全局/设为默认 = `corral use 8.4`（同一动作两种入口；CLI 接受 `php@<v>` 别名如 `corral use php@8.3` 但 **chip 只渲染 canonical `corral use 8.4`，别名永不进 UI**——Herd 肌肉记忆由 CLI 侧兼容承担）；安装 = `corral php:install <v>`、卸载 = `corral php:uninstall <v>`（**R7 新增，全局命令无 cd 前缀**，注册表模板渲染）
- 安装中可切视图（进度后台继续，回视图见进度态）；取消即弃（MVP 无断点续传）

## 键盘

↑↓ 行导航 · ↵ 触发行主操作（Install / Set as default） · ⌘K 面板（含 "Switch global PHP to 8.x" 动作）

## 响应式

<720px：版本行内 `php -v` 预览隐藏（tooltip 保留）；按钮组收进行尾 More。

## 文案 deck

见上。toast 集："Now using PHP {v} in terminal and new sites." / "Installed PHP {v}." / "PHP {v} is now the default for new sites and the terminal." / "Uninstalled PHP {v}." / "Copied `{command}`"

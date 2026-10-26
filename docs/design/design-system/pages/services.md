# 页面：Services（附加服务 · MySQL / Redis）

> 路由/表面：主窗口内容区第四视图 | 版本 v1.0 | 2026-10-26
> Master + Overrides：本文件只写与 MASTER.md 的差异与页面专属细节
> 背景：R13 用户需求变更（mysql/redis/debug 进 P0）；架构 = ADR-008（catalog 分发同 PHP、daemon 托管、端口 3306/6379、默认不登录自启）
> 本文件由总监代拟（原设计师队友不可用），风格对齐 pages/php.md；Token / 组件状态 / 图标名以 MASTER.md + design-tokens.json + icons.md（v1.3）为唯一源

## 布局

两个 ServiceCard（纵向排列，卡间距 16px）。卡片结构（sunken 底容器，圆角 `--radius-lg`，padding 16px，卡内行距 12px）：

**卡头行**（高 40px）：服务图标（20px，mysql = `database`，redis = `layers`）+ 服务名 `--text-lg`/600 + 版本号 mono `--text-sm` `--muted` + 状态点（6px，右对齐前）+ 状态文字 `--text-sm`/500 + 右侧主操作组
**信息行**（mono `--text-sm`，`--muted`，tabular-nums，两列 grid）：

- 左列：Port 3306 · PID 12345 · Data `<appdata>/mysql/data`（截断，tooltip 全路径）
- 右列：.env 建议值复制行（见下）

**进度/错误区**：安装或启动时替换信息行位置（内联展开，不跳转）

## 服务五态（R13 新词表，与站点五态同构但独立）

| 状态 | 点色 | 卡头文字 | 主操作组 |
|---|---|---|---|
| `running` | success | "Running" | [Stop]（secondary，16px `square`）+ [Restart]（ghost，16px `rotate-cw`） |
| `stopped` | muted | "Stopped" | [Start]（primary，16px `play`） |
| `starting` | warn（呼吸动画遵守 reduced-motion，10s 超时转 error，同站点秒表机制） | "Starting…" + 已用秒表 mono | [Cancel]（ghost，16px `x`） |
| `error` | danger | "Error" | [View logs]（secondary，`scroll-text`）+ [Start]（ghost） |
| `not-installed` | muted | "Not installed" | [Install]（primary，16px `download`） |

- 停用 ≠ 卸载：stopped 保留数据目录（mysql:uninstall 默认保留 data，`purge` 才删且二次确认——GUI 同步呈现：卸载确认模态文案须含 "Your databases will be kept" / purge 选项默认关）
- daemon 信封判定 retryable，UI 不得自行推断（同 php.md 纪律）

## .env 建议值复制行（核心差异化交互）

卡头下方常驻一行（code-surface，mono `--text-sm`，右侧 [Copy] 16px `copy`）：

- MySQL running：`DB_CONNECTION=mysql DB_HOST=127.0.0.1 DB_PORT=3306 DB_DATABASE=laravel DB_USERNAME=root DB_PASSWORD=`
- Redis running：`REDIS_HOST=127.0.0.1 REDIS_PORT=6379`
- 服务未运行：行置灰 + 文案 "Start the service to get your .env values."（不展示假值）
- 复制成功 toast："Copied `{command}`"（同全局 toast 集）；root 空密码旁 tooltip："Local development only — root with no password, bound to 127.0.0.1"（风险提示轻量在场，不恐吓）

## 安装进度态（矩阵见 component-states.md §5）

[Install] 点击后卡片进入行内进度区（同 php.md 安装态：4px accent 进度条 + mono tabular "42% · 3.2 MB/s · ~18s left" + [Cancel]）；MySQL 官方二进制无代码签名——校验失败（E3b，`shield-alert`，CHECKSUM_MISMATCH，retryable=false 禁 [Retry]）文案： "The download finished but the checksum didn't match. The file may be corrupted or tampered with." + [Report issue]；网络失败（E3a `wifi-off`，NETWORK_ERROR，retryable=true）+ [Retry]。安装完成后自动 `--initialize-insecure` 初始化数据目录（进度文案 "Preparing data directory…"），完成后转 stopped 态 + toast "Installed MySQL {v}."

## 错误态（复用 DESIGN.md §4.9–4.13，页面映射）

| 场景 | 码 | UI |
|---|---|---|
| 端口 3306/6379 占用（start 时） | PORT_CONFLICT（retryable=true） | E2 面板："{port} is in use by {process} (PID {pid}). Stop it, then start again." + [Copy diagnostic] + [Open Activity Monitor 引导]（`external-link` 文档） |
| 版本未安装（start/stop 未装版本） | VERSION_NOT_INSTALLED（retryable=false） | 卡内提示 + [Install] 引导 |
| 数据目录损坏（doctor 探测 / start 失败归因） | CONFIG_INVALID（retryable=false） | E2 面板："MySQL's data directory looks damaged." + [View logs] + [Recreate data directory]（danger，模态二次确认："This erases all local databases. Export first if needed."） |
| daemon 未运行 | DAEMON_NOT_RUNNING | 全视图 E3 + 自动拉起等待态 |

## 交互

- 每卡操作配 CommandChip（注册表模板渲染，显式站点名形规则不适用——服务命令无站点参）：start = `corral mysql:start`、stop = `corral mysql:stop`、restart = `corral mysql:restart`、install = `corral mysql:install 8.4`（mysql 卸载 chip = `corral mysql:uninstall 8.4`，卸载入口在卡头 More 菜单 `ellipsis`，防误触）；redis 同族对称（install = `corral redis:install`——7.x 单版本**无版本参**，uninstall = `corral redis:uninstall`；多版本管理不做，见 Spec §3）
- 刷新时机：切视图/daemon 事件推送即刷新（禁轮询）；start/stop 后 200ms 内本地乐观 + daemon 回执校正（失败回滚 + toast）
- 启动慢容忍：MySQL 首启 3–10s 属预期——starting 态文案 "MySQL is starting — first launch takes a few seconds."，禁 10s 内转 error（秒表阈值对 mysql 放宽至 15s，实现以 daemon 事件为准）

## 键盘

↑↓ 卡导航 · ↵ 触发行主操作（Start/Stop/Install） · ⌘K 面板（含 "Start MySQL" / "Start Redis" quick actions）

## 响应式

<720px：信息行双列改单列；.env 复制行文字截断（完整值 tooltip）；操作组收进卡头 More。

## 文案 deck

toast 集："MySQL started." / "Redis started." / "MySQL stopped." / "Installed MySQL {v}." / "Copied `{command}`" / "Couldn't start MySQL. {reason}"（失败态 reason 来自 daemon hint，UI 不编撰）

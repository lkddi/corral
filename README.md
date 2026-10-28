# Corral

> 工作名（WIP name），最终命名待定。

开源的本地开发环境管家——类 [Laravel Herd](https://herd.laravel.com) 的 native 双端（macOS + Windows）PHP 开发环境，零付费墙，CLI 一等公民。

## 它是什么

Corral 为 Laravel/PHP 开发者提供一键式本地开发环境：多 PHP 版本并存与切换、站点链接（`~/Code/my-app` → `https://my-app.test`）、通配符 TLS 证书（mkcert）、nginx 站点托管、DNS 解析、**MySQL / Redis 附加服务**、**Xdebug 一键开关**、实时日志与内置终端。GUI 与 CLI 共享同一 daemon，关窗不停服。

> **平台策略**：v1.0 = **macOS only**（12+，Intel + Apple Silicon）；Windows 架构设计已冻结，v1.1 启用——代码经平台抽象层隔离，补 Windows 零重构。

## 为什么做（差异化）

- **Herd Pro 付费墙后的功能免费给**：站点隔离（isolate）、多 PHP 版本、附加服务（MySQL/Redis）、Xdebug 控制等，全部免费。
- **CLI `--json` 一等公民**：每条命令都有稳定的 JSON 信封输出（统一错误码、可重试标记），GUI 中每个操作都展示等价的 CLI 命令——对 AI agent 与脚本用户友好。
- **macOS 原生一等公民**（v1.0 聚焦打磨；Windows v1.1 冻结设计零成本启用）：不做"Windows 是二等公民"的双端跷跷板，先在一端做到 Herd 级体验。
- **Laravel 开箱即用**：每个 PHP 版本内置 Laravel 官方系统需求全部扩展 + 开发常用集（zip/bcmath/intl/gd/pdo_mysql/pdo_pgsql/sqlite3/redis/xdebug），`corral link` 后零额外扩展安装。

## 技术栈（规划，已锁定）

| 层 | 选型 | 版本 |
|----|------|------|
| 桌面壳 | Electron | 45.x |
| 语言 | TypeScript（全栈） | 5.x |
| 前端 | React + Tailwind CSS v4 | React 19.3.1 / Tailwind v4.3.3 |
| 图标 | Lucide（唯一，精确钉死） | 1.61.0 |
| 核心 daemon | 零 Electron 依赖的独立常驻进程 | 随包 Node 24.22.0 |
| Web 服务器 | nginx（双端随包） | 稳定版 |
| TLS | mkcert 通配符证书 | 最新版 |
| DNS | macOS dnsmasq + /etc/resolver；Windows hosts + helper | — |
| PHP | 按需下载 + SHA256 校验（首批 8.1–8.4） | — |
| 附加服务 | MySQL 8.4 LTS + Redis 7.x（与 PHP 同 catalog 按需下载，ADR-008） | daemon 托管，默认不登录自启 |
| 调试 | Xdebug 3.x（随 PHP 版本内置，`debug:on/off` 开关，ADR-009） | mode 默认 off |
| 终端 | xterm.js（renderer）+ node-pty（宿主 daemon，实测见 spikes/） | node-pty 1.1.0 |

架构细节见 [docs/decisions/](docs/decisions/)（ADR-001 ~ ADR-009）。

## 文档

| 目录 | 内容 |
|------|------|
| [docs/phase1/](docs/phase1/) | PRD、竞品与架构调研、三文档一致性终检（R1–R12 裁决记录） |
| [docs/decisions/](docs/decisions/) | ADR-001 ~ 007 架构决策记录 + 未决事项登记册 |
| [docs/design/](docs/design/) | 设计契约：DESIGN.md、design-system（Token / 组件状态 / 图标）、pages（Sites / PHP / Logs / Console / 命令面板） |
| [docs/spec/](docs/spec/) | Spec 规格契约（13 节）、openapi.yaml（37 端点 / 10 错误码 / 18 组命令面）、技术附件 |
| [docs/spikes/](docs/spikes/) | 技术验证报告（node-pty 双端 spike、PHP 运行时与站点链路实测） |

## 当前状态

**I1 已交付（可跑通真实站点）**：规格冻结后进入增量开发，I1 完成——

- monorepo 5 包（shared 命令注册表 / core daemon + 服务层 / cli / Electron 壳 / React 渲染层），TypeScript strict 全绿
- **站点链路全真**：`corral link` → nginx vhost（独立 conf 生成）→ php-fpm unix socket → HTTP 响应实测返回 `PHP 8.4.23 / fpm-fcgi`
- **PHP 按需下载**：catalog 实时通道 + 离线快照，cli+fpm 双制品、Range 断点续传、长度校验、TOFU 摘要
- **五态站点状态**（running/stopped/starting/error/missing）、端口冲突归因到进程+PID、未知 Host 404 不串站
- 实测基线：CLI 冷启动 median 48ms / p95 53ms（预算 250ms）；复跑脚本 `scripts/smoke-i1.sh`
- 已知缺口（已进 Spec §11）：common 构建缺 `intl`/`xdebug`，`phpBuild=bulk` 待 I2 验证后切默认

下一步 I2：macOS 安装器 + doctor 全量检查 + 双架构打包。开发进度见 [docs/spec/spec.md](docs/spec/spec.md) 与 `docs/spikes/`。

## 路线图

- **MVP**：站点 link/unlink、PHP 多版本管理（install/use/isolate，Laravel 扩展集内置）、**MySQL/Redis 服务管理**、**Xdebug 开关**、start/stop 整栈、TLS 证书、Logs、Console 终端、`--json` CLI 全命令面（18 组）
- **v1.1**：**Windows 实现**（冻结设计启用：hosts + helper + php-cgi 进程池）、托盘富面板、GUI 设置窗口、`link [name]` 可选命名
- **后续**：项目脚手架扩展（Symfony/WordPress）、差分更新、社区插件

## 贡献

单人主导的开源项目，欢迎 issue 讨论。开发前请先读 [docs/spec/spec.md](docs/spec/spec.md) 与 P0 绝对规则（禁 emoji 图标 / 禁紫粉渐变 / 禁 AI 模板味）。

## License

[MIT](LICENSE)

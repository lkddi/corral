# Corral

> 工作名（WIP name），最终命名待定。

开源的本地开发环境管家——类 [Laravel Herd](https://herd.laravel.com) 的 native 双端（macOS + Windows）PHP 开发环境，零付费墙，CLI 一等公民。

## 它是什么

Corral 为 Laravel/PHP 开发者提供一键式本地开发环境：多 PHP 版本并存与切换、站点链接（`~/Code/my-app` → `https://my-app.test`）、通配符 TLS 证书（mkcert）、nginx 站点托管、DNS 解析、实时日志与内置终端。GUI 与 CLI 共享同一 daemon，关窗不停服。

## 为什么做（差异化）

- **Herd Pro 付费墙后的功能免费给**：站点隔离（isolate）、多 PHP 版本、站点级配置等，全部免费。
- **CLI `--json` 一等公民**：每条命令都有稳定的 JSON 信封输出（统一错误码、可重试标记），GUI 中每个操作都展示等价的 CLI 命令——对 AI agent 与脚本用户友好。
- **双端同权**：macOS 与 Windows 功能对齐，不做"Windows 是二等公民"。

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
| 终端 | xterm.js（renderer）+ node-pty（宿主 daemon，实测见 spikes/） | node-pty 1.1.0 |

架构细节见 [docs/decisions/](docs/decisions/)（ADR-001 ~ ADR-007）。

## 文档

| 目录 | 内容 |
|------|------|
| [docs/phase1/](docs/phase1/) | PRD、竞品与架构调研、三文档一致性终检（R1–R12 裁决记录） |
| [docs/decisions/](docs/decisions/) | ADR-001 ~ 007 架构决策记录 + 未决事项登记册 |
| [docs/design/](docs/design/) | 设计契约：DESIGN.md、design-system（Token / 组件状态 / 图标）、pages（Sites / PHP / Logs / Console / 命令面板） |
| [docs/spec/](docs/spec/) | Spec 规格契约（13 节）、openapi.yaml（23 端点 / 10 错误码）、技术附件 |
| [docs/spikes/](docs/spikes/) | 技术验证报告（node-pty 双端 spike） |

## 当前状态

**Phase 1.5 —— 规格冻结阶段**：PRD / 架构 / 设计三文档 + Spec v0.9 + openapi.yaml 已完成，一致性终检通过（14 项交叉验证 + 12 条总监裁决）。MVP 范围 8 项 P0 功能，双周增量交付，v1.0 目标 12 周（单人开发约 1.5–2 人月）。

代码尚未开始——Spec 确认后进入 Phase 3 并行开发。

## 路线图

- **MVP**：站点 link/unlink、PHP 多版本管理（install/use/isolate）、start/stop 整栈、TLS 证书、Logs、Console 终端、`--json` CLI 全命令面
- **v1.1**：托盘富面板、GUI 设置窗口、`link [name]` 可选命名
- **后续**：项目脚手架扩展（Symfony/WordPress）、差分更新、社区插件

## 贡献

单人主导的开源项目，欢迎 issue 讨论。开发前请先读 [docs/spec/spec.md](docs/spec/spec.md) 与 P0 绝对规则（禁 emoji 图标 / 禁紫粉渐变 / 禁 AI 模板味）。

## License

[MIT](LICENSE)

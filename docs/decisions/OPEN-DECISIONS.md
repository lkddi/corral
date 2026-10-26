# OPEN-DECISIONS 悬而未决登记册

> 只追加 + 就地关闭（OPEN → RESOLVED）。每次 Phase 开始自动复现到工作上下文最前面。
> 汇总：8 已决 + 2 未决（截至 2026-10-26）

## 未决项

| Date | Source | Open Item | Related Constraints | Current Leaning | Blocked By | Resolves When | Status |
|------|--------|-----------|---------------------|-----------------|------------|---------------|--------|
| 2026-10-26 | Phase 1 | 产品命名：Corral / Stable / Pen / Fold | wordmark/CLI/包名全局引用，越晚定返工越大 | Corral（三方一致倾向） | 用户终确认（三文档评审时） | 用户确认后全局锁定 | OPEN |
| 2026-10-26 | Phase 1 | CLI 冷启动 <250ms 实测验证 | PRD 非功能红线；agent 循环每次调用都有成本 | 实现路径已定：随包 Node 24 + esbuild 零依赖；待 I1 双端 benchmark | 无（实现期验证） | I1 增量出口条件实测通过 | OPEN |

## 已决项

| Date | Decision | Reason | Resolution |
|------|----------|--------|------------|
| 2026-10-26 | 目标平台 macOS + Windows 双端 | 用户选择，对标 Herd 覆盖 | 已确认 |
| 2026-10-26 | 目标用户 Laravel/PHP 开发者 | 直接对标，需求明确 | 已确认 |
| 2026-10-26 | 纯开源免费，无付费墙 | 与 Herd Pro 差异化 | 已确认 |
| 2026-10-26 | 开发者技术底子 TS/JS | 用户确认 | 已确认 |
| 2026-10-26 | 核心选型 Electron + TypeScript 全栈（非 Tauri/Go/原生） | 架构师对比矩阵 + ADR-001/002：一人 TS/JS 底子交付速度优先；核心与壳解耦保留换壳逃生阀 | RESOLVED |
| 2026-10-26 | PHP 分发策略：自托管预编译 + catalog + SHA256 钉死 | ADR-004 + 补充决议：否决 brew/scoop（Homebrew 同时只能 link 一个 PHP，无法多版本并存） | RESOLVED |
| 2026-10-26 | Windows DNS：hosts + SYSTEM helper | ADR-003：Windows 无 /etc/resolver 等价机制；否决 53 端口代理（代理挂掉 = 全机断网） | RESOLVED |
| 2026-10-26 | GUI 选型：Electron | ADR-001：PRD 不预设，架构师锁定 | RESOLVED |
| 2026-10-26 | CLI 运行时：随包 Node 24 + esbuild，不用 Electron 二进制 | RUN_AS_NODE 冷启动达不到 300ms 红线；三处（CLI/daemon/helper）共用同一运行时 | RESOLVED |
| 2026-10-26 | MVP GUI 范围：主窗口三视图 + ⌘K；托盘富面板移出 v1.1；Link a folder 进 MVP；Secure GUI 可点；设置走原生菜单 | PRD P0#8 含日志入口 + PM/设计师对齐裁决 | RESOLVED |
| 2026-10-26 | 主色：Teal（浅 #0F766E / 深 #2DD4BF），终端绿仅限深色代码面 | 设计师裁决：绿 accent 与绿「运行中」状态同屏语义冲突；避 AI 模板靛蓝 | RESOLVED |
| 2026-10-26 | 图标库：Lucide（唯一） | ADR-006 + 设计师 v0.1 一致；P0 门禁通过 | RESOLVED |
| 2026-10-26 | 内存硬规则：FPM pm=ondemand + MVP 默认 4 版本（8.1-8.4） | 7 个 FPM master 常驻 150-160MB 逼近 200MB 红线 | RESOLVED |
| 2026-10-26 | 错误码目录：8 个（架构师 6 + PM 补 NETWORK_ERROR/CHECKSUM_MISMATCH） | agent 消费者需程序化区分网络错误与校验失败 | RESOLVED |
| 2026-10-26 | PHP 分发诠释（按需下载 vs 全内置）与 Windows 签名预算（Azure Trusted Signing $9.99/月） | 总监裁定倾向：按需下载 + 批签名预算；两项均提交用户追认 | 待用户追认 |

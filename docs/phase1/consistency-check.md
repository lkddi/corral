# Phase 1 一致性检查（终版）

> 执行人：大湾区靓仔（总监）| 2026-10-26 | 状态：三方终检完成，随三文档提交用户确认

## 1. 三文档交叉验证总表

| # | 检查项 | PM | 架构师 | 设计师 | 判定 |
|---|---|---|---|---|---|
| 1 | 主色 | 撤回靛蓝建议，采纳 Teal | 不涉及 | Teal #0F766E/#2DD4BF + 终端绿限深色代码面 | **一致**（v0.2 定稿） |
| 2 | 图标库 | SVG 库待架构师锁定 | Lucide（ADR-006） | Lucide（v0.1 锁定） | **一致**（P0 门禁通过） |
| 3 | 技术栈 | 不预设，待架构师 | Electron + TS/Node + React 19 + Tailwind v4（ADR-001/002） | v0.1 曾倾向 Tauri；v0.2 待架构师锁定 | **裁决 R1：采信架构师 Electron** |
| 4 | 主界面布局 | 左导航 + 命令面板 | daemon 架构支持 | 左导航 3 项 + ⌘K 面板 + 标题栏全局 PHP | **一致** |
| 5 | MVP GUI 页数 | P0#8 含「日志入口」 | MVP「站点/PHP 两页」 | v0.2：Sites/PHP/Logs 三视图 | **裁决 R2：三视图**（日志入口是 P0 明文） |
| 6 | 托盘/菜单栏面板 | 裁决移出 MVP（v1.1 fast-follow） | 假设「常驻托盘」 | 建议移出 MVP | **裁决 R3：托盘图标+最小菜单留 MVP，富面板移出** |
| 7 | Link a folder 按钮 | 裁决进 MVP | — | 建议进 MVP | **一致**（进 MVP） |
| 8 | HTTPS GUI 可点 | 裁决可点 | CLI secure + 证书流程支撑 | 建议可点 | **一致** |
| 9 | 设置面 | 裁决：原生菜单 only；parked 走 CLI+配置文件 | — | 建议相同 | **一致** |
| 10 | 产品名 | Corral（待用户终确认） | 命名待定（advisory） | Corral + wordmark 方案 | **一致，待用户确认** |
| 11 | CLI 命令面 | PM 命令集 | 架构师命令集（占位） | UI 命令 chip 引用 | **裁决 R4：统一命令表**（见 §3） |
| 12 | P0 红线 | 合规 | 合规（RoleVerdict pass） | v0.2 自检通过 | **一致** |
| 13 | 性能红线 | CLI <300ms 等 | ADR-002 纯 Node CLI 支撑；风险已识别 | v0.2 §5 UX 转译 | **一致**（实测验证列入 Spec 验收） |
| 14 | 版本号 | — | electron 45.0.0 等（总监 npm 复核修正） | — | **已修正**，Spec 锚定 |

## 2. 总监裁决记录

- **R1 技术栈**：采信架构师 Electron + TS。设计师 v0.1 的 Tauri 倾向作废——其 React/Tailwind/Token 设计体系与壳无关，零损失；ADR-002 保留未来换壳逃生阀。
- **R2 MVP GUI 三视图**（Sites/PHP/Logs）：PRD P0#8 明文「日志入口」，架构师「两页」为其压缩表述，以 PRD 为准。
- **R3 托盘**：MVP 保留托盘图标 + 最小原生菜单（Open/Quit/状态 tooltip，成本低且满足「常驻」）；富面板 v1.1（设计师 v0.1 已有完整面板设计可直接复用）。
- **R4 CLI 命令表统一**（合并 PM 与架构师两版，见 §3）。
- **R5 PHP 版本首批 8.1/8.2/8.3/8.4**（架构师 advisory，采信；7.4/8.0/8.5 第二批）。
- **R6 命名**：Corral 为工作名推进，待用户终确认后全局锁定（wordmark = 深色 pill + 终端绿等宽字）。
- **R7 命令表扩充（2026-10-26）**：新增 `corral php:install <v>` / `corral php:uninstall <v>`——GUI PHP 视图有 Install/Uninstall 按钮而 CLI 无对应命令，违反 1:1 注册表原则；且「agent 通过 CLI 安装 PHP」是产品差异化点。install 触发 catalog 下载 + SHA256 校验，NETWORK_ERROR / CHECKSUM_MISMATCH 错误码在此生效。
- **R8 命令表再扩充 + 语义修正（2026-10-26，架构师提请修订，总监采纳）**：`corral start [site]` / `corral stop [site]`——带站点名 = 启用/停用该站点（停用 = 摘除 vhost + nginx default_server 停止页，状态入注册表持久化）；**无参 = 启停整个本地栈**（nginx + PHP 池 + DNS）。`corral restart [site]` 同步加可选站点参。`--all` 取消（无参即整栈；⌘K Quick actions 渲染无参形式）。PRD P0#6 站点生命周期明文含 start/stop，补此两组后 1:1 注册表无 GUI-only 动作。
- **R9 `corral open` / `corral edit` 语义终裁 v2（2026-10-26，替代 v1）**：`corral open <site>` = 默认浏览器打开站点 URL，**site 必填、无参 = 用法错误**；**CLI 故意不提供「打开 GUI 窗口」命令**（窗口重开由 dock/托盘/开始菜单/桌面快捷方式承担）——CLI 命令面不依赖 GUI 存在，agent 与无头环境安全；与 Herd `herd open`（cwd 推断）的差异在规格命令注释注明。`corral edit [site]` = 文件管理器揭示该站点生成配置目录；「IDE 打开项目」是 GUI 菜单特权，不进命令面。裸命令 `corral` = 显示帮助。**v1（cwd 推断 + CLI 开窗）作废**——架构师 headless 安全论据成立，优于总监 v1 的语境魔法。
- **R10 daemon 架构增补（2026-10-26，架构师提请，总监采纳）**：Console dock = xterm.js（renderer）+ node-pty（**宿主 daemon**，不进 Electron main——main 的 Node ABI 与独立 Node 不同，原生模块进 main 需 electron-rebuild，违反单一运行时原则）；node-pty 由 CI 按平台构建随包分发（与 nginx/mkcert 同一管线），用户零编译；**daemon 新增 WS 流通道**（127.0.0.1 only + token，与 RPC 控制通道分端口）：pty 字节流 + Logs 实时 tail 共用（renderer 是 Chromium 页面，WebSocket 是唯一选项）；daemon bundle 加 `ws` 依赖（纯 JS）。风险门：node-pty 在 Node 24.22.0 双端编译 + 冒烟 spike 列为 Console 实现前早期验证项，不达标走社区预编译分支或降级管道模式。
- **R11 错误码扩充 + --json 副作用规则（2026-10-26，架构师提请，总监采纳）**：错误码 8 → **10**——新增 `USAGE_ERROR`（argv/用法失败：未知命令、缺参、--json 下副作用拒绝——最高频失败面必须有码）与 `SITE_NOT_FOUND`（open/isolate 不存在的站点——agent 需程序化区分「命令敲错」与「站点不存在」，并入 USAGE_ERROR 会迫使消费者字符串匹配，违背信封契约初衷）。`--json` 模式协议规则：**OS 级副作用命令（`open` 的浏览器启动 / `edit` 的文件管理器揭示）在 --json 模式下只返回目标数据（站点 URL / 配置目录路径）、不执行副作用；完整动作仅在非 --json 交互模式执行**（比「拒绝执行」更友好——agent 拿到 URL 自行 fetch）。shell 探测链定为 pwsh → powershell.exe → cmd.exe 三跳（powershell.exe 全版本 Windows 自带；保持可配置）。per-site Restart 采 `corral restart <name>`（可选站点参，已纳入 §3 表），不采 stop&&start 组合 chip——restart 在 daemon 侧是原子操作，拆两条丢原子性且违反「一个动作一条命令」chip 纪律。
- **R3 重申（2026-10-26）**：MVP **保留托盘图标 + 最小原生菜单（Open / Quit / 状态 tooltip）**，富面板移出 v1.1。设计师 DESIGN.md §4.15「MVP 无托盘图标」写于 R3 之前（DESIGN.md 13:47 < consistency-check 13:49），以 R3 为准，§4.15 待修订。
- **R12 命令面微裁定三条（2026-10-26，架构师终局便签提请，总监裁决）**：
  1. **php@ 别名归属修正 + 全入口统一归一化**：§3 语法终裁③「`corral use` 接受 `php@<v>` 兼容 Herd 肌肉记忆」竞品归属有误——Herd 命令面全用裸版本号（`herd use 8.3` / `herd isolate 8.2 --site=x`），`php@<v>` 是 Valet/Homebrew 惯例（`valet use php@8.2` / `valet isolate php@8.1`）。别名保留，理由改为「Valet/Homebrew 迁移者肌肉记忆」，且**统一扩展到所有接受 PHP 版本参数的入口**：`use` / `isolate` / `php:install` / `php:uninstall` / `link --php` / `new --php` 均接受 `php@<v>`，在 shared/commands.ts 注册表层单一归一化为裸版本号；GUI / CommandChip / CLI 输出一律渲染规范裸版本形（禁渲染 php@ 形）。
  2. **`corral use` 无参 = USAGE_ERROR**（不学 Valet「无参打印当前版本」的无参魔法）：当前版本查询走 `corral status`（全局 + per-site 一次给全），USAGE_ERROR 的 hint 直接指向 `corral status`——错误即教学，与「GUI 教 CLI」同精神。命令面无参语义由此收敛为三类：**整栈动作**（start/stop 无参）、**帮助**（裸 corral）、**用法错误**（open / use 缺必填参）。
  3. **`corral link [name]`（可选站点名，Herd `herd link [name]` 对等）登记不采纳**：MVP 维持「站点名 = 目录名」单一推断，命令面冻结最小化；登记为 v1.1 ADR-lite 候选（向后兼容增量，随时可补），不挡 openapi 定稿。

## 3. 统一 CLI 命令表（Spec 锁定依据）

| 命令 | 功能 |
|---|---|
| `corral park <dir>` / `corral unpark <dir>` | 挂载/卸载 parked 目录 |
| `corral link [--php <v>] [--port <n>]` / `corral unlink` | 当前目录上线/下线 |
| `corral secure` / `corral unsecure` | HTTPS 开关 |
| `corral isolate <v>` / `corral unisolate` | 站点钉 PHP 版本（v 接受 `php@<v>` 别名，注册表层归一化，R12） |
| `corral use <v>` | 切换全局 PHP（接受 `php@<v>` 别名；**无参 = USAGE_ERROR，hint 指向 `corral status`**，R12） |
| `corral php:list` | 版本列表（已装/可用） |
| `corral php:install <v>` / `corral php:uninstall <v>` | PHP 版本安装/卸载（catalog 下载 + SHA256 校验；NETWORK_ERROR/CHECKSUM_MISMATCH 生效） |
| `corral start [site]` / `corral stop [site]` | 带站点名 = 启用/停用该站点（停用 = 摘除 vhost + 停止页，状态持久化）；无参 = 启停整个本地栈（nginx + PHP 池 + DNS） |
| `corral restart [site]` / `corral status` / `corral logs` | 重启（可带站点参）/ 状态（五态同词表）/ 日志 |
| `corral open <site>` | 默认浏览器打开站点 URL（site 必填，无参 = 用法错误；CLI 不提供开窗命令，与 Herd cwd 推断不同，规格注明） |
| `corral edit [site]` | 文件管理器揭示站点生成配置目录（IDE 打开 = GUI 特权，不进命令面） |
| `corral new <framework> <name> [--php <v>]` | 项目脚手架（可选 --php 初始版本，R12 版本入口之一） |
| `corral doctor` / `corral uninstall` | 自检/卸载 |
| `corral`（裸命令） | 显示帮助与命令列表（GUI 窗口入口 = dock/托盘/开始菜单，CLI 不承担） |
| 全部命令支持 `--json` | 机器可读输出（status/data/error） |

**命令语法终裁（2026-10-26，总监）**：① 冒号式子命令（`corral php:list`），对齐 Herd `herd php:list` 品类习惯；② PRD §5 验收标准旧表述 `corral php 8.1` 已同步为 `corral isolate 8.1`（站点钉版本），全局切换为 `corral use <v>`；③ `corral use` 接受 `php@<v>` 别名（如 `corral use php@8.3`）兼容 Valet/Homebrew 肌肉记忆（Herd 全用裸版本号，非其惯例），解析时归一化；**该别名统一扩展到所有版本参数入口**（use/isolate/php:install/php:uninstall/link --php/new --php，R12）；④ **spec.md 不存在**——Spec 按流程待用户确认三文档后由总监生成（Phase 1.5），命令表唯一权威是本表。

**站点状态枚举（五态，CLI/GUI 同词表）**：`running` / `stopped` / `starting` / `error` / `missing`——`missing` 为 parked 目录被删除时的状态（PRD §8 边界条件：站点标记失效而非静默消失）。daemon 必须枚举五态，`corral status` 与 GUI 状态列同词。

**--json 模式协议规则（2026-10-26，R11）**：OS 级副作用命令（`corral open` 的浏览器启动 / `corral edit` 的文件管理器揭示）在 `--json` 模式下只返回目标数据（站点 URL / 配置目录路径）、不执行副作用；完整动作仅在非 --json 交互模式执行。shell 探测链：pwsh → powershell.exe → cmd.exe（可配置）。

## 4. PM 三个开放问题的闭环

| PM 开放问题 | 架构师结论 |
|---|---|
| PHP 二进制分发策略 | ADR-004：按需下载 + catalog + SHA256 校验 |
| Windows 本地 DNS 方案 | ADR-003：hosts 精确条目 + SYSTEM helper 服务 |
| GUI 技术选型 | ADR-001：Electron + TypeScript 全栈 |

## 5. 版本复核（npm registry 实测，2026-10-26）

| 包 | 实测版本 | 架构师报告引用 | 处理 |
|---|---|---|---|
| electron | **45.0.0** | 41.5.0 | 报告来源滞后，Spec 以 45.x 锚定 |
| electron 捆绑 Node | **24.22.0** | Node 24.15.0（滞后引用） | CLI/daemon/helper 随包 Node 运行时钉 24.22.0 逐位对齐（架构师连带决策，总监采纳） |
| electron 捆绑 Chromium | **156.0.8078.48** | 146（滞后引用） | 已修正 |
| lucide-react | **1.61.0** | "^1.x" | 成立，**精确钉 1.61.0**（exact，leaf 依赖） |
| react | **19.3.1** | React 19 | 成立 |
| tailwindcss | **4.3.3** | v4 | 成立 |

lucide-react 1.61.0 重命名实证：more-horizontal → ellipsis、alert-circle → circle-alert、alert-triangle → triangle-alert、terminal → square-terminal；`github` 图标已从 Lucide 移除（star + 文字标签替代）。

## 6. 提交用户确认的变更摘要（相对最初三文档）

- **设计 v0.2**：配色定稿（Teal + 范围化终端绿）、Corral 品牌、MVP I4 三视图 + ⌘K、三大错误态、英文文案系统
- **PRD v1.0**：PHP 分发闭环（自托管 + SHA256，否决 brew/scoop）、Windows DNS 闭环（hosts + helper）、ondemand + 4 版本默认、错误码 8 个、I1 冷启动基准 <250ms、doctor 探测已有 DB、NSIS 安装器
- **架构补充决议**：CLI 运行时改为随包 Node 24 + esbuild（不用 Electron 二进制）；8 条新约束族（统一命令信封/127.0.0.1 only/命令同源注册表/禁 shell:true/link <3s/DB 不在 MVP/monorepo I1 即建/NSIS）；包体 150-200MB
- **错误契约**：统一信封 `{status, data, error:{code, message, hint, retryable?}}`——`retryable` 由 daemon 端判定（网络类可重试、配置/校验类不可重试），PM 已批准；**10 个错误码**（架构师 6 + PM 补 NETWORK_ERROR/CHECKSUM_MISMATCH + R11 补 USAGE_ERROR/SITE_NOT_FOUND）
- **图标库补登（2026-10-26）**：lucide-react 精确钉 1.61.0（约 2,171 条目，MVP 33 图标中 31 个直接可用）；`github` 图标已从 Lucide 移除（star + 文字标签替代）；重命名统一走新规范名（ellipsis/circle-alert/triangle-alert）；P0 边界裁定：app icon 与托盘 template image 属品牌美术资产豁免锁定，emoji 禁令全局有效
- **架构**：ADR-001~007 落盘（001/002 已按补充决议修订）、版本修正、7 条不可行警告转入 Spec 约束清单

## 7. 待用户拍板（4 项）

1. **三文档确认**——确认后自动推进：Phase 1.5 生成 Spec（规格契约）→ Phase 2 设计细化 → Phase 3 并行开发 → Phase 4 测试交付；此后仅在技术不可行或 P0 缺陷时打扰用户
2. **产品命名**：Corral（总监/PM/设计师一致倾向）/ Stable / Pen / Fold / 用户指定
3. **PHP 分发诠释**（PM 提请，总监裁定：采纳按需下载）：4 个主力版本默认 + 全版本按需下载 + SHA256 钉死——Herd 同策略、品类标准；字面「全内置打包」包体增至 200-350MB，不建议
4. **Windows 签名预算**（PM 提请，总监裁定：建议批）：Azure Trusted Signing 约 $9.99/月（约 $120/年）——不批也能发版，但 SmartScreen 恐吓 + 无差分更新，对开源项目冷启动伤害大

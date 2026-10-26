# PRD：开源本地开发环境管家（工作名 Corral）v0.9

> 产品经理：许清楚 | 状态：待评审 | 评审人：大湾区靓仔（总监）、架构师、设计师
> 数据截至 2026-10，所有竞品信息均来自公开来源，文末附来源清单。

---

## 一、问题陈述

**谁**：Laravel/PHP 开发者（全球约 600 万 PHP 开发者，其中 64% 使用 Laravel，JetBrains State of PHP 2025，n=1720），主力平台为 macOS + Windows。

**场景**：同时维护多个 PHP 版本各异的项目（PHP 8.x 使用率 89%，7.x 仍占 33%），每接入一个项目都要重复解决：装/切 PHP 版本、配 nginx vhost、配 hosts/DNS 解析 .test 域名、签 HTTPS 证书、起数据库服务。

**现在的解决方案为什么不行**：
- **Laravel Herd（闭源 freemium）**：核心免费，但数据库服务、邮件捕获、日志、dump 窗口、Xdebug 检测、以及「面向编码 agent 的运行时上下文」全部锁在 $99/年 Pro 墙后；无 Linux；Windows 上需手动加 Defender 排除项，PHP 补丁版本更新滞后数日。
- **Lerd（开源 MIT）**：理念最接近（无付费墙），但架构依赖 rootless Podman 容器，macOS 上跑在 Podman VM 里，文件 I/O 不如原生二进制；Windows 仅 WSL2 beta。
- **Laragon**：仅 Windows；v6 之后改为许可证制，免费版有 license 弹窗打扰。
- **Laravel Valet（开源）**：仅 macOS，且强耦合 Homebrew；数据库完全自理；Intel Mac 正被 Homebrew 逐步放弃（2027 年 9 月起停止支持）。
- **Laravel Sail（Docker）**：生产一致性最好，但每项目一套容器：内存/耗电高、绑定挂载文件系统慢、多项目端口冲突、强依赖 Docker Desktop。
- **XAMPP/MAMP**：XAMPP「为便利而非安全配置，版本滞后于上游」；MAMP 的每项目 hosts 需付费 MAMP PRO。

**一句话**：市场需要一个**原生性能（不依赖 Docker/Podman）、macOS + Windows 双端一等公民、完全开源零付费墙**的本地环境管家，并且从第一天起就能被 AI 编码 agent 驱动。

---

## 二、目标用户画像

### 画像 A（主要）：接单 freelancer「老张」
- 32 岁，自由职业，同时维护 8–12 个客户 Laravel 项目，PHP 版本 7.4 / 8.1 / 8.3 混杂
- 设备：Windows 台式机 + MacBook 双机；技术水平高，习惯脚本化一切
- 现状：Herd Free 用户，被 $99 Pro 墙挡住；试用过 Sail 嫌太重
- 诉求：新项目 clone 下来 30 秒出 https 站点；批量管理 parked 目录；CLI 可进 CI/脚本；不要账号、不要订阅

### 画像 B（主要）：AI 优先全栈「小林」
- 26 岁，创业公司全栈，日常 Claude Code + Cursor
- 现状：Sail 用户，受够 Docker Desktop 内存占用与 Windows 文件系统减速；agent 想自己建站/跑迁移/读日志却只能靠人复制粘贴
- 诉求：本地环境对 agent 可编程（CLI --json / MCP）；环境操作不离开终端；迭代循环要快
- 传播价值：GitHub star 活跃、写 issue、发内容，是早期采用者与社区种子

### 画像 C（次要）：小团队 Tech Lead「阿伟」
- 28 岁，带 5–15 人 PHP 团队；新人入职环境统一是 recurring 成本
- 诉求：开源可审计（合规）、无遥测、无账号；团队配置即代码可入库；新人 30 分钟从 clone 到跑起来

### 典型场景
1. **老张的新客户日**：`git clone` 客户老项目 → `corral link --php 7.4` → 30 秒后 https://client-legacy.test 可访问；`corral park ~/clients` 一次挂载，12 个站点全部自动上线。
2. **小林的 agent 工作日**：在 Claude Code 里说「给 feature 分支建个独立测试站并跑迁移」→ agent 调用 `corral link --json` → 读 `corral logs --json` 拿到报错 → 修复 → 全程不离开终端。
3. **阿伟的入职日**：新人装一个安装包 → `corral doctor` 自检通过 → clone 仓库 → `corral link` → 与全组环境一致；源码可读、无遥测，过安全审计无压力。

---

## 三、竞品分析

### 直接竞品

| 竞品 | 核心功能 | 优势 | 劣势（来自真实差评/限制） | 定价 |
|---|---|---|---|---|
| Laravel Herd | 原生 PHP/nginx/Dnsmasq；多版本切换；.test；Pro: MySQL/PG/Redis、Mail、Logs、Dumps、Xdebug 检测、agent 运行时上下文 | 原生二进制速度（冷启动 <300ms）；UI 打磨最好；Laravel 官方生态 | 闭源；日常调试功能锁 $99 Pro；无 Linux；Windows 需手动 Defender 排除；PHP 补丁滞后数日 | 免费 + Pro $99/年 + Teams $299/年 |
| Lerd | rootless Podman 跑 nginx/PHP-FPM/服务；.test + mkcert TLS；PHP 7.4–8.5；dump 窗口、worktree 隔离、内置 MCP server | MIT 全功能无付费层；无 Docker daemon；PHP/Node/Python/Go 通吃；配置即代码 | 依赖 Podman；macOS 上容器在 VM 内、文件 I/O 不如原生；Windows 仅 WSL2 beta；功能面过大 | 完全免费 MIT |
| Laragon | 便携文件夹；自动 vhost；一键自签 SSL；多版本服务；Cmder 集成 | Windows 上体验最好；便携；社区口碑极佳 | 仅 Windows；v7 起需购许可（免费版弹窗提醒）；自签证书需手动信任；无配置即代码 | v6 免费；v7+ 非商业 $10–40 / 商业年付 |
| Laravel Valet | Homebrew 原生 PHP-FPM + nginx + Dnsmasq；park/link；per-site PHP；TLS | 免费开源；极轻量；速度快 | 仅 macOS；强耦合 Homebrew；数据库自理；Intel Mac 被 Homebrew 逐步放弃 | 免费 MIT |

### 替代方案

| 方案 | 一句话定位 | 关键痛点 |
|---|---|---|
| Laravel Sail（Docker Compose） | 生产一致性优先 | 绑定挂载在 macOS/Windows 慢；内存/耗电；端口冲突；依赖 Docker Desktop |
| XAMPP | 老牌 Apache 全家桶 | 为便利而非安全配置；版本滞后上游；无 .test 自动域名 |
| MAMP | macOS/Windows 图形化栈 | 每项目 hosts 需付费 MAMP PRO |
| Homebrew 自建 | 完全手工 | 「装个 PHP 要下载半个互联网」；多版本共存靠 link/unlink 手工舞步 |

### 差评汇总 → 市场空白
1. **付费墙位置错误**：Herd 把「每天都在用的 debug/邮件/数据库」放付费层。→ 空白：**核心体验完整免费**。
2. **容器税**：Lerd/Sail 用户为「隔离」付出容器开销。→ 空白：**原生二进制 + 无 Docker/Podman 依赖**。
3. **平台割裂**：Laragon 只 Windows、Valet 只 macOS、Herd 无 Linux、Lerd 的 Windows 是 WSL beta。→ 空白：**macOS + Windows 双端原生一等公民**（Linux 暂不做）。
4. **Agent 失明**：Herd Pro 才给「agent 运行时上下文」。→ 空白：**env 级 agent 可编程性（CLI --json + MCP）免费内置**。
5. **可持续性质疑**：用户对闭源工具的长期维护存疑。→ 空白：**MIT + 路线图公开 + 无账号无遥测**。

---

## 四、差异化定位

**一句话**：Corral 是开源免费（MIT）、原生双端（macOS + Windows）、agent 友好的 PHP 本地开发环境管家——Herd 的体验，Lerd 的自由，没有容器税，没有付费墙。

| 维度 | Herd | Lerd | Laragon | Valet | Sail | **Corral** |
|---|---|---|---|---|---|---|
| 开源/许可 | 闭源 | MIT | v7 起收费 | MIT | MIT | **MIT，零付费墙** |
| macOS 原生 | 是 | beta（容器 VM） | 否 | 是 | 容器 | **是（原生二进制）** |
| Windows 原生 | 是 | WSL2 beta | 是（仅 Win） | 否 | 容器 | **是（原生）** |
| 无容器依赖 | 是 | 否（Podman） | 是 | 是 | 否 | **是** |
| Agent 可编程 | Pro 付费 | MCP 内置 | 无 | 无 | 无 | **CLI --json 免费 + MCP（P1）** |
| 账号/遥测 | 否 | 无 | 许可激活 | 否 | 否 | **无账号；遥测默认关闭** |

**为什么选我们**：老张不想付 $99 也不想装 Podman；小林的 agent 需要一个能调用的环境 API；阿伟要可审计。三者的交集只有一个产品形态：开源、原生、双端、脚本化。

---

## 五、核心功能清单（RICE 评分）

评分标准：Reach 1–10；Impact 0.25/0.5/1/2/3；Confidence 50%/80%/100%；Effort 1–10 人月（**按一人开发估**）。Score = (R×I×C)/E。

| # | 功能 | R | I | C | E | Score | 分级 | 增量 |
|---|---|---|---|---|---|---|---|---|
| 1 | 本地 DNS + nginx 自动 vhost（.test 自动解析） | 10 | 3 | 100% | 2 | 15.0 | P0 | I1 |
| 2 | 安装器 + doctor 自检 + 自动更新 | 10 | 3 | 100% | 2 | 15.0 | P0 | I2/I5 |
| 3 | PHP 多版本管理（7.4–8.5）+ 每站点钉版本 | 10 | 3 | 100% | 3 | 10.0 | P0 | I1 |
| 4 | Parked 目录自动建站（监听目录，新文件夹自动上线） | 9 | 2 | 100% | 1 | 18.0 | P0 | I3 |
| 5 | CLI 全功能 + `--json` 机器可读输出 | 9 | 2 | 80% | 1 | 14.4 | P0 | I1/I5 |
| 6 | 站点生命周期（link/unlink/start/stop/restart/status） | 10 | 2 | 100% | 1 | 20.0 | P0 | I1 |
| 7 | 一键 HTTPS（本地 CA 生成 + 自动信任系统钥匙串/根存储） | 8 | 2 | 80% | 2 | 6.4 | P0 | I3 |
| 8 | 最小桌面 GUI（站点列表/状态/PHP 切换/日志入口） | 10 | 2 | 100% | 3 | 6.7 | P0 | I4 |
| 9 | 项目级配置文件（.corral.yaml 入库，配置即代码） | 6 | 2 | 80% | 1 | 9.6 | P1 | I5 |
| 10 | 项目脚手架（`corral new laravel blog`） | 6 | 1 | 80% | 1 | 4.8 | P1 | I5 |
| 11 | Xdebug 一键开关（改 ini + FPM 重启） | 6 | 1 | 80% | 1 | 4.8 | P1 | I5+ |
| 12 | 数据库服务一键起（MySQL/Redis/PG） | 8 | 2 | 80% | 5 | 3.2 | P1 | 后续 |
| 13 | MCP server（env 级工具暴露给 Claude Code/Cursor） | 5 | 2 | 50% | 2 | 2.5 | P1 | v1.5 |
| 14 | 多语言界面 i18n | 8 | 1 | 50% | 2 | 2.0 | P2 | 后续 |
| 15 | Node 版本管理 | 6 | 1 | 80% | 3 | 1.6 | P2 | 后续 |
| 16 | 隧道分享（cloudflared/ngrok） | 4 | 1 | 80% | 2 | 1.6 | P2 | 后续 |
| 17 | Tinker REPL（GUI 内） | 4 | 1 | 80% | 3 | 1.1 | P2 | 后续 |
| 18 | dump/debug 窗口（拦截 dump()/dd()） | 5 | 2 | 50% | 5 | 1.0 | P2 | 后续 |
| 19 | PHP 扩展管理（pecl） | 6 | 1 | 50% | 4 | 0.75 | P3 | 后续 |
| 20 | Git worktree 分支隔离 | 3 | 1 | 50% | 4 | 0.375 | P3 | 后续 |
| 21 | 性能剖析（flame graph） | 3 | 1 | 50% | 5 | 0.3 | P3 | 后续 |

---

## 六、MVP 范围与增量计划

### MVP = P0（8 项），按双周增量交付（一人开发，6 个增量 / 12 周到 v1.0）

| 增量 | 周期 | 内容 | 可演示结果 |
|---|---|---|---|
| I1 | W1–2 | CLI 骨架；PHP 二进制下载管理（SHA256 校验）；`link/unlink`；nginx vhost 自动生成；macOS 本地 DNS | macOS 上 `corral link` 后 http://app.test 可访问 |
| I2 | W3–4 | Windows 对等实现（DNS + nginx + PHP）；安装器（.dmg/.exe）；`doctor` 自检 | Windows 同命令可用；新人装完即通过自检 |
| I3 | W5–6 | 一键 HTTPS（本地 CA + 系统信任）；parked 目录监听自动建站 | `corral park ~/code` 后新目录 60 秒内自动上线 https |
| I4 | W7–8 | 最小桌面 GUI（站点列表、状态、PHP 版本切换、日志入口） | 不敲命令也能完成 80% 日常操作 |
| I5 | W9–10 | CLI `--json` 全量化；.corral.yaml 配置即代码；`corral new` 脚手架；自动更新 | 脚本/agent 可驱动全部核心操作 |
| I6 | W11–12 | 边界状态打磨（空/错/加载/离线/权限）；埋点（opt-in）；双语 README；发布 v1.0 | 公开发布，Laravel News 等渠道投稿 |

### MVP 明确不做（及原因）

| 不做 | 原因 | 何时重新评估 |
|---|---|---|
| 数据库服务（MySQL/PG/Redis） | 单人最大工作量项之一（约 5 人月）；MVP 期先做「检测并复用用户已有本地 DB」的兜底提示 | v1.2，视采用数据 |
| 邮件捕获 | 与数据库同理；先引导用 Mailpit 独立工具 | v1.3 |
| dump 窗口 / profiler / Tinker | 深度调试栈是社区成熟后的重投入 | v2.0，且有赞助资金后 |
| MCP server 进 MVP | CLI `--json` 已让 agent 可用；MCP 是薄封装，放 v1.5 收反馈后再做 | v1.5 |
| Linux 支持 | 硬约束为 macOS + Windows；Linux 上已有 Lerd 占位 | 社区贡献者出现后 |
| 多语言界面 | 开发者工具通用语为英文，MVP 界面英文 | v1.2 |
| 容器/VM 模式 | 与「原生、无依赖」定位冲突 | 不做 |
| 遥测默认开启 | 开源社区信任是生命线；opt-in + 首次运行明示 | 永不默认开启 |

---

## 七、验收标准（Given/When/Then）

**核心循环**
- Given 用户已完成安装且 PHP 8.3 已下载，When 在项目目录执行 `corral link --php 8.3`，Then 3 秒内 https://<目录名>.test 返回该项目的 PHP 8.3 响应。
- Given 已配置 `corral park ~/code`，When 在 ~/code 下新建目录 newapp，Then 60 秒内 https://newapp.test 自动可访问。
- Given 站点已链接，When 在项目目录执行 `corral isolate 8.1`，Then 该项目后续请求由 PHP 8.1 处理，其他站点不受影响（全局版本切换用 `corral use <v>`；命令表权威版本见 consistency-check.md §3）。
- Given 本地 CA 未安装，When 执行 `corral secure`，Then 系统信任库新增本地 CA，浏览器访问 .test 无证书警告。

**双端对等**
- Given Windows 11 + PowerShell，When 执行与 macOS 相同的 link/park/secure 命令序列，Then 行为与结果一致（命令名、参数、输出结构相同）。
- Given macOS 12+（Intel 与 Apple Silicon 均验证），When 安装并链接站点，Then 全流程无需用户手动编辑 hosts 文件或安装 Homebrew。

**脚本化与 agent**
- Given 任意 CLI 命令，When 追加 `--json`，Then 输出为合法 JSON，含 `status` / `data` / `error` 字段，可被 jq 与 agent 解析。
- Given 无网络，When 链接一个使用已下载 PHP 版本的站点，Then 全部功能正常；下载新版本时给出明确失败原因与重试入口。

**GUI**
- Given 已链接 ≥1 个站点，When 打开 GUI，Then 首屏 2 秒内展示站点列表（名称/域名/PHP 版本/运行状态/HTTPS 标记）。
- Given 站点正在启动，When 用户查看该站点，Then 显示加载状态与进度，不出现无限转圈。

---

## 八、边界条件

- **空状态**：无站点时 GUI 展示真实可复制的命令示例与文档链接；禁止 "Welcome to Corral" 类空洞占位文案。
- **错误状态**：80/443 端口被占用时明确报出占用进程名与 PID 并给出释放指引；CA 信任被拒绝时说明手动信任步骤；PHP 下载失败时区分网络错误与校验失败并支持重试。
- **加载状态**：PHP 版本下载显示进度条与速度；站点启动显示「启动中」；GUI 异步操作有可取消或可观测的中间态。
- **边界值**：站点名含连字符/下划线/点；同名站点重复 link（后者覆盖并提示）；parked 目录被删除（站点标记失效而非静默消失）；符号链接目录；单机 100+ 站点时列表仍可用。
- **并发**：CLI 与 GUI 同时操作同一站点（以后写入者为准并提示）；并行 link 多个站点不互相阻塞。
- **离线**：断网可链接已缓存 PHP 版本的站点；composer install 等失败时错误信息含「网络不可用」归因。
- **权限拒绝**：CA 安装与 Windows DNS 监听需要提权，被拒时给出降级说明（如手动信任指南）而非静默失败。
- **卸载**：提供 `corral uninstall` 或文档化的完整卸载路径（含 CA 移除、DNS 配置还原）。

---

## 九、非功能需求

| 类别 | 要求 | 优先级 |
|---|---|---|
| 性能 | CLI 冷启动 <300ms；`link` 到可访问 <3s（PHP 已缓存）；守护进程空闲常驻内存 <200MB；GUI 首屏 <2s | P0 |
| 可用性 | 守护进程崩溃自动重启；单站点故障不波及其他站点；PHP-FPM/nginx 配置热重载失败时自动回滚 | P0 |
| 安全 | 服务仅监听 127.0.0.1；所有下载二进制 SHA256 校验；本地 CA 私钥不出本机；安装包代码签名（macOS 公证 + Windows Authenticode）；无遥测默认开启 | P0 |
| 兼容性 | macOS 12+（Intel + Apple Silicon）；Windows 10/11；PowerShell 与 CMD 下 CLI 行为一致 | P0 |
| 可访问性 | WCAG 2.1 AA 基本合规：键盘可达、对比度达标、焦点可见 | P2 |
| 国际化 | 架构预留 i18n 接口；MVP 界面英文 | P2 |
| 数据埋点 | opt-in、匿名、可一键关闭 | P1 |

### 设计约束（移交设计师，P0 规则）
- **图标**：所有功能图标以文字语义描述，方案为统一 SVG 图标库，具体库由架构师按项目选型锁定；**禁止使用 emoji 字符作为功能图标**。
- **配色**：**禁止紫色→粉色渐变主视觉**。建议方向：深靛蓝/石板蓝主色 + 终端绿强调色，最终由设计师定稿。
- **文案**：全部使用真实可操作微文案，禁止 "Welcome to..." / "Lorem ipsum" 类空洞占位。
- **布局**：左侧导航 + 右侧站点列表为主界面；支持命令面板（Cmd+K）直达站点操作。

---

## 十、数据埋点方案（验证产品假设用）

opt-in 匿名埋点：首次运行明示征求同意，默认关闭；不上报 IP、不存原始输入内容。

| 事件类别 | 必埋事件 | 说明 |
|---|---|---|
| 获客 | `install_complete`, `first_launch` | 安装→启动转化 |
| 激活 | `site_linked`（含 php_version、platform、is_parked） | 核心假设：首次会话完成建站 |
| 留存 | `session_start`, `cli_invoked`（含 command） | DAU/MAU、高频命令（指导 P1 排序） |
| 传播 | `star_clicked`（GUI 内 GitHub 入口） | star 漏斗 |
| 异常 | `error_occurred`（含 error_code、platform、version） | 错误归因，路径脱敏 |

---

## 十一、开源策略与可持续模式建议

**结论：赞助模式不可作为收入预期**。策略分三期：

**Phase 1（0–6 月，MVP 期）：零收入预期，成本压到近零**
- 一人开发 + GitHub Actions 免费额度；唯一硬成本是 Apple 开发者账号 $99/年（公证）与可选 Windows 签名证书。
- 目标不是钱：star 数、真实用户数、issue 质量、内容传播（Laravel News 投稿先例）。

**Phase 2（6–18 月）：低成本线 + 生态赞助**
- 开通 GitHub Sponsors + Open Collective，设定 $300/月成本覆盖线，不背全职 KPI。
- 定向接触 PHP 生态厂商赞助；赞助者权益只做「荣誉展示 + 路线图投票权」，不做功能门禁。

**Phase 3（18 月+，可选，须社区共识）：卖组织级省心，不卖开发者日常**
- 可选形态：商业支持 SLA；OEM 双许可；团队配置托管同步。核心 MIT 不动。
- **红线**：任何 Phase 3 决策不得把「每天都在用的功能」放进门后；也不得用弹窗打扰免费用户。
- **许可证纪律**：MIT 一旦选定不轻改。

**增长飞轮**：README/SEO → star → 教程内容 → 贡献者 → 生态模板（框架检测规则社区共建）。

---

## 十二、风险与开放问题

1. **PHP 二进制分发**：自托管静态编译包 vs 首次运行引导 brew/scoop 安装。涉及法律与带宽，请架构师评估。
2. **Windows 本地 DNS**：hosts 文件自动化 vs 轻量 DNS 代理监听 53 端口（需提权）。请架构师定。
3. **GUI 技术选型**：约束为 TS/JS 可维护、双端构建、体积可控；具体选型由架构师决定，PRD 不预设。
4. **命名**：Corral / `corral` 为工作名（Herd 是兽群，Corral 是圈住它们的栏）；备选 Stable/Pen/Fold。需总监确认。
5. **与 Laravel Boost 的关系**：Boost 是 app 级 MCP，我们是 env 级。文档需明确「互补不竞争」。
6. **预算项**：Apple Developer $99/年（建议 Phase 1 就买）；Windows 签名证书可推迟。
7. **采用验证时点**：v1.0 发布后 8 周，若「首次会话完成建站率」<40%，优先修 onboarding 而非加功能。

---

## 十三、参考来源

1. herd.laravel.com / herdphp.com — Herd 定价与功能边界
2. benjamincrozat.com/laravel-herd — Herd Windows Defender 排除项、补丁滞后
3. abrarqasim.com — Herd 付费墙边界与 freelancer 经济学
4. coderfunda.blogspot.com — 社区对 Herd 闭源/无路线图的质疑
5. lerd.sh + laravel-news.com/lerd — Lerd 功能矩阵、MIT、Podman 依赖
6. laragon.org/pricing + filehorse.com — Laragon 许可模式
7. itechguides.com + github.com/laravel/valet#1576 + sailmanager.app — Valet 限制与三工具横评
8. stackoverflow.com / lexo.ch / openillumi.com — Sail 性能证据
9. wares.gg — XAMPP/MAMP 限制
10. JetBrains State of PHP 2025 + statista.com — 市场规模：600 万 PHP 开发者、Laravel 64%、PHP 8.x 89%/7.x 33%
11. aiforanything.io / laraspeed.dev — Laravel Boost MCP 与 Claude Code 工作流
12. sunqi.org / bunzee.ai / arinco.com.au / license-token.com — 开源可持续模式

---

**给架构师的关键输入**：CLI 与 GUI 共享同一守护进程/核心；CLI 必须 `--json` 全量化；服务仅监听 127.0.0.1；下载物 SHA256 校验；双端命令面对齐；性能红线 CLI 冷启动 <300ms。
**给设计师的关键输入**：图标文字化 / 禁紫色粉色渐变 / 真实文案 / 左侧导航 + 命令面板。

---

## v1.0 变更说明（2026-10-26，相对 v0.9）

1. **原第十二节开放问题 1-3 全部闭环**：PHP 分发 = 自托管预编译 + SHA256 钉死（macOS CI 用 static-php-cli 构建，Windows 官方 NTS zip + php-cgi 独占端口；否决 brew/scoop——Homebrew 同时只能 link 一个 PHP，无法实现多版本并存 + 每站点钉版本）；Windows DNS = hosts 自动化 + SYSTEM helper（否决 53 端口代理：仍需提权且代理挂掉 = 全机断网）；GUI = Electron 维持。
2. **非功能修订**：内存红线落地为硬规则——MVP 默认只装 4 个主力版本（8.1/8.2/8.3/8.4），7.4/8.0/8.5 按需安装；FPM 强制 pm=ondemand；GUI 首屏 <2s（热启动）/ 冷启动 <3s（含拉起 daemon，必须有明确加载态）；README 公布各版本扩展清单（静态构建不可 pecl）。
3. **验收标准修订**：双端对等条款改为「命令面对齐（同名同参同输出结构），DNS 机制平台差异对用户透明」；I1 出口条件增加双端实测 CLI 冷启动基准 <250ms。
4. **增量计划修订**：I1 增加 monorepo 骨架（含 Electron 空壳）；I2 安装器 electron-builder NSIS（先无签名）；`corral doctor` 明确探测本机已有 MySQL/PostgreSQL/Redis（端口 + 版本握手）并输出 .env 建议值。
5. **错误码目录（CLI --json 规范）**：初批 8 个——PORT_CONFLICT / PERMISSION_DENIED / SITE_EXISTS / VERSION_NOT_INSTALLED / DAEMON_NOT_RUNNING / CONFIG_INVALID / NETWORK_ERROR / CHECKSUM_MISMATCH。
6. **待用户追认 2 项**（总监裁定倾向，见 consistency-check.md §7）：PHP 分发诠释（按需下载 vs 全内置）；Windows 签名预算（Azure Trusted Signing 约 $9.99/月）。

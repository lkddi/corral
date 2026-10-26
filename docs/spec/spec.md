# Corral Spec v0.9（规格契约 · 草案）

> 状态：**v0.9-draft**——待用户对三文档（PRD v1.0 / 架构调研 + ADR-001~007 / 设计契约 v1.5）的 4 项拍板后升 v1.0
> 撰写：大湾区靓仔（总监）| 2026-10-26 | 命名：Corral（工作名，待用户终确认；命令名 `corral` 与显示名解耦，改名只动展示层）
> 权威来源：docs/phase1/prd.md（v1.0）· docs/phase1/architecture-research.md + docs/decisions/ADR-001~007 · docs/phase1/consistency-check.md（R1-R12）· docs/design/（v1.4+）· docs/spikes/2026-10-26-node-pty.md
> 机器可读伴侣：docs/spec/openapi.yaml（v0.9-draft，架构师在途）· docs/design/design-system/design-tokens.json

---

## 1. 产品定义

开源免费（MIT）、macOS + Windows 双端原生、agent 友好的 PHP 本地开发环境管家。原生二进制（nginx + PHP-FPM/php-cgi + dnsmasq），零 Docker/Podman 依赖；Herd 付费墙后的日常功能免费给；CLI `--json` 一等公民，env 级可编程；无账号、无遥测（默认关闭、opt-in）。

- **目标用户**：Laravel/PHP 开发者（主：freelancer 多项目多版本 / AI-first 全栈 / 小团队 Tech Lead）
- **差异化三轴**：① 核心体验完整免费（不打付费墙）② 双端原生一等公民 ③ CLI/GUI 对等 + `--json` 机器可读（MCP 为 v1.5 薄封装）
- **产品姿态**：daemon 是唯一配置源与状态源；GUI 是 daemon 的取景器（关窗不停服）；CLI/GUI 命令同源注册表（shared/commands.ts，RPC 与 CLI 1:1）

## 2. MVP 范围（P0 8 项 / 6 个双周增量 / 12 周 v1.0）

| # | P0 功能 | 增量 |
|---|---|---|
| 1 | 本地 DNS + nginx 自动 vhost（.test 自动解析） | I1 |
| 2 | 安装器 + doctor 自检 + 自动更新 | I2 / I5 |
| 3 | PHP 多版本管理（7.4–8.5）+ 每站点钉版本 | I1 |
| 4 | Parked 目录自动建站（监听 + 自动上线） | I3 |
| 5 | CLI 全功能 + `--json` 机器可读输出 | I1 / I5 |
| 6 | 站点生命周期（link/unlink/start/stop/restart/status） | I1 |
| 7 | 一键 HTTPS（本地 CA + 系统信任） | I3 |
| 8 | 最小桌面 GUI（站点列表/状态/PHP 切换/日志入口） | I4 |

| 增量 | 周期 | 内容 | 可演示结果 |
|---|---|---|---|
| I1 | W1–2 | monorepo 骨架（含 Electron 空壳）；CLI 骨架；PHP 下载管理（SHA256）；link/unlink；nginx vhost；macOS DNS | macOS `corral link` 后 http://app.test 可访问 |
| I2 | W3–4 | Windows 对等实现（hosts + helper + nginx + php-cgi）；安装器 .dmg/.exe；doctor | Windows 同命令可用；新人装完即过自检 |
| I3 | W5–6 | 一键 HTTPS（mkcert 通配符 + 系统信任）；parked 目录监听 | `corral park ~/code` 后新目录 60 秒内自动上线 https |
| I4 | W7–8 | 最小桌面 GUI（Sites/PHP/Logs 三视图 + ⌘K + Console dock） | 不敲命令完成 80% 日常操作 |
| I5 | W9–10 | CLI `--json` 全量化；.corral.yaml 配置即代码；`corral new`；自动更新 | 脚本/agent 可驱动全部核心操作 |
| I6 | W11–12 | 边界状态打磨；opt-in 埋点；双语 README；发布 v1.0 | 公开发布 |

## 3. 不做清单（MVP 明确不做）

| 不做 | 原因 | 重新评估 |
|---|---|---|
| 数据库服务（MySQL/PG/Redis） | 单人最大工作量项（约 5 人月）；doctor 探测本机已有 DB 并输出 .env 建议值兜底 | v1.2 |
| 邮件捕获 | 同上；引导 Mailpit 独立工具 | v1.3 |
| dump 窗口 / profiler / Tinker | 深度调试栈重投入 | v2.0 |
| MCP server | CLI --json 已可驱动；薄封装 | v1.5 |
| Linux 支持 | 硬约束双端；Linux 有 Lerd 占位 | 社区贡献者出现后 |
| 多语言界面 | 开发者工具通用语英文 | v1.2 |
| 容器/VM 模式 | 与「原生无依赖」定位冲突 | 不做 |
| 遥测默认开启 | 开源社区信任生命线 | 永不默认开启 |
| `corral link [name]` 可选站点名 | 命令面冻结最小化 | v1.1 ADR-lite（R12-3） |

## 4. 技术架构

### 4.1 技术栈（版本全部 npm registry 实测锚定，2026-10-26）

| 层 | 选型 | 版本 / 口径 |
|---|---|---|
| 桌面壳 | Electron（electron-vite + electron-builder） | **45.0.0**（45.x），bundled Chromium 156.0.8078.48 |
| 运行时 | 随包独立 Node（全系统唯一小版本） | **24.22.0**（与 Electron 45 捆绑 Node 逐位对齐；npm 24.x 已有 24.22.1，升级走 ADR-lite 不自动跟随） |
| CLI | 随包 Node + esbuild 零依赖 JS | 零运行时依赖、不引 commander/yargs、懒连接、即用即退；**禁 ELECTRON_RUN_AS_NODE 路径**（冷启动不达标） |
| GUI | React + TypeScript | React **19.3.1** |
| 样式 | Tailwind CSS v4（CSS-first `@theme`） | **4.3.3**；Token 单一来源 = design-tokens.css |
| 图标 | lucide-react | **1.61.0 exact pin**（leaf 依赖；github 已移除→star；more-horizontal→ellipsis 等新规范名） |
| 终端 | xterm.js（renderer）+ node-pty（**宿主 daemon**） | node-pty **1.1.0**（npm 最新 stable，^1.1.0 解析），Node 24 ABI 137，**spike 一手实证**（2026-10-26，Node 24.22.0 / darwin-arm64）：四平台 prebuild 齐全（darwin-arm64/x64、win32-arm64/x64）、冒烟 A/B 过（chmod 修正后可执行位）、冷启 median 20ms / p95 90ms；见 docs/spikes/2026-10-26-node-pty.md |
| 流通道 | ws（daemon 依赖，纯 JS） | pty 字节流 + Logs tail 共用 |
| TLS | mkcert 随包 | 通配符 `*.test` 单证书（MVP），per-site v1.0 |
| 服务编排 | 自写（不用 Windows Services 跑 nginx/php-cgi） | NSSM 仅用于注册 Windows helper |

### 4.2 进程拓扑（ADR-001/002/010 连锁）

```
用户 shell ──► corral CLI（随包 Node + esbuild 产物，即用即退）
                       │
Electron main ─────────┤
（GUI 壳，frame:false） │
                       ▼
              ┌────────────────────────┐
              │ daemon（单实例）         │
              │  分层服务：              │
              │  supervisor / sites /   │
              │  php / nginx / dns /    │
              │  tls / privileged       │
              └───────┬────────────────┘
                      │ RPC 控制通道（TCP 127.0.0.1 + token）
                      │ WS 流通道（127.0.0.1 + token，另端口）——pty + Logs tail
                      ▼
        nginx master(root, workers 降权) · PHP-FPM(用户态 127.0.0.1:900x)
        · macOS: launchd + /etc/resolver/test + dnsmasq
        · Windows: SYSTEM helper（NSSM 注册，白名单：写 hosts + 装证书）
```

- **单实例**：锁文件 + 端口探测；CLI 与 GUI 均为 daemon 客户端，彼此不直连（ADR-002）
- **关窗不停服**：daemon 登录自启（自装登录项，不依赖壳插件）
- **命令同源**：shared/commands.ts 注册表，每个 RPC 与一条 CLI 命令 1:1（参数 schema + 命令字符串模板）；GUI 命令 chip 一律从注册表模板渲染，组件内禁手写

### 4.3 平台差异（对用户透明的部分必须写明，ADR-003）

| 能力 | macOS | Windows |
|---|---|---|
| DNS | /etc/resolver/test + dnsmasq（**通配符**） | hosts 精确条目 + SYSTEM helper（**无通配符**，已知不对称） |
| PHP 进程模型 | PHP-FPM（pm=ondemand 强制） | **无 php-fpm**：php-cgi.exe 进程池自写（每版本独占 FastCGI 端口） |
| TLS 信任 | security add-trusted-cert（System keychain） | helper 写 LocalMachine\Root（需管理员） |
| 提权 | 首次 CA 信任 + launchd 特权端口 | helper 安装 + CA 信任（一次性，不可避免） |
| 更新 | Squirrel.Mac（**拒绝未签名/未公证**）→ Developer ID + notarytool + stapler | Authenticode / Azure Trusted Signing（**待用户拍板**） |

### 4.4 PHP 分发（ADR-004，诠释**待用户拍板**：按需下载 vs 全内置）

- app 内 catalog（版本 + SHA256 + URL）+ 解压到应用数据目录；macOS static-php-cli 静态构建 / Windows 官方 NTS zip
- MVP 默认装 4 个主力版本（8.1/8.2/8.3/8.4），7.4/8.0/8.5 按需（内存红线 <200MB 的依据）
- **静态构建扩展集固定、不可 pecl**（README 公布扩展清单）——不可行警告级约束
- PHP/nginx 二进制更新与 app 更新解耦（独立 catalog 通道）

### 4.5 打包与签名

- electron-builder：macOS .dmg + Windows NSIS；包体 150–200MB（含随包 Node + nginx + mkcert + node-pty 原生模块）
- macOS：Apple Developer $99/年 + notarytool； entitlements（allow-jit 等；helper 与主进程分离）
- Windows：Azure Trusted Signing 约 $9.99/月（约 $120/年）——**待用户拍板**；不批的降级路径：NSIS 无签名 + SmartScreen 恐吓 + 无差分更新（对冷启动伤害大，PRD/Spec 风险节明文）
- 私钥/证书为 CI secret，丢失即断更；GitHub Actions macOS runner 10 倍分钟计费

### 4.6 数据层（ADR-007）

JSON 原子写 + schema 版本号 + repository 接口抽象；**MVP 无数据库**（better-sqlite3 需按 ABI 重编、node:sqlite 带实验标记）；数据量/并发成瓶颈时切 SQLite，业务层零改动。实体：sites / settings / parked-dirs / php-versions / catalog-cache（结构见 §6）。

## 5. API 清单

### 5.1 CLI 命令面（15 组，权威 = consistency-check §3；机器可读版 = docs/spec/openapi.yaml，v0.9-draft 在途）

| 命令 | 功能 |
|---|---|
| `corral park <dir>` / `corral unpark <dir>` | 挂载/卸载 parked 目录 |
| `corral link [--php <v>] [--port <n>]` / `corral unlink` | 当前目录上线/下线（站点名 = 目录名） |
| `corral secure` / `corral unsecure` | HTTPS 开关 |
| `corral isolate <v>` / `corral unisolate` | 站点钉 PHP 版本（v 接受 `php@<v>` 归一化，R12） |
| `corral use <v>` | 切换全局 PHP（接受 `php@<v>`；**无参 = USAGE_ERROR**，hint 指向 `corral status`，R12） |
| `corral php:list` | 版本列表（已装/可用） |
| `corral php:install <v>` / `corral php:uninstall <v>` | PHP 版本安装/卸载（catalog 下载 + SHA256） |
| `corral start [site]` / `corral stop [site]` | 带站点 = 启用/停用站点（停用 = 摘除 vhost + 停止页，持久化）；无参 = 启停整个本地栈 |
| `corral restart [site]` / `corral status` / `corral logs` | 重启（daemon 侧原子）/ 状态（五态）/ 日志 |
| `corral open <site>` | 浏览器打开站点 URL（site 必填，无参 = 用法错误；CLI 不开 GUI 窗口） |
| `corral edit [site]` | 文件管理器揭示站点生成配置目录（无参 = 主配置文件进编辑器） |
| `corral new <framework> <name> [--php <v>]` | 项目脚手架（可选初始 PHP 版本，R12 版本入口之一） |
| `corral doctor` / `corral uninstall` | 自检 / 卸载（含 CA 移除、DNS 还原） |
| `corral`（裸命令） | 帮助与命令列表 |
| 全部命令支持 `--json` | 机器可读输出 |

**语法终裁**：① 冒号式子命令（`corral php:list`，对齐品类习惯）；② 站点钉版本 = `corral isolate <v>`，全局切换 = `corral use <v>`；③ `php@<v>` 别名统一扩展到所有版本参数入口（use/isolate/php:install/php:uninstall/link --php/new --php），shared/commands.ts 单一归一化，GUI 渲染一律裸版本形（R12）；④ 无参语义三类：整栈动作（start/stop）/ 帮助（裸 corral）/ 用法错误（open、use）。

**--json 协议规则**：OS 级副作用命令（open 的浏览器启动 / edit 的文件管理器揭示）在 `--json` 下只返回目标数据（站点 URL / 配置目录路径）、不执行副作用；完整动作仅在交互模式执行。shell 探测链：pwsh → powershell.exe → cmd.exe（可配置）。

**站点五态（CLI/GUI 同词表）**：`running` / `stopped` / `starting` / `error` / `missing`——missing = parked 目录被删（标记失效而非静默消失）；daemon 必须枚举五态。

### 5.2 错误契约（10 码，权威 = consistency-check §6）

统一信封：`{status, data, error:{code, message, hint, retryable?}}`，retryable 由 daemon 判定。

| 错误码 | 触发 | retryable |
|---|---|---|
| PORT_CONFLICT | 80/443 占用 | true |
| PERMISSION_DENIED | CA 信任 / 提权被拒 | true |
| NETWORK_ERROR | 下载/网络失败 | true |
| CHECKSUM_MISMATCH | SHA256 校验失败 | false |
| DAEMON_NOT_RUNNING | daemon 未运行 | true |
| SITE_EXISTS | link 同名（后者覆盖并提示） | — |
| VERSION_NOT_INSTALLED | 指定版本未安装 | false |
| CONFIG_INVALID | 配置解析失败 | false |
| USAGE_ERROR | 未知命令/缺参/--json 副作用拒绝 | false |
| SITE_NOT_FOUND | open/isolate 指向不存在站点 | false |

### 5.3 GUI↔CLI 对等

每个 GUI 操作暴露等价 CLI 命令 chip（CommandChip，注册表模板渲染）；五态、错误码、命令字符串 CLI/GUI 同源；禁「仅 GUI 可见」状态、禁 GUI 独有状态概念。

## 6. 数据层清单（JSON 存储实体）

| 实体 | 关键字段 | 说明 |
|---|---|---|
| sites | name, path, php, port, secure, enabled, status(五态) | 原子写；同名 link 后者覆盖 + toast |
| settings | globalPhp, theme, shellChain(pwsh→powershell→cmd) | 主配置文件（人类可读可审计） |
| parked-dirs | path[] | GUI 只读可见性行；写入仅 CLI + 配置文件 |
| php-versions | version, path, installedAt, extensions[] | 目录按版本隔离，php.ini 每版本独立 |
| catalog-cache | version, sha256, url, fetchedAt | 与 app 更新解耦 |

repository 接口抽象（list/get/put/delete per entity），schema 版本号字段；并发以后写入者为准并提示。

## 7. 页面清单（设计契约 = docs/design/，实现时先读 MASTER.md 再查 pages/ 覆盖项）

| 页面/表面 | 文件 | 要点 |
|---|---|---|
| Sites 视图 | pages/sites.md | SiteRow 五态双编码、虚拟化 100+、 watched-dirs 行、空状态教真实命令 |
| PHP 视图 | pages/php.md | 分段控件全局切换、Install/Uninstall（php:install/uninstall chip）、下载确定性进度 |
| Logs 视图 | pages/logs.md | WS 流通道实时 tail（无文件轮询） |
| 命令面板 ⌘K | pages/command-palette.md | Quick actions（start/stop 无参形）、行级 Restart chip、错误面板/toast 回执 |
| Console dock | pages/console.md | 底部 dock 默认开 40%、⌃` 折叠、xterm.js + node-pty、Open in system terminal、无 chip |
| 原生菜单 + 托盘 | DESIGN.md §4.14/§4.15 | 主题 radio / Start at Login / Edit configuration / Star / About / Quit；托盘 template 图标 + Open/Quit（R3） |
| 错误面板 E1/E2/E3 + Toast + 骨架屏 + 空状态 | DESIGN.md §4.9–4.13 + component-states.md | 全状态矩阵（Loading/Empty/Error/Populated/Edge） |

## 8. 设计 Token

机器可读 = docs/design/design-system/design-tokens.json（Phase 3 门禁物：前端 import，禁硬编码 hex，唯一例外 #fff/#000 美术资源内部）。核心纪律：

- **Teal 主色**：浅 #0F766E / 深 #2DD4BF；accent 只做两角色（当前选中 + 主操作），永不装饰
- **语义色**（success/warn/danger/info）只做 6px 状态点/图标/边框，禁作文字（对比度不达标）
- **终端绿 #22C55E 范围化**：仅限 `--code-bg` 深色代码面（命令 chip/日志/⌘K 右侧）；代码面两主题皆深
- **等宽强制**：域名/版本/端口/路径/命令/日志行；tabular-nums
- **P0 绝对规则**：禁 emoji 图标（全 Lucide 1.61.0）/ 禁紫粉渐变 / 禁空洞占位文案 / 禁 AI 模板语法；app icon 与托盘 template image 属品牌资产豁免
- **动效**：120/180/240ms 三档 + reduced-motion 全局降级；禁无限转圈（Starting 秒表 10s 超时转 Error）

## 9. 验收标准

### 9.1 核心循环（Given/When/Then，PRD §7）

- `corral link --php 8.3` → 3 秒内 https://<目录名>.test 返回该项目 PHP 8.3 响应
- `corral park ~/code` 后新建目录 → 60 秒内自动上线 https
- `corral isolate 8.1` → 该项目后续请求走 8.1，其他站点不受影响
- `corral secure` → 系统信任库新增本地 CA，浏览器无证书警告
- 任意命令 `--json` → 合法 JSON（status/data/error），jq 与 agent 可解析
- 无网络 → 已缓存版本站点全功能正常；下载新版本失败有明确归因与重试入口
- GUI 首屏 <2s（热启动）/ <3s（冷启动含拉起 daemon，必须有骨架+渐进加载态）

### 9.2 性能红线（P0）

| 指标 | 目标 | 验证口径 |
|---|---|---|
| CLI 冷启动 | <300ms；**I1 出口：双端实测 <250ms** | I1 双端基准测试（node-pty spike 同法：10 次中位数/p95） |
| link 到可访问 | <3s（PHP 已缓存） | e2e 计时 |
| daemon 空闲内存 | <200MB | 4 默认版本 + pm=ondemand 前提下实测 |
| Console spawn + 首字节 | <100ms | spike 实测（10 次）：median 20ms / p95 90ms / min 15ms（含 require + spawn） |

### 9.3 双端对等

Windows 11 + PowerShell 与 macOS 12+（Intel + Apple Silicon）执行相同命令序列 → 命令名/参数/输出结构一致；DNS 机制平台差异对用户透明；全流程无需手动编辑 hosts 或装 Homebrew。

### 9.4 Console dock（spike 已证 + 验收补强）

xterm.js 渲染 + node-pty 宿主 daemon：spawn（选中站点目录或 home）/ 输入回显 / resize / kill 退出 / 断链 daemon 重连后新 shell；Logs tail 同通道实时（<1s 延迟）；shell 探测链 pwsh→powershell→cmd。

## 10. 边界约束

- **空/错/加载三态**：空状态教真实可复制命令；80/443 占用报进程名+PID+释放指引；CA 拒绝给手动信任步骤；下载失败区分网络 vs 校验；PHP 下载确定性进度（%+速度+ETA+Cancel）；站点启动 Starting 秒表（10s 超时转 Error + View logs/Retry）
- **边界值**：站点名连字符/下划线/点；同名 link 覆盖提示；parked 目录删除 → missing 态；符号链接目录；100+ 站点虚拟化
- **并发**：CLI 与 GUI 同站点操作以后写入者为准并提示；并行 link 不互阻
- **权限拒绝**：一次性提权被拒 → 降级说明（手动信任指南），禁静默失败
- **卸载**：`corral uninstall` 完整路径（CA 移除 + DNS 还原 + 配置清理）
- **安全红线**：服务仅监听 127.0.0.1；下载物 SHA256 校验；CA 私钥不出本机；安装包签名（macOS 公证 + Windows Authenticode，后者待拍板）；禁 shell:true（参数数组化）
- **不可行警告（4 条，架构师报告 §9）**：① Windows 无 php-fpm（php-cgi 进程池自写）② 静态 PHP 扩展集固定不可 pecl ③ Windows 无通配符 DNS ④ 一次性提权不可避免
- **成本硬约束**：Apple $99/年 + Windows 签名（待拍板）+ GH Actions macOS 10 倍分钟

## 11. 已知坑（pitfalls）

1. **node-pty 安装与分发**（spike 一手实证，2026-10-26）：node-pty 1.1.0 **四平台全 prebuild**（darwin-arm64/x64、win32-arm64/x64，win32-x64 含 pty.node + conpty/winpty 全家）——**无需源码编译、无 VS 工具链门槛**；daemon 分发按平台各带 prebuilds/ 下对应产物，禁 electron-rebuild（daemon 不跑 Electron 里）。**真坑：npm 解包丢失 `prebuilds/<platform>/spawn-helper` 可执行位（-rw-r--r--）→ 裸装后首次 spawn 报 `posix_spawnp failed`；安装/postinstall 必须 chmod +x，或 CI 加可执行位校验**（复现：`npm i node-pty@1.1.0` 后直接 spawn 即败，chmod +x spawn-helper 后 A/B 冒烟全过）
2. **node-pty ABI 绑定 Node major**：prebuild 按 Node ABI 构建——minor 升级（24.22.0→24.x，ABI 137 不变）prebuild 复用；major 升级（Node 24→26）prebuild 失效，需重编或等上游发布，升级走 ADR-lite。Electron 主版本升级若连带 bundled Node major 变化同理（ADR-001 版本连带的原生模块侧）
3. **launchd 只保进程存在不保健康**：必须叠加健康检查；Windows php-cgi 无内置进程管理器，看护逻辑自写
4. **hosts 被安全软件锁定/还原**：重试 + 检测；与已装 Valet/Herd 冲突时安装期检测、明确报错禁静默
5. **浏览器 HSTS 缓存**：换证书后仍可能报警告（文档化）；Firefox 走独立 NSS（文档化手动步骤）
6. **Windows Defender 实时扫描**拖慢配置目录（引导加排除项）；Windows 路径分隔符/盘符在 nginx conf 模板的处理
7. **Electron 体积观感受到社区对比**（150–200MB vs Herd 原生）：以常驻托盘 + 按需建窗 + 核心轻量控制；README 明示构成
8. **Squirrel.Mac 拒绝未签名/未公证更新**：签名链路断 = 断更；私钥为 CI secret
9. **设计侧 8 条**（DESIGN.md §9.5）：硬编码 hex /  backgroundColor 不同步冷开白闪 / 命令字符串手写过期 / success 当文字色 / 脉冲忘 reduced-motion / 长域名不截断 / 无限进度动画 / 深色 hover 变暗
10. **CLI 即用即退的边界**：懒连接 + 零依赖编译产物；任何 require 链路膨胀直接吃 <250ms 预算（spike：require node-pty 占 17–24ms，余量约 93%，但 CLI 不得 require node-pty/ws）

## 12. 端到端验证（Phase 4 入口）

1. **Fresh install → link**：干净机安装 → `corral link` → 3s 内 https 可访问（双端）
2. **Park → 自动上线**：`corral park ~/code` → 新建目录 → 60s 内自动 https
3. **版本闭环**：php:install 8.3 → isolate → use → php:uninstall → 状态一致
4. **HTTPS 闭环**：secure → 浏览器零警告 → unsecure → 回退
5. **Agent 闭环**：`corral link --json` → `corral status --json` → `corral logs --json`（jq 可解析；--json 下 open 只返数据不副作用）
6. **GUI 闭环**：⌘K 全操作 + 三视图 + Console dock spawn/kill/重连 + 关窗不停服 + 托盘重开
7. **故障注入**：端口占用 / 断网下载 / CA 拒绝 / parked 目录删除（missing）/ daemon  kill 自恢复
8. **卸载闭环**：corral uninstall → CA 移除 + hosts/resolver 还原 + 无残留进程
9. **CI 门禁**：P0 emoji 扫描 0 命中 / tokens.json 合法 / 命令表与 consistency-check §3 对齐（无 --all、无 stop&&start）/ openapi.yaml YAML 可解析 / lucide 精确钉 1.61.0

## 13. 变更记录

| 版本 | 日期 | 变更 | 来源 |
|---|---|---|---|
| v0.9-draft | 2026-10-26 | Spec 首稿（13 节），三文档 + R1-R12 + node-pty spike 实证并入；4 项待用户拍板以 TBD 标注 | 总监组装 |
| — | 待 | 用户拍板后：命名锁定 / PHP 分发诠释 / Windows 签名预算 → v1.0；架构师技术附件 5 章 + openapi.yaml 终稿纳入 | — |

**待用户拍板（4 项，consistency-check §7）**：① 三文档确认 ② 产品命名（Corral/Stable/Pen/Fold）③ PHP 分发诠释（按需下载 vs 全内置）④ Windows 签名预算（Azure Trusted Signing $9.99/月）

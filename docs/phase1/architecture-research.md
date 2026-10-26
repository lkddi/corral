# Phase 1 架构调研报告：本地开发环境管家（macOS + Windows 双端）

调研人：首席架构师 高见远。所有版本号均来自官方站点/官方仓库。版本号复核记录见文末「总监复核注」。

---

## 一、选型结论（锁定）

**Electron（壳）+ TypeScript 全栈核心（Node）+ React 19 渲染层**，核心引擎与 Electron 零依赖、以独立 daemon 进程常驻；CLI 与 GUI 共享同一套 TypeScript 核心代码。

一句话理由：本产品 90% 的工作量是进程编排（nginx / PHP-FPM / php-cgi / dnsmasq 的 spawn、看护、重启）、配置文件生成、特权操作（DNS、证书、端口），这些恰好是 Node.js child_process / fs / net 的主场。对「TS/JS 底子 + 一人开发」这是唯一能做到「一种语言写完全部三层（GUI / daemon / CLI）」的方案，MVP 交付速度优势是数量级；打包体积与内存的代价用架构手段控制（见 ADR-001/002）。

---

## 二、技术选型对比矩阵

评分 1-5，5 为最优。权重：学习成本/团队熟悉度/部署成本 = 高，扩展性 = 低（MVP 不需要未来三年的扩展性）。

| 维度 | A. Electron + Node 核心 | B. Tauri v2 + Rust 核心 | C. Go + Wails 壳 | D. 原生 Swift + C#/.NET |
|---|---|---|---|---|
| 对 TS/JS 一人开发者的交付速度 | 5（零新语言，CLI/GUI/daemon 同代码库） | 2（核心逻辑需 Rust 重写） | 3 | 1（两套代码库两门语言） |
| 常驻后台服务资源开销 | 2（空闲约 150-300MB） | 5（约 30-50MB） | 4（约 70MB） | 5 |
| 双平台一致性 | 5（Chromium 统一渲染，Node API 一致） | 4（WebView2/WKWebView 差异） | 4 | 2 |
| 打包体积 | 2（安装包 80-150MB） | 5（2-10MB） | 4（约 12-15MB） | 5 |
| 自动更新成熟度 | 5（electron-updater + Squirrel） | 4 | 3（v3 alpha） | 3 |
| 代码签名与公证 | 5（notarytool + electron-builder 最成熟） | 4 | 3 | 5（但双端各做一遍） |
| 生态成熟度 | 5（npm 全生态） | 4 | 3 | 3 |
| CLI 分发便利性 | 5（CLI 就是 Node 脚本） | 3 | 5 | 4 |
| **加权结论** | **MVP 首选** | 备选 | 不选（v3 未 GA） | 不选（交付速度否决） |

**关于 Herd 本身的栈**：社区文章称 Herd 桌面端为 Tauri 应用，站点驱动逻辑源于 Valet 分支（PHP），PHP 为内置静态二进制。竞品团队（Beyond Code，专业团队）选了 Tauri + Rust。我们不复制该选择，原因只有一个——开发者底子不同。此差异必须在 PRD 风险节写明。

---

## 三、核心功能逐项可行性验证

### 1. 进程守护与崩溃重启 — 可行，双端机制不同
- macOS：launchd LaunchDaemon（plist：RunAtLoad + KeepAlive + ThrottleInterval 防重启雪崩；launchd 不创建日志目录，目录必须先建）。新语法 launchctl bootstrap/bootout/kickstart 必须指明 domain。端口 80/443/53 为特权端口，nginx 与 dnsmasq 的 master 必须以 root 运行（workers 降权）；PHP-FPM 不需要特权，跑用户态（听 127.0.0.1:900x）。
- Windows：不用 Windows Services 跑 nginx/php-cgi（Laragon 已验证「自写服务编排」路线：便携、无注册表污染）。由 app daemon（用户态、登录自启）spawn 并看护全部进程，重启策略自实现（指数退避）。唯一需要的系统服务是特权 helper。若确需服务化，NSSM 随包分发。
- 风险：launchd 只保「进程存在」不保「进程健康」，必须叠加健康检查；Windows 下 php-cgi 无内置进程管理器，进程池逻辑自写。

### 2. 本地 DNS 劫持 — 可行，但双端能力不对称（必须写进 PRD）
- macOS（真通配符）：dnsmasq 监听 127.0.0.1:53 + 写 /etc/resolver/test，*.test 全通配。两者都需要 root。
- Windows（仅精确匹配）：无 /etc/resolver 等价机制。Herd 的方案是 HerdHelper（SYSTEM 服务）改写 hosts，每个站点一行 127.0.0.1 xxx.test；Laragon 同样写 hosts。Windows 端无法通配符。
- helper 注册设计：electron-builder 的 NSIS 安装器本身以管理员运行，安装时用随包 NSSM 注册 helper；helper 用 Electron 二进制以 ELECTRON_RUN_AS_NODE=1 运行 helper.js。helper 只做两件事：写 hosts、装证书到 LocalMachine\Root——命令白名单制。
- 风险：hosts 被安全软件锁定/还原；与已装的 Valet/Herd 冲突（安装时检测，明确报错而非静默失败）。

### 3. 自签 TLS 证书并写入系统信任库 — 可行，mkcert 是成熟答案
- 随包分发 mkcert 预编译二进制（MIT）。首次运行 mkcert -install：macOS 走 security add-trusted-cert 写入 System keychain 并设「始终信任」；Windows 经 CryptoAPI 写入 LocalMachine\Root（需管理员）。
- MVP 简化决策：签发一张通配符证书（mkcert 支持通配符 SAN，如 "*.test"），nginx 443 default_server 统一使用。per-site 证书留作 v1.0 演进。
- 风险：Windows 装 CA 需管理员；Firefox 走独立 NSS 库（文档化即可）；浏览器 HSTS 缓存可能导致换证书后仍报警告（写进已知坑）。

### 4. 多版本 PHP 运行时管理 + 每站点隔离 — 可行，Herd 已量产验证
- 分发（按需下载 + SHA256 校验 + 解压到应用数据目录，不做进安装包）：
  - macOS：static-php-cli 静态构建，官方预编译包（common 30+ 扩展约 7.5MB / bulk 50+ 约 25MB）。
  - Windows：官方预编译 NTS zip + php-cgi。**Windows 没有 php-fpm**（官方明确 fpm SAPI 不支持 Windows），FastCGI 模型为 php-cgi.exe -b 127.0.0.1:90xx，每版本一个独立端口，nginx 按站点 fastcgi_pass 到对应端口。
- 每站点隔离（herd isolate 等价）：每站点生成专用 nginx server 块，fastcgi_pass 指向该版本独占端口；全局默认版本用下拉/CLI 切换。CLI 侧版本跟随：MVP 采用前缀式（`corral php artisan ...` 解析当前目录所属站点的 pinned 版本），目录内裸 php -v 报全局版本——与 Herd 完全一致的裸命令跟随需要 shell shim 技巧，列为 v1.0。
- 版本矩阵：7.4 / 8.0 / 8.1 / 8.2 / 8.3 / 8.4 / 8.5；目录结构按版本隔离，php.ini 每版本独立。
- 风险（不可行警告级）：静态 PHP 构建的扩展集是固定的，**不能 pecl 装新扩展**——Herd 有同样限制。若 PRD 暗示「任意扩展可用」，此条不可行。

### 5. nginx 站点配置生成与热加载 — 可行，低风险
- 仓库内置 Laravel/Symfony/WordPress 驱动模板，parked 目录扫描生成 per-site conf，nginx.conf include 该目录；改后用 nginx -t 校验再 nginx -s reload（HUP）；保留 last-known-good 备份，reload 失败即回滚。
- 用户可编辑 per-site conf，文件中标注「可能被重新生成」。
- 风险：Windows 路径分隔符/盘符在 conf 模板中的处理；Windows Defender 实时扫描拖慢配置目录（引导加排除项）。

### 6. CLI 与 shell 集成 — 可行，Node 核心的最大红利
- CLI 就是 TypeScript（与 core 同库同构建），shim 安装：macOS 写 /usr/local/bin（一次 sudo，合并进首次授权流程）+ 可选写 ~/.zshrc；Windows 装进用户 PATH 目录。
- CLI 经 127.0.0.1 socket + token 文件（权限 600）与 daemon 通信；daemon 未运行时给出明确指引。
- MVP 命令面（权威命令表以 Phase 1.5 Spec 锁定版为准，见 consistency-check.md）。
- 依赖方向约束：CLI command handler 只做参数解析 + 调 core IPC，不写业务逻辑。

### 7. 自动更新 — 可行，但签名是硬门槛且是硬成本
- electron-updater + GitHub Releases。macOS：Squirrel.Mac 拒绝安装未签名/未公证的更新——必须 Developer ID 证书 + notarytool + stapler；entitlements 需 allow-jit 等，helper 进程 entitlements 需与主进程分离。Windows：Authenticode 签名（或 Azure Trusted Signing 约 $9.99/月）；未签名安装器触发 SmartScreen 且破坏差分更新。支持 latest.yml stagingPercentage 渐进发布。
- PHP/nginx 二进制更新与 app 更新解耦：app 内 catalog（版本 + SHA256 + 下载 URL），独立通道。
- 风险：私钥/证书是 CI secret，丢失即断更；GitHub Actions macOS runner 按 10 倍分钟计费。

---

## 四、Herd / Lerd / Laragon 架构研究结论

| 产品 | 架构要点 | 借鉴 |
|---|---|---|
| Laravel Herd | macOS dnsmasq + resolver 真通配；Windows HerdHelper（SYSTEM）写 hosts；nginx 80/443 + PHP-FPM（mac）/ php-cgi（win）；内置静态 PHP 按需下载；isolate = per-site conf + 独占 FastCGI 端口；站点驱动源于 Valet 分支；herd.yml 项目级配置 | 产品边界划分；驱动模板化；按需下载 PHP |
| Lerd（开源 MIT） | rootless Podman + systemd/launchd；.test + mkcert；框架/服务「商店」独立于主版本更新；MCP server | 商店式框架/服务定义（YAML 化，独立仓库更新）；不借鉴其容器路线 |
| Laragon（Windows） | 完全便携文件夹，不用 Windows Services、自写服务编排；写 hosts + 自签证书 + 一键信任；vhost 由用户可编辑模板生成 | Windows 端「用户态编排 + 提权 helper」路线；模板文件可编辑；Procfile 概念（v1.0） |

---

## 五、锁定技术栈与版本锚定思路

- 壳：Electron（electron-vite + electron-builder）
- 核心 daemon：纯 Node + TypeScript（零 Electron import，可独立 node 进程运行）
- CLI：TypeScript，与 core 同库；经 127.0.0.1 socket 通信
- 渲染层：React 19 + TypeScript + Vite + Tailwind CSS v4；Radix 原语 + shadcn 式局部组件
- 状态：TanStack Query（daemon 数据）+ Zustand（UI 态）
- **图标库（P0 锁定，唯一）：Lucide — lucide-react，ISC 许可，outline 风格，tree-shakable。禁止混用第二套图标库、禁止 emoji 图标。**
- 存储：MVP 用 JSON 文件存储（原子写 + schema 版本号 + repository 抽象层），SQLite 为演进位
- 随包二进制：nginx（双端预编译）、mkcert（双端预编译）、dnsmasq（仅 macOS）；PHP 按需下载
- 分发：GitHub Releases + electron-updater；后续可加 Homebrew cask / Scoop（v1.0）

依赖声明（进入根 package.json）：
```
"dependencies": {
  "lucide-react": "^1.x"
}
```

版本锚定思路（规格即契约）：
1. pnpm-lock.yaml 入库，CI frozen-lockfile。
2. docs/versions.md 记录「已验证矩阵」，升级必须走 ADR-lite。
3. Phase 2 输出 openapi.yaml 固化 daemon 的 IPC 契约（127.0.0.1 HTTP API + CLI 命令面 + 错误码），前后端（GUI/CLI/daemon）以此为唯一依据。

---

## 六、分层架构与目录结构

```
┌──────────────────────────────────────────────────────────────┐
│ 表现层  Renderer (React + Tailwind + Lucide)                  │
│         CLI (Node 脚本, 与 core 同代码库)                      │
├──────────────────────────────────────────────────────────────┤
│ 应用壳   Electron Main (window/tray/自启/autoUpdater) — 薄壳   │
├──────────────────────────────────────────────────────────────┤
│ Daemon   Node 常驻单实例 (socket 服务 + 令牌鉴权)              │
│  ├─ services/supervisor   进程看护: spawn/看护/退避重启/日志     │
│  ├─ services/sites        站点注册表/ park 扫描/ link/ isolate  │
│  ├─ services/php          PHP 版本目录/ 按需下载/ 版本解析        │
│  ├─ services/nginx        配置生成/ -t 校验/ reload/ 健康检查     │
│  ├─ services/dns          mac: dnsmasq+resolver / win: hosts    │
│  ├─ services/tls          mkcert CA/ 签发/ 信任库                │
│  └─ services/privileged   mac: launchd daemon 安装 / win: helper │
├──────────────────────────────────────────────────────────────┤
│ 数据层   repositories (JSON 原子写, schema 版本化)              │
├──────────────────────────────────────────────────────────────┤
│ 基础设施 随包二进制(nginx/dnsmasq/mkcert) + 按需下载(PHP)        │
└──────────────────────────────────────────────────────────────┘
依赖只能向下；CLI/renderer 禁止直连数据层；入口只装配。
```

目录（pnpm monorepo，单文件 ≤300 行、按资源分包、入口只装配）：
```
packages/
├── core/                    # 零 Electron 依赖的引擎
│   └── src/{index.ts, daemon.ts, services/, repositories/, ipc/, utils/}
├── cli/src/{index.ts, commands/, client.ts}
├── app/src/{main.ts, tray.ts, windows.ts, ipc-bridge.ts, updater.ts}
├── renderer/src/{pages, components, services, stores, types}
└── shared/                  # 跨包类型 + 协议 schema
```

---

## 七、ADR 草稿

（已落盘为 docs/decisions/ADR-001.md ~ ADR-007.md）

---

## 八、技术约束清单（Phase 2 规格必须显式承接）

1. macOS 首次运行需一次性管理员授权（合并为单次流程：装 launchd daemon、写 /etc/resolver/test、装 mkcert CA）；Windows 在安装时经管理员安装 helper 服务。
2. 特权端口约束：macOS nginx(80/443) 与 dnsmasq(53) 必须 root master，workers 降权；PHP-FPM 用户态。Windows 无特权端口问题。
3. 端口冲突检测：80/443/53 被占用时明确报错并给出指引，禁止静默失败。
4. Windows 无通配符 .test DNS（hosts 精确条目）。
5. 静态 PHP 扩展集固定，不可 pecl 安装新扩展（PRD 限制声明）。
6. 单实例 daemon（锁文件 + 端口探测）；CLI 在 daemon 未运行时给明确指引。
7. 配置目录约定：macOS ~/Library/Application Support/<app>，Windows %LOCALAPPDATA%\<app>，二选一后钉死。
8. 生成的 per-site nginx conf / php.ini 必须保留用户编辑入口并标注「可能被重新生成」。
9. Windows Defender 实时扫描会拖慢配置目录——安装器或首次引导代加排除项。
10. launchd 日志目录必须先创建。
11. 自动更新必须签名 + 公证，否则更新静默失败（双端实证）。
12. 所有进程 spawn 必须记录 stdout/stderr 到文件并提供 logs 命令。

---

## 九、不可行警告（需写入 PRD/Spec 风险节）

1. **Windows 无 php-fpm**：只能用 php-cgi.exe 进程池；FPM 式池调优/慢日志在 Windows 端不存在。
2. **静态 PHP 扩展集固定**：不能 pecl 安装任意扩展（Herd 同样限制）。
3. **macOS 公证与 Windows 签名是硬成本**，「纯开源免费」项目仍需每年真实支出。
4. **免管理员不可能**：DNS、证书信任、特权端口三件事都绕不开一次性提权。
5. **通配符 .test 仅 macOS 可用**；Windows 是 hosts 精确解析。
6. **Electron 体积/内存会招致社区批评**（竞品为原生/Tauri）：以 ADR-002 换壳逃生阀 + 托盘常驻设计缓解。
7. **GitHub Actions macOS 分钟 10 倍计费**：免费额度内每月约支持 2 次完整双端发布。

---

## 十、一人开发工期与维护成本估算

基线：专家包成本模型——桌面工具类 MVP 4-6 周 / 2-3 人月。本项目系统集成度更高，上调：

| 阶段 | 周期（一人） | 人月 | 内容 |
|---|---|---|---|
| MVP | 6-8 周 | 1.5-2 | park/link + 双端 DNS + nginx 生成/热加载 + PHP 按需下载（先上 4 个主力版本）+ isolate + mkcert 一键 HTTPS + CLI 核心命令 + GUI 站点/PHP 两页 + 登录自启 + 首次授权流程 |
| v1.0 | +6-8 周（累计 3.5-4） | +2 | 服务管理（MySQL/Redis/Postgres）、日志查看、Xdebug 开关、Node 版本管理、签名+公证 CI 全通、文档站、per-site 证书、Homebrew/Scoop 分发 |
| 持续维护 | 2-4 天/月 | — | Electron 大版本约每季一次（每次 2-3 天）；PHP 小版本月更；OS 适配按需；nginx/OpenSSL CVE 响应 |

硬成本（年）：Apple Developer $99 + Windows 签名（Azure Trusted Signing 约 $120/年 或 OV 证书 $200-400）+ 域名约 $10 = **合计约 $230-500/年**。

---

## 十一、RoleVerdict 回传裁决

```
verdict: pass
blocking: []
advisory:
  - PRD 必须承载 4 条不可行警告（Windows 无 php-fpm / 静态 PHP 扩展集固定 /
    Windows 无通配符 DNS / 一次性提权不可避免）
  - 年约 $230-500 签名公证硬成本与 Electron 体积代价写入 PRD 风险节
  - 产品命名与 CLI 命令名尽快确定
  - MVP 的 PHP 版本先上 8.1/8.2/8.3/8.4 四个主力版本，7.4/8.0/8.5 第二批
  - Phase 2 规格按「规格即契约」编写，内嵌已知坑
```

---

## 补充决议（2026-10-26，架构师增补 + 总监采纳）

收到 PM 的 PRD 技术约束与设计师边界输入后的硬约束核验，Electron 锁定维持，净变更如下：

1. **CLI 运行时修正**：随包独立 Node 24 + esbuild 零依赖编译，不复用 Electron 二进制（RUN_AS_NODE 冷启动顶不到 300ms）。CLI/daemon/helper 共用同一运行时。I1 出口条件新增双端冷启动实测 <250ms。
2. **PHP-FPM 强制 pm=ondemand + MVP 默认只装 4 个主力版本（8.1/8.2/8.3/8.4）**：7 个 FPM master 常驻合计 150-160MB，叠加 nginx/dnsmasq/daemon 逼近 200MB 红线。
3. **新约束族 8 条**（Phase 2 规格必须承接）：
   - 统一命令信封 `{status, data, error:{code,message,hint}}`；人类输出 = 同一信封的格式化视图
   - 错误码目录初批 8 个：PORT_CONFLICT / PERMISSION_DENIED / SITE_EXISTS / VERSION_NOT_INSTALLED / DAEMON_NOT_RUNNING / CONFIG_INVALID / NETWORK_ERROR / CHECKSUM_MISMATCH
   - 全组件只听 127.0.0.1；daemon socket = TCP 127.0.0.1 随机高位端口 + token 文件（600）；LAN 共享后置为显式 opt-in
   - CLI/GUI 命令同源注册表（shared/commands.ts）——GUI 暴露等价 CLI 命令是差异化点
   - 双端命令面对齐：参数数组传递、禁 shell:true；Windows 路径/引号/盘符进 I2 测试矩阵
   - link→可访问 <3s：nginx 常驻 + ondemand FPM + 配置生成 <100ms + nginx -t 后 HUP
   - 数据库服务不在 MVP：`corral doctor` 探测复用本机已有 DB 并输出 .env 建议
   - monorepo 骨架（含 Electron 空壳）I1 即建；I2 安装器走 electron-builder NSIS（先无签名，Authenticode 后置）
4. **设计师边界输入核验**：托盘菜单/通知/弹层面板/开机启动在 Electron 下均有原生或标准模式支持，渲染层与壳解耦无返工——ADR-002 价值验证。
5. **包体数字更新**：150-200MB（原 80-150MB），逃生阀不变。
6. **Console dock 连锁增补（2026-10-26，R10）**：node-pty 宿主 daemon（非 Electron main，避免 electron-rebuild 违反单一运行时原则）+ CI 按平台构建随包 + daemon 新增 WS 流通道（pty 字节流与 Logs tail 共用，127.0.0.1 only + token，与 RPC 分端口）+ node-pty 双端编译 spike 列为早期验证项。详见 consistency-check.md R10。

---

## 总监复核注（2026-10-26，大湾区靓仔）

- **版本号复核（npm registry 实测）**：lucide-react **1.61.0**（报告的 "^1.x" 成立）；electron **45.0.0**（报告引用的 41.5.0 滞后，Spec 锚定时以 45.x 实测值为准）；react 19.3.1（React 19 成立）；tailwindcss 4.3.3（v4 成立）。
- 架构师自述「Phase 2 规格锚定时以 npm view 实际值钉死」的纪律正确，上述修正已带入 consistency-check.md 与后续 Spec。

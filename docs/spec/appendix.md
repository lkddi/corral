# Corral 技术附件（Spec v0.9 companions）

> 状态：v0.9-draft，随 Spec v1.0 定稿 | 撰写：大湾区靓仔（总监）| 2026-10-26
> 本章为 Spec v0.9（docs/spec/spec.md）的实现级展开，权威冲突时以 Spec + consistency-check（R1-R12）为准
> 原定由架构师产出的 5 章附件，因其运行时故障（网络 502）且历史交付不可信，由总监按 ADR-001~007 + 架构调研 + node-pty spike 一手实证直接撰写

---

## A. 壳层（Electron main）——对 Spec §4.5 / §7

### A.1 窗口
- `frame: false` 自绘标题栏；`backgroundColor` 按主题设 `#F7F8FA` / `#0E1116`（防 1-3s 冷开白闪，Electron 特有问题）
- min 640×480，default 900×560；尺寸位置记忆进**配置文件**（人类可读可审计，与 GUI 偏好分流——dock 几何归 renderer settings JSON）
- macOS `titleBarStyle: 'hiddenInset'` + trafficLightPosition {x:16,y:16}，工具栏内容 x≥80px；Windows 自绘右侧窗口钮 28×28
- 窗口出现即渲染骨架行（§4.13），禁阻塞式「应用加载中」屏

### A.2 原生菜单与托盘（R3）
- 菜单 text-only（main 进程构建，不用 Lucide）：主题子菜单（System/Light/Dark radio）/ Start at Login（checkmark）/ Edit configuration…（`corral edit` 等价）/ Star on GitHub（埋点 star_clicked）/ About / Quit
- 托盘：静态单色 template 图标 16/18px 两档（壳层资源目录，品牌资产豁免 Lucide 锁定）；tooltip = 状态摘要（"Corral — 3 of 4 sites running"）；菜单 Open Corral / Quit；菜单状态由 daemon 推送，renderer 不参与
- 富面板（alwaysOnTop 400px BrowserWindow，blur→hide）v1.1，v0.1 设计已存档

### A.3 自动更新与签名
- electron-updater + GitHub Releases；latest.yml `stagingPercentage` 渐进发布
- macOS：Squirrel.Mac **拒绝安装未签名/未公证更新**——必须 Developer ID 证书 + notarytool + stapler；entitlements 需 allow-jit；helper 进程 entitlements 与主进程分离
- Windows：Authenticode / Azure Trusted Signing 约 $9.99/月（**待用户拍板**）；未签名 = SmartScreen 恐吓 + 无差分更新
- PHP/nginx 二进制更新与 app 更新解耦（app 内 catalog 独立通道）
- 私钥/证书为 CI secret，丢失即断更；GitHub Actions macOS runner 10 倍分钟计费（成本约束）

### A.4 main 进程纪律
- **main 不 require 任何原生模块**（node-pty 宿主在 daemon——main 的 Node ABI 与独立 Node 24.22.0 不同，原生模块进 main 需 electron-rebuild，违反单一运行时原则，R10）
- main 与 daemon 经 RPC 控制通道通信；renderer 与 daemon 经 WS 流通道（pty/Logs）——见 B.3
- 主题同步：renderer 监听 matchMedia 自主切 `<html data-theme>`；main `nativeTheme.themeSource` 同步系统明暗给原生控件；用户菜单覆盖写配置文件，两层互不覆盖

---

## B. daemon（核心引擎）——对 Spec §4.2 / §4.3

### B.1 单实例与生命周期
- 单实例：锁文件 + 端口探测（双保险）；开机启动由 daemon 自装登录项（macOS LaunchAgent / Windows 登录项），不依赖壳插件
- 启动序列：取锁 → 读配置（schema 版本校验）→ 起 nginx（master root、workers 降权）→ 起 PHP-FPM 池（用户态，听 127.0.0.1:900x，pm=ondemand 强制）→ 起 DNS（mac dnsmasq / win 确认 helper 在线）→ 枚举 parked 目录建站 → 就绪
- 崩溃恢复：launchd KeepAlive + ThrottleInterval 防重启雪崩；**launchd 只保「进程存在」不保「进程健康」——必须叠加健康检查**（supervisor 层 TCP 探测 + 周期探活）；Windows 侧 daemon 自实现指数退避看护

### B.2 分层服务
| 服务 | 职责 | 关键实现点 |
|---|---|---|
| supervisor | 进程看护 / 健康检查 / 重启退避 | 子进程表 + 探活环；单站点故障不波及其他站点 |
| sites | 站点注册表 / link/unlink / parked 监听 | 同名 link 后者覆盖并提示；parked 用 fs.watch + 60s 上线 SLA；missing 态枚举 |
| php | 版本管理 / FPM 池 / Windows php-cgi 进程池 | per-version php.ini；mac FPM pm=ondemand；win php-cgi 每版本独占 FastCGI 端口、进程池自写 |
| nginx | per-site conf 生成 / 校验 / 热重载 | 模板含 Laravel 首选驱动（generic/static 兜底）；改后 `nginx -t` 校验再 `-s reload`（HUP）；保留 last-known-good，reload 失败即回滚；per-site conf 标注「可能被重新生成」 |
| dns | .test 解析 | mac：/etc/resolver/test + dnsmasq（root，-u 降权）；win：hosts 精确条目经 SYSTEM helper（无通配符，已知不对称） |
| tls | mkcert / 通配符证书 / CA 信任 | 随包 mkcert；MVP 单张 `*.test` 通配符；mac keychain / win LocalMachine\Root（经 helper，需管理员）；Firefox NSS 文档化 |
| privileged | 提权操作入口 | 仅两件事：写 hosts、装证书；命令白名单制 |

### B.3 双通道
- **RPC 控制通道**：TCP 127.0.0.1 + token（锁文件同源分发）；CLI/GUI 共同后端；契约 = docs/spec/openapi.yaml（23 ops / 10 错误码 / 信封）
- **WS 流通道**：127.0.0.1 only + token，另端口；pty 字节流（Console dock，宿主 = 本 daemon 的 node-pty 1.1.0）+ Logs 实时 tail 共用；JSON 控制帧（subscribe/unsubscribe/resize/kill）+ 二进制数据帧；daemon bundle 加 `ws` 依赖（纯 JS，仅流通道用，不进 CLI bundle）
- **pty 宿主在 daemon 的实证基础**（docs/spikes/2026-10-26-node-pty.md）：Node 24.22.0 / ABI 137 兼容；四平台 prebuild 齐全（win32-x64 含 conpty 全家）无需源码编译；**npm 解包丢 spawn-helper 可执行位 → postinstall chmod +x 或 CI 校验**；冷启 median 20ms / p95 90ms

### B.4 双端进程模型差异（对用户透明，实现不对等）
- macOS：nginx master root + workers 降权；PHP-FPM 用户态；launchd 托管 dnsmasq
- Windows：**不用 Windows Services 跑 nginx/php-cgi**（Laragon 验证的自写编排路线：便携、无注册表污染）；用户态 daemon spawn 并看护全部进程；唯一系统服务 = SYSTEM helper（NSSM 随包注册，安装期经 NSIS 管理员权限完成）
- 端口：80/443/53 为特权端口（mac master root；win helper 承担 hosts 写入，nginx 听 80/443 由 daemon 用户态绑定——Windows 非特权进程可绑 80/443 的保留区间除外，实现期以实测为准并记入已知坑）

---

## C. CLI 与注册表——对 Spec §5

### C.1 shared/commands.ts（命令同源注册表）
- 每个 RPC 与一条 CLI 命令 1:1：参数 schema + 命令字符串模板 + 归一化函数 + 错误码清单
- **GUI 所有命令字符串从注册表模板渲染，组件内禁手写**（CLI/GUI 同源的 UI 落地）；chip 按动词族输出两种完整形（显式站点名形 open/start/stop/restart；cwd 形 link/secure/isolate/logs/unlink = `cd <path> && corral <cmd>`）
- **版本归一化单一实现**：use/isolate/php:install/php:uninstall/link --php/new --php 均接受 `php@<v>` → 裸版本号；GUI/chip/CLI 输出一律裸版本形（R12）

### C.2 CLI 产物与纪律
- 随包 Node **24.22.0** + esbuild 零依赖 JS；**禁** commander/yargs；懒连接（用到 daemon 才连）、即用即退
- **禁 require node-pty / ws**（宿主在 daemon；冷启动预算约束——spike 实测 require node-pty 即占 20ms median）
- 冷启动预算 <300ms；**I1 出口条件：双端实测 <250ms**（10 次 median/p95，口径同 spike）
- `--json` 输出 = daemon 信封；非 --json 交互模式渲染人类可读文本；`--json` 下 open/edit 只返目标数据不执行副作用（R11）
- shell 探测链 pwsh → powershell.exe → cmd.exe（可配置，写 daemon 配置，不落 renderer settings）
- 用法错误（USAGE_ERROR）渲染：message + hint（正确用法）+ 等价命令——错误即教学

---

## D. 数据层——对 Spec §6

### D.1 存储引擎
- JSON 原子写（写 tmp + rename，禁原地覆写）；schema 版本号字段；repository 接口抽象（list/get/put/delete per entity）
- **MVP 无数据库**：better-sqlite3 需按 Electron ABI 重编、node:sqlite 带实验标记；数据量/并发成瓶颈时切 SQLite，业务层零改动（ADR-007）
- 并发：以后写入者为准并提示（CLI/GUI 同站点操作）

### D.2 五实体字段级定义
| 实体 | 字段 | 备注 |
|---|---|---|
| sites | name / path / php / port / secure / enabled / status | status = 五态枚举；enabled=false = 停用（停止页，重启后保持）；同名 link 覆盖 |
| settings | globalPhp / theme / shellChain | 主配置文件；人类可读可审计 |
| parked-dirs | path[] | 写入仅 CLI + 配置文件；GUI 只读可见性行 |
| php-versions | version / path / installedAt / extensions[] | 目录按版本隔离，php.ini 每版本独立；静态构建扩展集固定（README 公布） |
| catalog-cache | version / sha256 / url / fetchedAt | 与 app 更新解耦 |

---

## E. 验收（Spec §9/§12 可执行化）

### E.1 核心循环（Given/When/Then 直译）
1. 已安装 + PHP 8.3 已下载 → 项目目录 `corral link --php 8.3` → 3s 内 https://<目录名>.test 返回 8.3 响应
2. 已 `corral park ~/code` → 新建目录 → 60s 内自动 https 可访问
3. 已链接站点 → `corral isolate 8.1` → 该项目走 8.1、其他站点不受影响
4. CA 未安装 → `corral secure` → 系统信任库新增本地 CA、浏览器零警告
5. 任意命令 + `--json` → 合法 JSON（status/data/error）可被 jq 解析
6. 断网 → 已缓存版本站点全功能正常；下载新版本失败有明确归因 + 重试入口
7. GUI 首屏 <2s 热启 / <3s 冷启（含拉起 daemon，骨架 + 渐进加载态）

### E.2 性能（实测口径）
- CLI 冷启动 <300ms；I1 出口双端实测 <250ms（10 次 median/p95）
- link 到可访问 <3s（PHP 已缓存）
- daemon 空闲内存 <200MB（4 默认版本 + pm=ondemand 前提）
- Console spawn + 首字节 <100ms（spike 实证 median 20ms / p95 90ms）

### E.3 双端矩阵
- macOS 12+（Intel + Apple Silicon 均验证）；Windows 10/11 + PowerShell
- 相同命令序列 → 命令名/参数/输出结构一致；DNS 机制差异对用户透明；全流程无需手动编辑 hosts 或装 Homebrew

### E.4 Console dock（spike 已证 + 验收补强）
- spawn（选中站点目录或 home）/ 输入回显 / resize / kill 退出 / daemon 重连后新 shell
- Logs tail 同通道实时（<1s 延迟）；shell 链 pwsh→powershell→cmd
- **安装期断言：npm 装 node-pty 后 spawn-helper 可执行位必须校验（chmod +x）**，裸装失败 = 安装 bug（spike 真坑）

### E.5 故障注入与卸载
- 端口占用（报进程名+PID）/ 断网下载 / CA 拒绝（降级说明）/ parked 目录删除（missing 态）/ daemon 被杀自恢复
- `corral uninstall` → CA 移除 + hosts/resolver 还原 + 无残留进程

### E.6 CI 门禁（合并进 §12 端到端）
- P0 emoji 扫描 0 命中 / tokens.json 合法 / 命令表与 consistency-check §3 对齐（无 --all、无 stop&&start、open 无参=用法错误表述在位）/ openapi.yaml YAML 可解析（Ruby/Node）/ lucide-react 精确钉 1.61.0 / node-pty spawn-helper 可执行位校验（双端）

# PHP 运行时与站点链路实证（I1）

> 日期：2026-10-28 · 平台：macOS 26.7.1 / arm64 · Node 运行时：系统 v22.22.2（随包运行时为 24.22.0，队列对齐在 I2 打包阶段）
> 全部数据为终端可复现的一手实测；命令见文末「复现」。

## 结论速览

| 项 | 实测结果 | 判定 |
|---|---|---|
| catalog 通道可达 | `dl.static-php.dev` HTTP 200，`?format=json` 全量清单可解析 | 通过 |
| 可用版本 | 8.0.30 / 8.1.34 / 8.2.32 / 8.3.32 / 8.4.23 / 8.5.8（双架构） | 通过 |
| 单版本制品 | **cli + fpm 两个归档**，各 ~13–14MB，合计 ~28MB | 见坑 1 |
| 下载完整性 | CDN 单连接在 4–5MB 处重置；**Range 续传后成功**，全程 7 分钟 | 见坑 2 |
| 解包 | 布局自适应（根层 / 单顶层目录）均可 | 见坑 1 |
| 站点链路 | `nginx → unix socket → php-fpm` 返回 `PHP 8.4.23 / fpm-fcgi` | 通过 |
| 未知 Host | 兜底 `default_server` 返回 404（不串站） | 通过 |
| 扩展集（common 构建） | 13 项 Laravel 硬需求**全在**；缺 `intl`、`xdebug` | 见坑 3 |
| CLI 冷启动 | `corral`（纯本地帮助）median 48ms / p95 53ms；`status --json`（含 daemon RTT）median 98ms / p95 99ms | 通过（预算 250ms） |

## 坑 1：fpm 归档不含 php CLI，且两种布局

- `php-8.4.23-fpm-macos-aarch64.tar.gz` 解包只有 `php-fpm`，**没有** `php`。只装 fpm 的后果：站点能跑，但 `php -r` 自检、项目内 `artisan`、composer 全部失效。
- 上游另发 `php-<v>-cli-macos-<arch>.tar.gz`，两者需**合并解到同一目录**。
- 归档布局有两种：根层直接放二进制，或包一层顶层目录。固定 `tar --strip-components=1` 会把前者剥成空目录——症状是「下载成功但解包后没有 php 二进制」，极易误判为网络问题。
- 现实现：`extractTarGz` 先解到 staging，若只有单一顶层目录则整体上移，否则原样搬平。

## 坑 2：CDN 中途掐连接，必须 Range 续传

- 现象：`fetch` 的 `pipeline` 不报错，但文件被截断在 4–5MB（undici 侧报 `terminated`）。
- 二次伤害：截断的 `.tar.gz` 解包得到空目录 → 伪装成「归档里没有 php 二进制」。
- 现实现（`downloadWithRetry`）：
  1. 以已落盘字节数为 offset 发 `Range: bytes=<offset>-`；
  2. 服务器忽略 Range（返回 200 而非 206）则清空重下；
  3. 每轮结束比对 `content-length` 推算的总长，齐了即停；
  4. 摘要改为下载完成后整体计算（续传拼接无法增量哈希）。
- 该路径同时也是「断网/弱网下载」的产品级韧性要求（Spec §9 错误态：下载失败区分网络 vs 校验）。

## 坑 3：common 构建缺 intl / xdebug

实测 `common` 变体扩展清单（46 项）含 Laravel 13 项硬需求（ctype/curl/dom/fileinfo/filter/hash/mbstring/openssl/pcre/pdo/session/tokenizer/xml），但缺 `intl` 与 `xdebug`。

- 影响：ADR-009 的「开发默认集」不完整；`corral debug:on` 在 common 构建上不可用（Xdebug 是随 PHP 编译进去的，静态构建无法 pecl 补装）。
- 缓解：catalog 已支持 `phpBuild: 'common' | 'bulk'` 构建变体开关（默认 common）；`corral doctor` 新增 `php-ext-<v>` 检查，把缺口显式暴露而不是假装完整。
- 待办（I2）：用真实 `bulk/` 归档验证扩展清单（其 `build-extensions.json` 不可读，需下载实测），确认含 intl + xdebug 后把默认切到 bulk，代价是包体增大。

## 复现

```bash
cd /Users/pllx/Web/corral
npm run build --workspace @corral/core && npm run build --workspace @corral/cli

export CORRAL_DATA_DIR=/tmp/corral-i1 CORRAL_TLD=corral CORRAL_HTTP_PORT=18080
export CORRAL_NGINX_BIN=/Applications/Herd.app/Contents/Resources/nginx-arm64   # 任一 nginx 均可
node packages/core/dist/daemon/index.js &          # 前台运行以便观察

node packages/cli/dist/corral.js php:install 8.4    # 真实下载 cli+fpm 并校验
mkdir -p /tmp/demo && echo '<?php echo json_encode(["php"=>PHP_VERSION,"sapi"=>PHP_SAPI]);' > /tmp/demo/index.php
(cd /tmp/demo && node packages/cli/dist/corral.js link)
curl -sS --noproxy '*' -H "Host: demo.corral" http://127.0.0.1:18080/
node packages/cli/dist/corral.js doctor
```

> 注：本机 `HTTP_PROXY` 指向 127.0.0.1，curl 访问本地端口必须加 `--noproxy '*'`，否则会被代理拦成 502/假 404——这是环境陷阱，不是产品缺陷。

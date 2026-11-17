# gl-ui-avahi-daemon

为 GL.iNet SDK4 管理后台添加 **应用程序 → Avahi**，管理 avahi-daemon 的 mDNS / DNS-SD 配置。页面复用固件的 Vue、GL 组件、主题和 `/rpc` 管理员会话，无需独立 Web 服务。

本项目是第三方扩展，并非 GL.iNet 官方软件。需要已安装 Avahi 的 GL.iNet SDK4 固件；不适用于仅有 LuCI 的 OpenWrt。

## 功能

- 基本设置：主机名、域名、IPv4 / IPv6、接口允许和排除列表、浏览域、TTL 检查、接口检测、缓存和速率限制。
- 服务发布：地址、主机信息、工作站、域名、DNS 服务器、IPv4 / IPv6 跨协议地址发布。
- mDNS 反射：跨接口反射及 IPv4 / IPv6 间反射。
- 高级设置：广域 DNS-SD 和进程资源限制。
- 服务状态、版本、启动、停止、重启、独立的开机启动开关。
- umdns 双向开关：禁用时停止服务并禁用开机启动；完全禁用后按钮变为“启用 umdns”，可启动服务并启用开机启动。未安装或状态未知时按钮不可用。
- 最近 200 条 Avahi 系统日志，按需或每 5 秒刷新。
- 中英文、窄屏布局、未保存修改保护、配置冲突检测、原子写入和保存前备份。

共管理 35 项设置，前后端共享 `files/usr/share/avahi-ui/schema.json`。接口提示来自 `/sys/class/net`，应填写 `br-lan` 等实际设备名，而非 UCI 逻辑接口名 `lan`。

## 保存与应用

直接读取、修改 `/etc/avahi/avahi-daemon.conf`，不另建 UCI 配置，不替换 Avahi 的 init 脚本。只更新界面支持的字段，保留注释、其他字段及未改动的设置；无变化保存不重写文件。空文本或“默认”会移除该项覆盖，使用 Avahi 的内置默认值。内置默认值与 OpenWrt 默认配置文件中显式设置的值可能不同。

- **保存**：只写配置，运行中的服务不受影响。
- **保存并应用**：保存后，若服务正在运行或已启用开机启动，则请求重启；若服务既未运行也未启用，则保持停止，下次启动生效。重启请求成功后仍需检查实际状态和日志。
- **启动 / 停止 / 重启**：立即操作服务，不保存页面草稿，也不改变开机启动状态。
- **开机启动**：只更改 init 启用状态，不立即启停服务。
- **禁用 / 启用 umdns**：只操作 umdns，不保存 Avahi 草稿；禁用时停止服务并禁用开机启动，启用时启动服务并启用开机启动，操作完成后核对实际状态。安装或升级界面不会自动切换 umdns。

Avahi 的 SIGHUP 不会重新读取主配置，因此主配置变更使用 restart。保存前将旧文件备份到 `/etc/avahi/avahi-daemon.conf.gl-ui.bak`，每次实际修改覆盖该备份。若其他会话或 SSH 修改了配置，当前页面保存会被拒绝；先备份自己的草稿，再刷新页面。

界面不编辑 `/etc/avahi/services/*.service` XML 文件，现有服务定义继续生效，也不修改防火墙。开启反射前请限制参与接口，避免把 WAN 加入，并按网络实际情况允许 UDP 5353 等必要流量。

## 安装

先从固件软件源安装兼容的 `avahi-daemon`（`avahi-dbus-daemon` 或 `avahi-nodbus-daemon` 提供该虚拟包）。RPC 还需要固件的 `gl-oui-rpc`、`luci-lib-nixio`、`luci-lib-ip` 及 SDK 自带的 `cjson.safe`。

将本仓库复制到路由器，在仓库目录执行：

```sh
sh scripts/install.sh
```

脚本预检 SDK4、Avahi、Lua 模块及 nginx 配置，备份当前 Avahi 配置和已有插件文件到 `/root/avahi-ui-backup/`，然后安装界面并重载 nginx。不会启动或重启 Avahi。刷新后台，打开“应用程序 → Avahi”，或访问：

```text
http://192.168.8.1/#/avahi-daemon
```

路由器地址按实际情况替换。脚本安装没有软件包版本元数据时，UI 版本显示 `—`。

卸载脚本安装的界面：

```sh
sh scripts/uninstall.sh
```

只移除本插件文件，保留 Avahi、配置、备份和服务运行状态。通过包管理器安装的版本，请通过 `opkg remove gl-ui-avahi-daemon` 或 `apk del gl-ui-avahi-daemon` 卸载。

## 版本跟随与自动发布

与 Momo 插件采用相同规则：UI 包版本跟随上游服务包的 `PKG_VERSION` 和 `PKG_RELEASE`，再附加本项目提交的前 7 位哈希。本项目读取 [OpenWrt packages 的 Avahi Makefile](https://github.com/openwrt/packages/blob/master/libs/avahi/Makefile)，默认分支为 `master`。Avahi 的服务包定义在该软件源仓库中，因此解析分支提交，而不是使用不存在的 OpenWrt packages Release。

准备发布时先将分支解析为完整提交哈希，再读取该提交中的 `libs/avahi/Makefile`，保证版本与源码来源一致。保留 OpenWrt 的预发布写法，例如 `0.9_rc5`；同时记录上游和 UI 的完整提交哈希。无法联网、版本无法解析或 UI 仓库还没有提交时，立即失败，不修改 Makefile、不伪造哈希。

例如，上游包为 `0.9_rc5-r1`、本项目提交短哈希为 `abcdef0`：

| 用途 | 版本或名称 |
|---|---|
| APK 版本 | `0.9_rc5~abcdef0-r1` |
| APK 文件 | `gl-ui-avahi-daemon-0.9_rc5-abcdef0-r1.apk` |
| GitHub Release 标签 | `v0.9_rc5-r1+abcdef0` |

与 Momo 一样，APK 元数据使用 `~`，文件名使用 `-` 避免 GitHub 上传时改名，Release 标签使用 `+`。不再为 UI 修改手动递增独立的 `1.0.0-rN` 版本。

`main` 上软件包相关文件变化或手动运行 [发布工作流](.github/workflows/build-release.yml) 时，自动解析上游版本、测试源码和精简产物、构建并校验 APK，再发布 APK 与 SHA256 文件。发布阶段沿用构建阶段解析的同一组版本，不重复查询上游。已有标签仅可由同一完整 UI 提交更新，防止覆盖其他源码和短哈希碰撞。PR 使用独立测试工作流，不发布 Release。

版本准备只修改构建工作区，不自动提交或推送。在本地准备发布需要 Python 3、Git 和网络：

```sh
python3 scripts/prepare-release.py
# 可指定与固件配套的软件源分支或固定提交
python3 scripts/prepare-release.py --upstream-ref openwrt-25.12
```

首次从旧编号切换时，新版本可能按 APK 规则低于 `1.0.0`。请安装明确指定的本地 APK；从软件源对齐版本时可使用 `apk upgrade --available gl-ui-avahi-daemon`。提交哈希的字典顺序不代表发布时间，这一点同样适用于后续软件源更新。

## OpenWrt 打包

### 独立生成 APK

构建机需要 Node.js 22+ 和 Docker，无需 OpenWrt SDK 或交叉编译：

```sh
npm ci --ignore-scripts --no-audit --no-fund
python3 scripts/prepare-release.py
npm run build:apk
node scripts/test-apk.cjs
```

输出 `dist/gl-ui-avahi-daemon-上游版本-提交短哈希-r上游修订.apk` 和同名 `.sha256`。包为 APKv3、`noarch`，依赖、版本和安装钩子直接读取本仓库 Makefile。使用固定摘要的 Alpine 3.23 官方镜像和 `apk mkpkg --compat 3.0.0_pre1`；准备好镜像和构建依赖后，打包容器不访问网络。版本准备需要网络，打包不重复解析上游；如只需使用 Makefile 当前版本，可跳过版本准备。原生 Linux 上已有 apk-tools 3 时，可用 `AVAHI_APK_NATIVE=1 sh scripts/build-apk.sh`。

OpenWrt 与独立 APK 共用 `scripts/build-assets.cjs`，在临时目录中用锁定版本的 Terser 精简 JavaScript、luamin 精简 Lua 源码，并压紧 JSON。保留 Vue 属性、RPC 名称和配置数据，不生成依赖 CPU 架构的 Lua 字节码。仓库源码保持可读，源码安装脚本仍直接使用原文件。Node/npm 与精简工具只在构建机使用，路由器不增加运行依赖。

以 1.0.0-r6 的相同功能源码为基准，r7 的文件体积如下；安装文件按内容字节数统计，实际闪存占用取决于文件系统：

| 项目 | 精简前 | 精简后 | 减少 |
|---|---:|---:|---:|
| APK | 13,976 字节 | 11,674 字节 | 16.5% |
| 安装文件合计 | 46,586 字节 | 30,065 字节 | 35.5% |

默认时间戳取最新 Git 提交时间，也可以设置 `SOURCE_DATE_EPOCH`。GitHub Actions 在测试通过后构建、核对 APK 元数据和全部文件哈希，并上传 APK 与校验文件。

### 部署 APK

在构建机执行（SSH 地址按实际情况替换）：

```sh
sh scripts/deploy-apk.sh root@192.168.8.1
# 也可明确指定 APK
sh scripts/deploy-apk.sh root@192.168.8.1 dist/gl-ui-avahi-daemon-0.9_rc5-abcdef0-r1.apk
```

显式文件名中的版本和哈希按实际构建结果替换；不指定文件时直接读取当前 Makefile。脚本复用 SSH 密钥、agent 或交互密码，不保存密码。它会核对 SDK4、APK 版本、文件校验和及依赖，备份现有插件文件和 Avahi 配置，安装后检查配置逐字节一致、Lua、nginx、原生菜单和真实 RPC，并执行一次不重启服务的无变化保存。备份目录为 `/root/avahi-ui-backup/apk-时间-进程号/`。可设置 `AVAHI_SSH_CONTROL_PATH` 复用已有 SSH ControlMaster 连接。

若手动复制 APK 到路由器 `/tmp`，安装命令为：

```sh
apk add --allow-untrusted /tmp/gl-ui-avahi-daemon-0.9_rc5-abcdef0-r1.apk
```

本地 APK 未签名，因此需要 `--allow-untrusted`。已在 GL-MT3600BE 的 APK 3.0.5 上完成安装、升级、菜单发现、配置读取、日志与无变化保存验证。刷新后台，访问 `#/avahi-daemon`。

### 在 OpenWrt 构建树中编译

在含有 GL.iNet SDK4 软件包的 OpenWrt 构建树中，将本仓库放到 `package/gl-ui-avahi-daemon`。构建主机需要 Node.js 22+，然后执行：

```sh
npm --prefix package/gl-ui-avahi-daemon ci --ignore-scripts --no-audit --no-fund
python3 package/gl-ui-avahi-daemon/scripts/prepare-release.py
make defconfig
make package/gl-ui-avahi-daemon/compile V=s
```

这是纯 Lua / JavaScript 包，`PKGARCH=all`，构建时生成精简安装目录，无需交叉编译或 Node 运行依赖。由构建树选择输出 IPK 或 APK。安装、升级和卸载的包钩子会重载 nginx，使 RPC 缓存更新。

## 本地验证

需要 Node.js 22+、Lua 5.1 及锁定的构建依赖：

```sh
npm ci --ignore-scripts --no-audit --no-fund
python3 scripts/test-release-version.py
npm test
# Lua 不在默认路径时
LUA=/path/to/lua5.1 npm test
```

测试覆盖配置保留、重复键和重复节、大小写、CRLF、输入校验、并发冲突、部分写入、写入失败、服务命令限制、保存后重启失败、页面草稿与导航保护、错误状态、中英文和组件事件。同一套行为检查还会针对精简后的 JavaScript 与 Lua 执行，并校验配置数据、文件清单、源码保留及构建可重复性。RPC 测试使用内存中的 SDK / OpenWrt 替身，不接触本机系统配置。GitHub Actions 自动执行相同测试。

可在路由器运行 `lua scripts/test-live.lua` 验证真实 RPC、菜单、服务状态、日志及无变化保存。网络中真实设备间的发现和跨网段反射仍需按实际拓扑验收。

配置保存期间使用 `/var/lock/avahi-ui.lock` 目录互斥。若进程意外中断留下锁，请确认没有保存操作正在进行，再由管理员移除空锁目录后重试。

## 实现依据

- [OpenWrt Avahi 包及默认配置](https://github.com/openwrt/packages/tree/master/libs/avahi)
- [Avahi 0.8 配置手册](https://github.com/avahi/avahi/blob/v0.8/man/avahi-daemon.conf.5.xml.in)
- [Avahi 主程序与重载处理](https://github.com/avahi/avahi/blob/v0.8/avahi-daemon/main.c)
- [Avahi INI 解析器](https://github.com/avahi/avahi/blob/v0.8/avahi-daemon/ini-file-parser.c)

许可证：GPL-3.0-only。

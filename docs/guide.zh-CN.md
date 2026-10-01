# Grok 订阅使用指南

[返回项目首页](../README.md) · **简体中文** · [English](guide.en.md)

快速安装见 [README](../README.md#安装)。本指南说明实际依赖、能力边界和排查顺序。

## 安装与兼容性

需要 DeepSeek Harness 桌面版，以及当前具有 Grok Build 使用资格的订阅账号。不需要安装 grok 命令。插件的 Node.js 要求为 `^22.19.0 || >=24.0.0`，DSH peer 声明以 [package.json](../package.json) 为准；其中 DSH 依赖使用 `>=0.1.5-rc.2 <0.3.0-0`，覆盖 0.1 与 0.2 全线。声明范围不等于所有版本都已经过实机验证。

**安装：** 在桌面版打开 **设置 → 插件**，在安装输入框里填入包名 `dsh-grok-subscription` 并安装，然后**完全退出并重启桌面应用**。仅刷新页面不会重新加载 Host 中的适配器。需要可重复安装时，填入完整的 `包名@版本`，例如 `dsh-grok-subscription@2.0.5`。

**插件依赖宿主自带的 pi-ai 适配器。** 从 2.0.0 起，`grok-build` 路由完全由宿主的 `@deepseek-ai/dsh-llm-pi-ai` / `@earendil-works/pi-ai` 服务；DSH 的任何安装方式都带有它们（`@deepseek-ai/dsh` → `dsh-base` → `dsh-llm-pi-ai`，且 `llm-pi-ai` 行无条件挂载）。这两个包无法从 DSH 安装目录解析时，插件不会注册任何路由，设置页的「运行通路」显示**不可用**。

界面安装失败时（例如 profile 目录权限异常），可以对桌面版 profile 手动执行等价操作（pnpm ≥ 11）：

```sh
cd "$HOME/.dsh/profiles/desktop"    # Windows: cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add --save-exact --config.minimumReleaseAge=0 dsh-grok-subscription@2.0.5
```

`dsh plugin --profile desktop …` 会被直接拒绝：桌面版 profile 由 Electron 应用独占。

## 登录与凭据

登录在 DSH Host 本机完成，不是在看网页的另一台设备上。设置页的 **登录** 向 `https://auth.x.ai` 申请设备码，把链接和一次性验证码显示在面板里，并尝试打开浏览器。授权完成后，插件把会话写入 `${GROK_HOME:-$HOME/.grok}/auth.json`。已经有这份文件时，点 **读取已保存的会话**。只有 `XAI_API_KEY` 的条目不属于 Grok Build 订阅登录。不要复制 `auth.json`、access token 或 refresh token 到聊天和公开问题中。

插件读写这个文件时拒绝符号链接、非普通文件及不安全的所有权或权限。在 macOS / Linux 上，确认路径和所有者正确后，可修正权限：

```sh
chmod 600 "${GROK_HOME:-$HOME/.grok}/auth.json"
```

此命令不能修正错误所有者，也不能把符号链接变成安全文件。插件只更新其中的 OAuth 条目，并保持文件为 `0600`；其他条目（包括 API key）会保留。DSH 只保存使用所需的短期 access token，refresh token 留在这个文件里，不通过浏览器 RPC 返回。详见 [SECURITY.md](../SECURITY.md)。

## 模型目录与推理档位

登录后优先从 `/v1/models-v2` 读取模型目录；未登录时模型为空。接口失败、超时或返回空目录时，使用内置 `grok-4.7` / `grok-4.6` / `grok-4.5` 列表，并记录目录错误。**回退的是目录，不是另一个付费服务；目录中的模型也不保证账号有调用权限。**

推理档位按模型元数据提供。当前实现识别 `low` / `medium` / `high` / `xhigh`，通常默认 `high`；内置 `grok-4.5` 目录只包含前三档。以实际菜单与服务端接受的选项为准。实现见 [catalog.js](../src/catalog.js)。

登录、读取会话、登出和目录刷新会通知模型选择器更新。临近已知的 token 到期时间时，插件用 auth.json 里的 refresh token 向 `https://auth.x.ai` 续期；若续期失败或服务端已撤销会话，仍需要重新授权，不承诺会话永不失效。

## 图片输入

当前源码仅对以下模型声明图片输入：

```text
grok-4.7
grok-4.7-build-fast
grok-4.6
```

准确 ID 来自 [constants.js](../src/constants.js) 的 `IMAGE_INPUT_MODEL_IDS`；`grok-4.5` 不在其中。图片输入并非图片生成，也不能从模型名称推断未知模型一定支持图片。

在输入框粘贴或附加图片后，DSH 的附件服务会按像素与体积预算处理。图片超出可用预算时可能降级为文本说明；不要假设每张原图都以原始分辨率发出。

`grok-build` 路由由宿主官方的 pi-ai 适配器服务，图片通路（附件解析、像素与体积预算）也由它负责。设置页的 **运行通路** 会显示适配器是否在服务，以及图片输入是否可用；显示**不可用**时说明宿主缺少 pi-ai 适配器。更新后只有界面刷新、Host 未重启时，可能仍在运行旧版本。

## 额度与缓存

用量通过未公开的 `/v1/billing?format=credits` 接口读取，属于实验性能力。设置页展示实际返回的已用和剩余比例；接口变化、网络异常或认证失效都可能使数据不可用。

输入框徽章仅在当前 provider 为 `grok-build` 且用量读取成功时显示，悬停或点击查看每周余量与重置时间。读取失败不会编造百分比，也不会因为单独的额度读取故障阻止聊天。唯一的例外是 protobuf 把 0 省略掉：响应里有完整的周或月 `currentPeriod`、窗口包住当前时间、并且没有任何百分比字段时，显示已用 0%、剩余 100%，并标明这是零值省略。窗口对不上、只有预付余额或按量上限、或者产品明细里已经有百分比时，仍然不显示数字。

前缀缓存方面，插件为同一 DSH 会话固定同一个 `prompt_cache_key`（`grok:<sessionId>`），并在请求里显式写入，工具顺序保持稳定。压缩、会话标题这类辅助请求与会话共用同一个 key，而不是另开一个——对代理实测下来，隔离它们并不会提高聊天前缀的缓存命中。这些是请求构造措施，不保证服务端缓存命中或节省额度；项目不提供虚构的命中率。实现见 [adapter.js](../src/adapter.js)。

## 故障排查

**没有弹出登录窗口。** 看面板是否已经显示可点击的授权链接和验证码。浏览器没有弹出，不一定等于 `auth.x.ai` 不可达；点「打开登录页面」。需要代理时，在 DSH 启动环境或 `~/.dsh/.env` 设置 `https_proxy` 后完全重启。注意 `DSH_*` 是 DSH 的 bootstrap 前缀，写进 `~/.dsh/.env` 会让该环境层直接报错。

**`fetch failed` / `Billing request timed out`。** 分别检查账号服务和 `cli-chat-proxy.grok.com` 的网络连接。需要代理时，在 DSH 启动环境或 `~/.dsh/.env` 中设置标准 `https_proxy` / `http_proxy`，而不是放进项目目录的 `.env`；再手动重启 DSH。插件沿用宿主网络配置，不提供单独代理服务。网络只是可能原因，还应检查认证和服务端错误。

**模型列表为空。** 先完成订阅登录，或点击「读取已保存的会话」。检查是否只有 API-key 条目；查看目录状态，不要公开原始响应。

**聊天或用量返回 `401`。** 自动续期失败时，在设置页重新登录。不要反复粘贴旧 token。

**对话返回 HTTP 426，提示 Grok CLI 版本过旧。** 生成接口（`POST /v1/responses`）要求 `x-grok-client-version` 不低于 `1.0.13`。模型目录和额度接口不检查这项，所以设置页、模型列表和用量卡片可以一切正常，只有发消息失败。`2.0.4` 及更早在没有 grok 命令、也读不到 `~/.grok/version.json` 时会声明 `1.0.5`。当前版本在没有不低于内置回退值的 CLI 正式版本时，改发该回退值（高于已公布的下限；`1.0.13-rc1` 这类预发布号不算）。过旧的 `version.json` 不会再把请求头拉低。仍要自己指定时，在**启动 DSH 的进程环境**里设置 `DSH_GROK_CLIENT_VERSION`（`MAJOR.MINOR.PATCH` 正式版本，且不低于 `1.0.13`），然后完全重启。不要写进 `~/.dsh/.env`：`DSH_*` 会被启动层拒绝。

**图片被拒绝。** 对照图片支持列表，确认设置页「运行通路」显示**官方 pi-ai** 且附件能力可用，并在更新后完整重启桌面应用。

**文件权限错误。** 检查 auth 文件的真实路径、所有者、是否为符号链接以及权限；`chmod 600` 仅解决权限位问题。

**旧版本发消息无回复。** `1.0.0` 存在已在 `1.0.1` 修正的工具调用序列化问题；旧版本也可能缺少后续续期修复。先更新到当前发布版，再定位仍然存在的问题，不要把所有无回复都归因于旧缺陷。

**DSH 更新后插件从设置页消失。** 0.2.0 起，插件的 `@deepseek-ai/dsh*` peer 范围若不包含当前运行版本，DSH 会在加载任何插件代码之前丢掉整个 bundle：既没有 `grok-build` 路由，也没有设置分区，界面里没有任何提示。Host 自己的 stderr 会输出 `skipping profile bundle "dsh-grok-subscription"`（桌面版不允许通过 `dsh --profile desktop --dump-config` 检查，以这行日志为准）。此时应更新插件，而不是授予版本豁免——豁免会重新启用一个从未针对该 Host 验证过的构建。

**「运行通路」显示不可用。** 说明宿主缺少 pi-ai 适配器：`@earendil-works/pi-ai` 或 `@deepseek-ai/dsh-llm-pi-ai` 无法从 DSH 安装目录解析。确认 DSH 安装完整、没有手工裁剪 `node_modules`，然后完全重启桌面应用。

## 更新与登出

**更新：** 在 **设置 → 插件** 的安装框里重新填入 `dsh-grok-subscription`（或 `dsh-grok-subscription@版本`）安装即可覆盖；插件自己的设置页也有版本卡片与「更新插件」按钮。完成后**完全退出并重启桌面应用**。

桌面版的 `desktop` profile 由 Electron 应用独占，`dsh plugin --profile desktop …` 会被直接拒绝（`profile "desktop" is managed exclusively by the Electron application`），因此桌面版的更新由插件在该 profile 目录中用 DSH 自带的 pnpm 安装精确版本。1.1.1 之前插件自己的按钮在桌面版必然失败；界面安装失败时也可以在终端手动执行（pnpm 需 ≥ 11）：

```sh
cd "$HOME/.dsh/profiles/desktop"    # Windows: cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add --save-exact --config.minimumReleaseAge=0 dsh-grok-subscription@2.0.5
```

然后完全退出并重启桌面版。更新成功后该 profile 的 `package.json` 里依赖应变为目标版本，`dsh.profile.bundles` 条目保持不变。仅刷新网页不够：Host 未重启时仍会加载旧版本。

**卸载：** 在 **设置 → 插件** 里移除 `dsh-grok-subscription`，或在该 profile 目录执行 `pnpm remove dsh-grok-subscription`。这不删除整个 profile、其他插件或 `~/.grok/auth.json`。

设置页「登出」清理的是插件侧会话状态，不会删除 `auth.json`，也不等于在 xAI 撤销授权。文件还在时，之后读取会话或重新打开设置可能再次同步登录。不要靠删除整个 DSH profile 来处理一个账号。

## 本地开发

按 [CONTRIBUTING.md](../CONTRIBUTING.md) 安装锁定依赖、运行测试并构建：

```sh
npm ci
npm test
npm run build
```

源码修改后重新生成已跟踪的 `lib/`，不要手工编辑产物。测试与构建通过不等于真实登录、界面和模型调用已验证；验证 Host 改动前需要手动重启 DSH。

# Grok 订阅使用指南

[返回项目首页](../README.md) · **简体中文** · [English](guide.en.md)

快速安装见 [README](../README.md#安装)。本指南说明实际依赖、能力边界和排查顺序。

## 安装与兼容性

需要 DeepSeek Harness 桌面版、官方 Grok Build CLI，以及当前具有 Grok Build 使用资格的订阅账号。插件的 Node.js 要求为 `^22.19.0 || >=24.0.0`，DSH peer 声明以 [package.json](../package.json) 为准；其中 DSH 依赖使用 `>=0.1.5-rc.2 <0.3.0-0`，覆盖 0.1 与 0.2 全线。声明范围不等于所有版本都已经过实机验证。

**安装：** 在桌面版打开 **设置 → 插件**，在安装输入框里填入包名 `dsh-grok-subscription` 并安装，然后**完全退出并重启桌面应用**。仅刷新页面不会重新加载 Host 中的适配器。需要可重复安装时，填入完整的 `包名@版本`，例如 `dsh-grok-subscription@2.0.1`。

**插件依赖宿主自带的 pi-ai 适配器。** 从 2.0.0 起，`grok-build` 路由完全由宿主的 `@deepseek-ai/dsh-llm-pi-ai` / `@earendil-works/pi-ai` 服务；DSH 的任何安装方式都带有它们（`@deepseek-ai/dsh` → `dsh-base` → `dsh-llm-pi-ai`，且 `llm-pi-ai` 行无条件挂载）。这两个包无法从 DSH 安装目录解析时，插件不会注册任何路由，设置页的「运行通路」显示**不可用**。

界面安装失败时（例如 profile 目录权限异常），可以对桌面版 profile 手动执行等价操作（pnpm ≥ 11）：

```sh
cd "$HOME/.dsh/profiles/desktop"    # Windows: cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add --save-exact --config.minimumReleaseAge=0 dsh-grok-subscription@2.0.1
```

`dsh plugin --profile desktop …` 会被直接拒绝：桌面版 profile 由 Electron 应用独占。

## 登录与凭据

**官方 Grok Build CLI 必须在 DSH Host 上可用**，不是只安装在访问网页的手机或另一台电脑上。插件按以下顺序寻找命令：`DSH_GROK_BIN` 指定的路径、`${GROK_HOME:-$HOME/.grok}/bin/grok`、系统 `PATH` 中的 `grok`。Windows 上按 `PATHEXT` 补全后缀（`.exe`、`.cmd` 等），所以安装成 `grok.exe` 也能识别。实现见 [session.js](../src/session.js)。

可在设置页发起 **CLI 登录** 或 **设备码登录**；插件会调用官方 CLI，并将可用的授权链接和一次性验证码显示在面板中。也可以自行在本机运行：

```sh
grok login
```

授权完成后点击 **从 Grok CLI 拉取**。只有 `XAI_API_KEY` 的配置不属于 Grok Build 订阅登录。不要复制 `auth.json`、access token 或 refresh token 到聊天和公开问题中。

插件读取 `${GROK_HOME:-$HOME/.grok}/auth.json`，拒绝符号链接、非普通文件及不安全的所有权或权限。在 macOS / Linux 上，确认路径和所有者正确后，可修正权限：

```sh
chmod 600 "${GROK_HOME:-$HOME/.grok}/auth.json"
```

此命令不能修正错误所有者，也不能把符号链接变成安全文件。插件自身不写回这个文件；官方 CLI 会管理会话文件和续期。DSH 只保存使用所需的短期 access token，不把 token 通过浏览器 RPC 返回。详见 [SECURITY.md](../SECURITY.md)。

## 模型目录与推理档位

登录后优先从 `/v1/models-v2` 读取模型目录；未登录时模型为空。接口失败、超时或返回空目录时，使用内置 `grok-4.7` / `grok-4.6` / `grok-4.5` 列表，并记录目录错误。**回退的是目录，不是另一个付费服务；目录中的模型也不保证账号有调用权限。**

推理档位按模型元数据提供。当前实现识别 `low` / `medium` / `high` / `xhigh`，通常默认 `high`；内置 `grok-4.5` 目录只包含前三档。以实际菜单与服务端接受的选项为准。实现见 [catalog.js](../src/catalog.js)。

登录、拉取、登出和目录刷新会通知模型选择器更新。临近已知的 token 到期时间时，插件会通过官方 CLI 续期；若续期失败或服务端已撤销会话，仍需要重新授权，不承诺会话永不失效。

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

输入框徽章仅在当前 provider 为 `grok-build` 且用量读取成功时显示，悬停或点击查看每周余量与重置时间。缺失数据不是额度为零；读取失败不会编造百分比，也不会因为单独的额度读取故障阻止聊天。

前缀缓存方面，插件为同一 DSH 会话固定同一个 `prompt_cache_key`（`grok:<sessionId>`），并在请求里显式写入，工具顺序保持稳定。压缩、会话标题这类辅助请求与会话共用同一个 key，而不是另开一个——对代理实测下来，隔离它们并不会提高聊天前缀的缓存命中。这些是请求构造措施，不保证服务端缓存命中或节省额度；项目不提供虚构的命中率。实现见 [adapter.js](../src/adapter.js)。

## 故障排查

**找不到 `grok` / 不弹出登录窗口。** 检查 CLI 是否安装在 DSH Host、`DSH_GROK_BIN` / `PATH` 是否对该进程可见，以及面板是否已显示可点击授权链接。浏览器没有弹出，不一定等于授权服务不可达。Windows 上若 CLI 不在 `PATH` 中，可把 `grok.exe` 的绝对路径写入用户级 `DSH_GROK_BIN`（例如 `setx DSH_GROK_BIN "C:\Users\<用户>\.grok\bin\grok.exe"`），再完全重启 DSH；注意 `DSH_*` 是 DSH 的 bootstrap 前缀，写进 `~/.dsh/.env` 会让该环境层直接报错。

**`fetch failed` / `Billing request timed out`。** 分别检查账号服务和 `cli-chat-proxy.grok.com` 的网络连接。需要代理时，在 DSH 启动环境或 `~/.dsh/.env` 中设置标准 `https_proxy` / `http_proxy`，而不是放进项目目录的 `.env`；再手动重启 DSH。插件沿用宿主网络配置，不提供单独代理服务。网络只是可能原因，还应检查认证和服务端错误。

**模型列表为空。** 先完成订阅登录并点击「从 Grok CLI 拉取」。检查是否只有 API-key 登录条目；查看目录状态，不要公开原始响应。

**聊天或用量返回 `401`。** 检查 CLI 会话是否有效。自动续期失败时，重新运行 `grok login`，完成授权后再次拉取。不要反复粘贴旧 token。

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
pnpm add --save-exact --config.minimumReleaseAge=0 dsh-grok-subscription@2.0.1
```

然后完全退出并重启桌面版。更新成功后该 profile 的 `package.json` 里依赖应变为目标版本，`dsh.profile.bundles` 条目保持不变。仅刷新网页不够：Host 未重启时仍会加载旧版本。

**卸载：** 在 **设置 → 插件** 里移除 `dsh-grok-subscription`，或在该 profile 目录执行 `pnpm remove dsh-grok-subscription`。这不删除整个 profile、其他插件或 Grok CLI 的 `auth.json`。

设置页「登出」清理的是插件侧会话状态，不等于撤销官方 CLI 会话。CLI 文件仍然存在时，之后重新拉取或启动可能再次同步登录；彻底结束官方会话应使用官方 CLI / 账号提供的登出与授权管理流程。不要靠删除整个 DSH profile 来处理一个账号。

## 本地开发

按 [CONTRIBUTING.md](../CONTRIBUTING.md) 安装锁定依赖、运行测试并构建：

```sh
npm ci
npm test
npm run build
```

源码修改后重新生成已跟踪的 `lib/`，不要手工编辑产物。测试与构建通过不等于真实登录、界面和模型调用已验证；验证 Host 改动前需要手动重启 DSH。

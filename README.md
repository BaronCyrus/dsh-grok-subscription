<div align="center">

<img src="docs/assets/dsh-grok-mascot.png" width="220" height="220" alt="DSH Grok Subscription 吉祥物：彗星领航员">

# DSH Grok Subscription

**简体中文** · [English](README.en.md)

**用 Grok Build 订阅，在 DSH 里编程、看图、切换推理档位。**

用 SuperGrok / X Premium 的 Grok Build 会话，在 DeepSeek Harness 中选模型、带图提问、查看每周额度。
无需另配 xAI 按量计费 API Key。

[![CI](https://github.com/BaronCyrus/dsh-grok-subscription/actions/workflows/ci.yml/badge.svg)](https://github.com/BaronCyrus/dsh-grok-subscription/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/dsh-grok-subscription?logo=npm&label=npm)](https://www.npmjs.com/package/dsh-grok-subscription)
[![npm 总下载量](https://img.shields.io/npm/dt/dsh-grok-subscription?logo=npm&label=%E6%80%BB%E4%B8%8B%E8%BD%BD%E9%87%8F)](https://www.npmjs.com/package/dsh-grok-subscription)
[![MIT](https://img.shields.io/badge/license-MIT-111111.svg)](LICENSE)
[![Star](https://img.shields.io/github/stars/BaronCyrus/dsh-grok-subscription?style=flat&logo=github&label=Star)](https://github.com/BaronCyrus/dsh-grok-subscription/stargazers)

[功能](#功能) · [安装](#安装) · [日常使用](#日常使用) · [界面预览](#界面预览) · [使用指南](#使用指南) · [更新与卸载](#更新与卸载)

</div>

<a id="核心优势"></a>

## 功能

| 能力 | 使用体验 |
| --- | --- |
| **订阅登录** | 在设置页用设备码登录，或读取已有的 `auth.json`，无需安装 grok 命令，也不用手动粘贴 token |
| **模型目录同步** | 登录后优先读取账号模型目录；读取失败时可使用内置目录，未登录时不显示模型 |
| **推理档位** | 在模型菜单中选择可用档位，通常包含 `low` / `medium` / `high` / `xhigh`，默认优先使用 `high` |
| **图片输入** | 支持的模型可接收粘贴或附加的图片；设置页可检查当前运行通路与附件能力 |
| **每周额度** | 输入框徽章和设置页展示服务端返回的用量；额度接口为实验性，读取失败不编造数字 |
| **会话续期与更新** | 临近过期或认证拒绝时用 refresh token 续期；设置页也可检查插件版本 |
| **凭据不返回浏览器** | access token 仅在 Host 侧使用；订阅失败不会静默改用其他付费模型路由 |

<a id="三步开始"></a>
<a id="准备-dsh"></a>

## 安装

需要 **DeepSeek Harness**，以及**当前具有 Grok Build 使用资格**的 SuperGrok / X Premium 账号。不需要安装 grok 命令。订阅名称本身不保证访问资格，以账号实际授权为准。

尚未安装 DSH，可查看 [DSH 官方说明](https://github.com/deepseek-ai/deepseek-harness#run)。版本要求见 [安装与兼容性](docs/guide.zh-CN.md#安装与兼容性)。

### 1. 安装插件

在桌面版打开 **设置 → 插件**，在安装输入框里填入包名 `dsh-grok-subscription` 并安装，然后**完全退出并重启桌面应用**。仅刷新页面不会重新加载 Host 中的适配器。

### 2. 登录订阅

打开 **设置 → Grok 订阅**，点击 **登录**。面板会给出链接和一次性验证码；授权完成后会话自动写入 `~/.grok/auth.json`。如果这台机器上已经有一份会话文件，点击 **读取已保存的会话**。

> 登录和续期由插件自己完成，不调用 grok 命令。请勿粘贴 `XAI_API_KEY`，也不要把 `auth.json` 或 token 发到聊天、截图和公开 Issue 中。

### 3. 选择模型

在模型选择器中选择账号可用的 Grok 模型。按需要调整推理档位，开始对话或编程；模型旁的徽章显示成功读取到的每周余量。

<details>
<summary>确认版本 / 固定版本 / 界面安装失败时的兜底</summary>

**设置 → 插件** 会列出已安装插件与版本，插件自己的 **设置 → Grok 订阅** 页也有版本卡片。要固定版本，在安装框里填入完整的 `包名@版本`，例如 `dsh-grok-subscription@2.0.5`。

界面安装失败时（例如 profile 目录权限异常），可以对桌面版 profile 手动执行等价操作（pnpm ≥ 11）：

```sh
cd "$HOME/.dsh/profiles/desktop"    # Windows: cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add --save-exact --config.minimumReleaseAge=0 dsh-grok-subscription@2.0.5
```

`dsh plugin --profile desktop …` 会被拒绝：桌面版 profile 由 Electron 应用独占。登录方式与故障排查见 [完整使用指南](docs/guide.zh-CN.md)。

</details>

## 日常使用

**选模型与推理档位。** 登录后目录会刷新；以模型菜单提供的档位为准。目录读取失败时的内置列表不代表额外授予模型权限。

**带图提问。** 在支持图片的模型下粘贴或附加图片。当前实现为 `grok-4.7`、`grok-4.7-build-fast`、`grok-4.6` 声明图片输入，不为 `grok-4.5` 声明；这指的是**读取图片，不是生成图片**。详见 [图片输入](docs/guide.zh-CN.md#图片输入)。

**查看每周额度。** 选择 `grok-build` 路由后，徽章展示成功读取的剩余比例；悬停或点击查看重置时间。完整信息在设置页查看，额度读取失败本身不会阻止聊天。

<a id="实际界面"></a>

## 界面预览

<p align="center">
  <img src="docs/assets/grok-subscription-overview.webp" width="900" alt="在 DSH 中选择 Grok 订阅模型并进行对话">
</p>

<p align="center">
  <img src="docs/assets/composer-quota.webp" width="820" alt="Grok 模型选择器旁的每周剩余额度徽章">
</p>

<details>
<summary>展开查看登录面板与实验性用量面板</summary>

<p align="center">
  <img src="docs/assets/settings-account.webp" width="820" alt="Grok 订阅设置页中的账号状态与登录操作">
</p>

<p align="center">
  <img src="docs/assets/settings-usage.webp" width="820" alt="Grok 订阅设置页中的实验性用量面板">
</p>

账号设置截图中的身份与时间为演示数据。用量截图仅说明界面，不代表任何账号的固定额度。

</details>

## 使用指南

[完整使用指南](docs/guide.zh-CN.md) 包含安装与兼容性、设备码登录、模型目录、图片输入、额度限制、网络排查和本地开发。

常用入口：[登录与凭据](docs/guide.zh-CN.md#登录与凭据) · [图片输入](docs/guide.zh-CN.md#图片输入) · [故障排查](docs/guide.zh-CN.md#故障排查) · [参与贡献](CONTRIBUTING.md)。

## 更新与卸载

**更新：** 在 **设置 → 插件** 的安装框里重新填入 `dsh-grok-subscription`（或 `dsh-grok-subscription@版本`）安装即可覆盖；插件自己的设置页也有版本卡片与「更新插件」按钮。完成后**完全退出并重启桌面应用**。

桌面版由 Electron 应用独占 `desktop` profile，`dsh plugin --profile desktop …` 会被直接拒绝，因此桌面版的「更新插件」由插件在该 profile 目录中用 DSH 自带的 pnpm 安装精确版本；`1.1.1` 之前该按钮在桌面版必然失败，手动步骤见[更新与登出](docs/guide.zh-CN.md#更新与登出)。

**卸载：** 在 **设置 → 插件** 里移除 `dsh-grok-subscription`，或在该 profile 目录执行 `pnpm remove dsh-grok-subscription`，然后重启桌面应用。卸载不会删除其他插件、整个 profile 或 `~/.grok/auth.json`，也不等于在 xAI 撤销授权；清理范围见 [更新与登出](docs/guide.zh-CN.md#更新与登出)。

## 常见问题

**模型列表为空？** 先在设置页完成订阅登录，或点击「读取已保存的会话」。只有 API Key 的条目不等于订阅登录。

**登录或请求超时？** 检查 DSH 所在机器能否连接账号与订阅服务，以及启动环境的代理设置。网络、登录状态和服务端异常都可能导致失败，不要直接认定为额度耗尽。见 [故障排查](docs/guide.zh-CN.md#故障排查)。

**发一条消息就返回 426，说 CLI 版本过旧？** 更新到当前版本并完全重启。设置页和模型列表仍可能正常，因为只有生成接口检查客户端版本。见 [故障排查](docs/guide.zh-CN.md#故障排查)。

**更新后不能带图？** 完整重启桌面应用，检查模型是否在图片支持列表，以及设置页的「运行通路」是否显示**官方 pi-ai** 且附件能力可用。若显示「不可用」，说明宿主缺少 pi-ai 适配器。

## 边界与支持

本项目是社区插件，与 DeepSeek、xAI 无隶属或背书关系。模型访问、推理档位和订阅额度由账号与服务端决定；本插件不授予额外权益。

用量面板依赖未公开的订阅计费接口，属于**实验性能力**，可能因上游变化而不可用。凭据不返回浏览器不代表离线运行：模型请求仍发送到 Grok 订阅服务。

安全说明见 [SECURITY.md](SECURITY.md)，问题反馈见 [Issues](https://github.com/BaronCyrus/dsh-grok-subscription/issues)。不要公开登录文件、token、原始账号响应或完整登录回调。

## 本地开发

```sh
git clone https://github.com/BaronCyrus/dsh-grok-subscription.git
cd dsh-grok-subscription
npm ci
npm test
npm run build
```

`lib/` 是已提交的构建产物，修改 `src/` 后应重新构建，不要手动编辑。开发与验证要求见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## License

[MIT](LICENSE)

# DSH Grok Subscription — 在 DeepSeek Harness 使用 SuperGrok / X Premium 订阅

<div align="center">

**简体中文** · [English](https://github.com/BaronCyrus/dsh-grok-subscription/blob/main/README.en.md)

**把 SuperGrok / X Premium（Grok Build）订阅直接接入 DeepSeek Harness**

复用官方 Grok Build CLI 的登录会话，不需要 `XAI_API_KEY`。
模型、推理档位和每周额度都留在 DSH 里。

[![CI](https://github.com/BaronCyrus/dsh-grok-subscription/actions/workflows/ci.yml/badge.svg)](https://github.com/BaronCyrus/dsh-grok-subscription/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/dsh-grok-subscription?logo=npm&label=npm)](https://www.npmjs.com/package/dsh-grok-subscription)
[![npm 总下载量](https://img.shields.io/npm/dt/dsh-grok-subscription?logo=npm&label=%E6%80%BB%E4%B8%8B%E8%BD%BD%E9%87%8F)](https://www.npmjs.com/package/dsh-grok-subscription)
[![MIT](https://img.shields.io/badge/license-MIT-111111.svg)](LICENSE)
[![Star](https://img.shields.io/github/stars/BaronCyrus/dsh-grok-subscription?style=flat&logo=github&label=Star)](https://github.com/BaronCyrus/dsh-grok-subscription/stargazers)

[三步开始](#三步开始) · [安装](#安装) · [参与贡献](CONTRIBUTING.md) · [更新与卸载](#更新与卸载)

</div>

<p align="center">
  <img src="docs/assets/grok-subscription-overview.webp" width="900" alt="在 DeepSeek Harness 中选择 Grok 4.7 并使用 SuperGrok 订阅进行多轮对话">
</p>

## 三步开始

1. **安装插件**：在终端运行下面的命令；指定候选版本时填写完整的 `包名@版本`，例如 `dsh-grok-subscription@1.0.2`。

   ```sh
   dsh plugin --profile web add BaronCyrus/dsh-grok-subscription
   ```

2. **登录订阅**：打开 **设置 → Grok 订阅**，点击 **CLI 登录** 或 **设备码登录**，在启动 DSH 的终端里完成官方提示。已经自己跑过 `grok login` 的话，直接点 **从 Grok CLI 拉取** 即可，不需要粘贴任何 token。
3. **开始使用**：在模型选择器中选择 Grok 4.7 等模型。输入框旁的圆形徽章显示每周剩余额度，模型菜单里有推理档位。

安装或升级后需要重启 `dsh web`，否则会继续运行旧的 `lib/`。

## 核心优势

| 能力 | 用户得到什么 |
| --- | --- |
| **订阅直连** | 复用官方 Grok Build CLI 会话，不需要 `XAI_API_KEY` |
| **真实模型目录** | 登录后从 `/v1/models-v2` 读取账号实际可用的模型（如 `grok-4.7`、`grok-4.6`、`grok-4.5`）；未登录时不暴露任何模型 |
| **推理档位** | 模型选择器内置 `low` / `medium` / `high` / `xhigh` 子菜单，默认 `high`，与 Codex 的交互一致 |
| **输入框额度** | 模型选择器旁的徽章直接显示每周剩余比例，悬停或点击查看「每周额度 剩余 N% · 重置于 M/D HH:mm」 |
| **用量面板（实验性）** | 设置页显示服务端返回的已用与剩余百分比，读取失败时不猜数字、不虚构额度 |
| **凭据留在本机** | 只在主机侧读取 `~/.grok/auth.json` 的短期 access token；不会把 token 交给浏览器 RPC |
| **登录状态会刷新界面** | 登录、拉取或登出后自动派发 `llm/adapters-updated`，Chat 模型列表随之更新 |
| **失败可见** | 订阅路由不可用时明确报错，不会静默改用其他付费路由 |

这些能力共用同一份本机 Grok Build 登录。

## 实际界面

<p align="center">
  <img src="docs/assets/settings-account.webp" width="820" alt="DSH 设置中的 Grok 订阅页面：登录状态、账号、登录按钮与凭据说明">
</p>

上图为 **设置 → Grok 订阅** 主界面：显示登录状态与脱敏账号，提供 CLI 登录、设备码登录、从 Grok CLI 拉取和登出，并说明凭据的读取方式。截图中的账号与时间均为演示数据。

<p align="center">
  <img src="docs/assets/settings-usage.webp" width="820" alt="Grok 订阅设置页中的实验性用量面板：已用 6%、剩余约 94%">
</p>

实验性用量面板来自未公开的订阅计费接口（`/v1/billing?format=credits`）。它仅供参考：接口可能随时变化或消失，读取失败时不会显示编造的百分比，也不影响聊天。

## 准备 DSH

本插件支持软件包元数据中记录的最新版 DeepSeek Harness，并需要一个具有 Grok Build 使用资格的 **SuperGrok 或 X Premium** 账号。

- **已经能运行 `dsh`**：直接使用下面的标准命令；
- **想按官方方式运行**：查看 [DeepSeek Harness 官方说明](https://github.com/deepseek-ai/deepseek-harness#run)。

插件读取 `~/.grok/auth.json` 时较为严格：拒绝符号链接、拒绝组或其他用户可读的文件、拒绝非当前用户拥有的文件。如果权限不正确：

```sh
chmod 600 "${GROK_HOME:-$HOME/.grok}/auth.json"
```

## 安装

### DSH 标准命令

```sh
dsh plugin --profile web add BaronCyrus/dsh-grok-subscription
```

也可以按 npm 上的已发布版本安装：

```sh
dsh plugin --profile web add dsh-grok-subscription@1.0.2
```

目标选择、profile 锁、依赖解析和 bundle 激活均由 DSH 负责。

### Headless

先在 Web 中完成登录并选择一次 Grok 模型，再把同一个插件安装到 DSH 的标准 Headless profile：

```sh
dsh plugin --profile headless add BaronCyrus/dsh-grok-subscription
dsh --profile headless "只回复：ok"
```

<details>
<summary>官方 npm 方式（已安装 Node.js）</summary>

官方的 `npx @deepseek-ai/dsh web` 不会创建全局 `dsh` 命令，因此安装插件时也要保留完整的 `npx` 前缀：

```sh
npx -y @deepseek-ai/dsh@0.1.5-rc.2 plugin --profile web add BaronCyrus/dsh-grok-subscription
npx -y @deepseek-ai/dsh@0.1.5-rc.2 plugin --profile web list dsh-grok-subscription --depth 0
npx -y @deepseek-ai/dsh@0.1.5-rc.2 --profile web --dump-config
```

</details>

<details>
<summary>已经能运行 <code>dsh</code> 时检查安装结果</summary>

```sh
dsh plugin --profile web list dsh-grok-subscription --depth 0
dsh --profile web --dump-config
```

安装列表中应只有一个 `dsh-grok-subscription`，配置中应只有一个 `grok-build` 路由。

</details>

安装完成后手动重启 DSH，然后：

1. 打开 **设置 → Grok 订阅**；
2. 登录具有 Grok Build 资格的账号（浏览器登录或设备码登录）；
3. 在模型选择器中选择 Grok 模型。

## 功能

- 复用官方 Grok Build CLI 会话登录，凭据保留在本机；账号以部分隐藏的邮箱区分；
- 模型直接出现在 DSH 会话中，无需 `XAI_API_KEY`，也不向浏览器暴露 token；
- 模型目录登录后自动拉取；读取失败或超时时回退到内置列表并记录错误，未登录时保持为空；
- 模型菜单提供 `low` / `medium` / `high` / `xhigh` 推理档位，默认 `high`；
- 输入框模型选择器旁显示每周剩余额度徽章，悬停或点击查看剩余比例与重置时间；
- 设置页可查看服务端返回的用量与剩余百分比，失败时明确提示而不是显示猜测值；
- 支持 CLI 登录、设备码登录、从 Grok CLI 拉取和登出；登录状态变化后 Chat 模型列表自动刷新；
- 订阅路由不可用时明确报错，不会静默切换到其他付费路由。

### 输入框额度

<p align="center">
  <img src="docs/assets/composer-quota.webp" width="820" alt="DSH 输入框：Grok 4.7 模型选择器旁的每周剩余额度徽章">
</p>

仅当当前会话的 provider 为 `grok-build` 且用量读取成功时显示徽章；悬停或点击可查看「每周额度 剩余 N% · 重置于 M/D HH:mm」。徽章只反映服务端返回的每周额度；读取失败时徽章不显示，聊天不受影响。

### 推理档位

选择 Grok 模型后，模型菜单里会出现推理档位子菜单：`low` / `medium` / `high` / `xhigh`，默认 `high`。档位通过 `model.reasoning`（`efforts` + `defaultEffort`）元数据提供，因此与 Codex 在 DSH 中的交互一致；具体可用档位以账号模型目录为准。

### 模型目录与登录状态

登录后插件从订阅代理读取账号实际可用的模型目录；未登录时不注册任何模型。读取失败或超时时回退到内置列表（`grok-4.7` / `grok-4.6` / `grok-4.5`）并在状态里记录错误，因此目录不会留空，也不会让插件启动卡住。

## 更新与卸载

### 更新并检查

```sh
dsh plugin --profile web update dsh-grok-subscription
dsh plugin --profile web list dsh-grok-subscription --depth 0
dsh --profile web --dump-config
```

### 卸载

确认需要移除插件后再运行：

```sh
dsh plugin --profile web remove dsh-grok-subscription
```

这些操作会保留 DSH profile、其他插件和 `~/.grok/auth.json` 中的登录信息。

<details>
<summary>官方 npm 备用方式</summary>

```sh
npx -y @deepseek-ai/dsh@0.1.5-rc.2 plugin --profile web update dsh-grok-subscription
npx -y @deepseek-ai/dsh@0.1.5-rc.2 plugin --profile web remove dsh-grok-subscription
```

</details>

## 常见问题

- **`dsh` 无法识别**：官方 npm 方式本来就不会创建全局 `dsh` 命令，请使用上面的完整 `npx -y @deepseek-ai/dsh@0.1.5-rc.2 ...` 命令；
- **模型列表是空的**：未登录时插件不暴露任何模型。先完成登录，再点 **从 Grok CLI 拉取**；
- **升级后界面没变化**：插件会继续运行旧的 `lib/`，请重新安装插件并重启 `dsh web`，然后硬刷新（Ctrl+Shift+R）；
- **提示 `auth.json` 权限不正确**：按上面的 `chmod 600` 处理；插件拒绝读取符号链接或组/其他用户可读的文件；
- **出现「没有回复」**：请升级到 `1.0.1` 或更高版本。`1.0.0` 存在一个缺陷：工具调用轮次会因流片段无法无损序列化而整轮中止，界面上完全没有回复。

## 边界与支持

Grok 订阅后端和 DSH 可能独立变化；本项目为社区项目，与 DeepSeek、xAI 无隶属或背书关系。

敏感问题请先阅读 [SECURITY.md](SECURITY.md)。问题反馈请使用 [Issues](https://github.com/BaronCyrus/dsh-grok-subscription/issues)。

### 开发检查

```sh
npm install
npm test
npm run build
```

`lib/` 是提交进仓库的构建产物，改动 `src/` 后请运行 `npm run build`。

[MIT](LICENSE)

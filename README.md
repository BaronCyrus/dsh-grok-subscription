# dsh-grok-subscription

一个第一方形态的 **DeepSeek Harness 社区插件**：复用官方 Grok Build CLI 的 SuperGrok / X Premium 登录，在 DSH 中提供独立的 `grok-build` 模型路由，不覆盖 DSH 内置的 `xai` API-key 路由。

## 它做什么

- 读取 `${GROK_HOME:-~/.grok}/auth.json` 中的 OAuth 会话（不接受纯 API-key 项作为订阅登录）。
- 通过 DSH credentials 仅保存短期 access token；refresh token 不离开 Grok CLI 文件。
- 推理使用 OpenAI Responses：`https://cli-chat-proxy.grok.com/v1/responses`，不是 `api.x.ai`。
- 登录后从 `GET https://cli-chat-proxy.grok.com/v1/models-v2` 获取账号可用模型；实时目录不可用或为空时使用小型静态目录（包含 `grok-4.7`）。`grok-4.7` 优先来自实时 `models-v2` 返回。
- 未登录时仍注册 adapter，但模型列表为 **0**（fail closed）。
- 设置页显示脱敏账户、登录状态、模型与最近一次目录错误，并提供 CLI 登录、设备码登录、从 Grok CLI 拉取、退出登录。
- **实验性用量显示**：登录后从未文档化的 `GET /v1/billing?format=credits` 读取 `config.creditUsagePercent`（兼容顶层）与周期结束时间；失败时显示「不可用」且**绝不编造百分比**。不影响 Chat。
- Pull / 登录 / 退出 / 目录刷新后通过 `llm/adapters-updated` 通知 Web 客户端刷新 Chat / New Session 模型选择器（emit 延后，避免与 Pull RPC 重入）。
- 设置页 Pull **零出站网络、内存优先**：只读本地 auth.json，同步写入 `memoryAccessToken` 后立即返回；credentials.set / credentialRef 延后（带超时），不堵 Pull RPC；目录与用量由后台及客户端 fire-and-forget 的 `catalog/refresh` / `usage/refresh` 更新（不占用全局 busy）；`status` / `currentToken` 优先内存。

## 安装

要求 Node.js `^22.19.0 || >=24`，并建议先安装官方 `grok` CLI。

```bash
grok login
# 从 GitHub 安装（推荐）
dsh plugin --profile web add BaronCyrus/dsh-grok-subscription
# 或本地路径
# dsh plugin --profile web add /absolute/path/to/dsh-grok-subscription
# 或 npm（发布后）
# dsh plugin --profile web add dsh-grok-subscription@1.0.1
```

然后重启 `dsh web`，打开 **Settings → Grok 订阅**。也可以在设置页点击“CLI 登录”或“设备码登录”；设备码流程会在启动 DSH 的终端中显示提示。登录完成后点击“从 Grok CLI 拉取”可立即同步；Chat 模型列表会随之刷新。

升级到新版本后请重新安装插件（`add` 同一路径）并重启 `dsh web`，否则会继续跑旧的 `lib/`。

若权限不正确：

```bash
chmod 600 "${GROK_HOME:-$HOME/.grok}/auth.json"
```

开发检查：

```bash
npm install
npm test
npm run build
```

## v1.0.1

修复 grok-build 路由「发第二条消息没有回复」：`/v1/responses` 只在 `response.output_item.added` 与 `function_call_arguments.done` 上给函数名，参数增量事件不带 `name`，于是工具调用块带着 `name: undefined` 发给宿主。DSH 会拒绝任何无法无损 JSON 序列化的流片段，并以「Assistant stream chunk must be losslessly JSON-serializable」结束整轮，界面上完全没有回复——走 grok-build 的工具调用轮次都会这样，纯文本回复则正常。现：按 call id 记住工具名；采用 `arguments.done` / `response.completed` 的权威参数；从终止快照恢复只出现在 `completed` 里的调用；用量合计保持有限值、错误状态仅在其为数字时附带；出口再统一剔除 `undefined` / 非有限值兜底。附 8 个基于真实抓包帧的回归测试。

## v1.0.0

首个稳定版，已发布 npm：`dsh-grok-subscription@1.0.0`。内置模型选择器现可通过 `model.reasoning`（efforts + defaultEffort）展示 Grok Build 的 reasoning effort 子菜单（low/medium/high/xhigh），与 Codex 一致。修复 duck `listModels`/`resolveModel` 此前省略该元数据的问题。

## v0.1.13

Chat 输入区模型选择旁增加 Codex 风格的每周剩余额度徽章（如 `16%`）；悬停/点击显示「每周额度 剩余 N% · 重置于 M/D HH:mm」。仅在当前会话 provider 为 `grok-build` 且用量 `ok` 时显示。Settings 中 Pull/登录成功后会派发刷新事件更新徽章。已发布 npm：`dsh-grok-subscription@0.1.13`。升级后请用新 token URL 硬刷新。

## v0.1.12

升级后请用 `dsh web` 新打印的带 token URL 打开，并硬刷新（Ctrl+Shift+R），避免旧 `/plugins` client 缓存。

修复 0.1.11 实机：Settings → Plugins 仍卡在「Reading plugins…」，Pull 等到客户端 45s 超时。根因是 `status` / `currentToken` 仍可能无超时地 `await credentials.resolve` 与裸 `import('@deepseek-ai/dsh-credentials')`，楔住连接桥后 Plugins 清单也跟着挂。现：`credentialRefOf` 用 timed `optionalImport`；resolve 硬超时（默认 1.5s）；`status` 先内存 / auth.json，再可选 credentials；宿主 RPC 每端点 8s 硬超时；`llm/adapters-updated` 一律延后；`inject` 保持 `['llm','web']`；客户端缺 connection 软跳过，RPC 客户端超时降至 12s。已发布 npm：`dsh-grok-subscription@0.1.12`。

## v0.1.10

修复 0.1.9 实机：Pull 仍可能 45s 超时，且 **Settings → Plugins** 卡在 `Reading plugins…`（宿主 Settings/RPC 通道被楔住）。根因是 `apply`/`boot` 路径会 `await` 无超时的动态 `import`（`pi-ai` / `dsh-llm-pi-ai` / schemastery），且 `inject` 含 sticky 的 `credentials`。现 `inject` 收窄为 `['llm','web']`；`apply` 同步注册 duck adapter 后立即返回；schemastery / `session.pull` / pi-ai 升级全部 `setImmediate` 延后；所有动态 import 硬超时（默认 2.5s），超时则保持 duck。保留 0.1.9 内存优先 Pull 与 0.1.8 客户端 fire-and-forget。

## v0.1.9

修复 0.1.8 实机：Pull RPC 本身卡到客户端 45s 超时。根因是零网络 Pull 仍 `await storeToken` → `credentialRefOf()`（动态 import `@deepseek-ai/dsh-credentials`）无超时，import/set 与 DSH credentials 死锁时会拖死整个 Pull。现会话服务持有 `memoryAccessToken`；Pull 成功路径同步写入内存后立即返回，credentials 持久化与 clear 全部 `scheduleDeferred`；`currentToken` / `status` 优先内存。客户端仍保持 0.1.8 的 fire-and-forget 刷新行为。

## v0.1.8

修复 0.1.7 实机：Pull 成功后客户端仍 await `usage/refresh` 并占用全局 busy，导致 Working… 卡住、按钮一直 disabled。现 Pull/登录成功后立即清 busy 并显示成功提示；`catalog/refresh` 与 `usage/refresh` 为 fire-and-forget（不置全局 busy）。仅「刷新用量」按钮使用本地 `usageBusy`。`fetchBillingUsage` 增加独立于 AbortSignal 的硬 `Promise.race` 超时（默认 8s）；空 JSON `{}` 与非 JSON Content-Type 会写入更明确的不可用原因。

## v0.1.7

修复设置页 Pull 仍卡住 Working…（0.1.6 去掉 billing 后仍可能卡在 `credentials.set` 或 `loadCatalog`）：Pull 关键路径**零出站网络**，`storeToken` 硬超时（默认 5s），立即返回缓存目录/用量；后台 kick `refreshCatalog` + `refreshUsage`；客户端在 Pull 成功后另行 `catalog/refresh` 与 `usage/refresh`（独立 busy 文案）。`notifyCatalogChange` 仍仅延后触发。

## v0.1.6

修复设置页 Pull 卡住 Working…、用量长期「不可用」：Pull 关键路径不再等待 billing；`status()` 只返回缓存用量；Pull 成功后由客户端另行 `usage/refresh`；`llm/adapters-updated` 延后发出；客户端 RPC 增加超时保护。解析逻辑仍沿用 0.1.5 的 config.* 兼容。

## v0.1.5

修复实验性用量解析：官方 `/v1/billing?format=credits` 实际把 `creditUsagePercent`、`currentPeriod`、`productUsage` 放在 `config` 下（非顶层）。0.1.4 因严格读顶层字段在 QA 中显示「不可用」。现同时接受 `config.*` 与顶层；不可用原因会附带顶层 key 名以便排查。**绝不编造百分比。**

## v0.1.4

实验性 SuperGrok 周用量显示：设置页新增「用量（实验性）」区块，只读请求 `GET https://cli-chat-proxy.grok.com/v1/billing?format=credits`（与现有 OAuth + CLI fingerprint 请求头相同）。解析 `config.creditUsagePercent` / 顶层 `creditUsagePercent` 与 `config.currentPeriod.end`；RPC 提供 `usage` / `usage/refresh`，永不回传 token。失败 fail-closed 为「不可用」。**账单 API 未公开文档，可能随时变更。**

## v0.1.3

修复多轮 Chat 中助手正文不显示的问题：自定义 Responses 流在 `block-end` 时把已累计的 text/reasoning 写成空字符串，Harness `BlockAssembler` 会用空块覆盖流式增量，导致第 2 轮起界面只见思考（如 “Deep diving…”）不见正文。同时为 `grok-build` 强制 `include: reasoning.encrypted_content`（与 pi-ai 对 `xai` 的处理对齐），保证推理密文可回放。

## v0.1.2

设置页 Pull / 登录 / 退出成功后显示明确的内联成功反馈。

## v0.1.1

修复 Chat / New Session 模型选择器在 Settings 已 Pull 到 `models-v2` 后仍只显示 DeepSeek 模型的问题：

- PiAiAdapter 的 `profiles` 每次重建 provider，且 `getModels()` 读取当前 `session.models()`（不再依赖一次性的 `models: []` + `fetchModels`）。
- Pull / 登录 / 退出 / 目录刷新后发出 `llm/adapters-updated`，让选择器刷新。

v0.1.0 范围仍适用：仅文本/工具调用所需的 Responses 流、账号同步、动态模型目录和设置页。没有图片生成、画板、额度预测或 Codex 功能。官方 CLI 负责登录与 refresh-token 生命周期；插件不会实现或写回供应商 OAuth refresh。

## 注意事项

- 这是社区插件，不是 xAI、Grok 或 DeepSeek 官方产品。
- 订阅账号用于非官方客户端可能处于供应商条款灰色地带；**只使用你自己的账号**，风险自担。
- 官方文档没有发布完整 HTTP wire protocol；代理协议、请求头、模型 ID 或权限规则可能随时改变。
- 用量面板依赖的 `/v1/billing?format=credits` **未公开文档**，属实验性功能；字段形状或可用性可能变化，失败时仅显示不可用。
- 设置页发起 CLI 登录时，浏览器/设备码提示由官方 CLI 处理；远程部署请优先用 `grok login --device-auth`。

## English

`dsh-grok-subscription` is a small community DSH plugin that reuses an official Grok Build CLI SuperGrok/X Premium session. It adds a separate `grok-build` route, calls the subscription Responses proxy, discovers models from `/v1/models-v2` (with a signed-in-only fallback including `grok-4.7`), and never exposes tokens to browser RPC. Settings also shows an **experimental** weekly usage panel from the undocumented `/v1/billing?format=credits` endpoint (fail-closed; never invents percentages; chat is unaffected). After Pull/login/logout the plugin emits `llm/adapters-updated` so the Chat model picker refreshes. Install locally with:

```bash
dsh plugin --profile web add BaronCyrus/dsh-grok-subscription
```

Reinstall after upgrades, restart `dsh web`, then open **Settings → Grok Subscription**.

### v1.0.1

Fixes "no reply after sending a second message" on the grok-build route: `/v1/responses` sends the function name only on `response.output_item.added` and `function_call_arguments.done`, never on the arguments delta, so tool-call chunks carried `name: undefined`. DSH rejects any stream chunk that is not losslessly JSON-serializable and ends the whole turn with "Assistant stream chunk must be losslessly JSON-serializable", leaving no reply in the UI; every tool-calling turn over grok-build failed this way while text-only replies looked fine. Now tool names are remembered by call id, arguments are adopted from `arguments.done` / `response.completed`, calls that appear only in the terminal snapshot are recovered, usage totals stay finite, an error status is attached only when numeric, and outgoing chunks are pruned of `undefined` / non-finite values. Adds 8 regression tests built from real captured frames.

### v1.0.0

First stable release, published to npm as `dsh-grok-subscription@1.0.0`. Stock model picker now shows Grok Build reasoning effort (low/medium/high/xhigh) via `model.reasoning` metadata (`efforts` + `defaultEffort`), matching Codex. Fixes duck `listModels`/`resolveModel` omitting that shape.

### v0.1.13

Chat 输入区模型选择旁增加 Codex 风格的每周剩余额度徽章（如 `16%`）；悬停/点击显示「每周额度 剩余 N% · 重置于 M/D HH:mm」。仅在当前会话 provider 为 `grok-build` 且用量 `ok` 时显示。Settings 中 Pull/登录成功后会派发刷新事件更新徽章。已发布 npm：`dsh-grok-subscription@0.1.13`。升级后请用新 token URL 硬刷新。

## v0.1.12

After upgrading, open the fresh token URL from `dsh web` and hard-refresh (Ctrl+Shift+R) so the old immutable `/plugins` client is not reused.

修复 0.1.11 实机：Settings → Plugins 仍卡在「Reading plugins…」，Pull 等到客户端 45s 超时。根因是 `status` / `currentToken` 仍可能无超时地 `await credentials.resolve` 与裸 `import('@deepseek-ai/dsh-credentials')`，楔住连接桥后 Plugins 清单也跟着挂。现：`credentialRefOf` 用 timed `optionalImport`；resolve 硬超时（默认 1.5s）；`status` 先内存 / auth.json，再可选 credentials；宿主 RPC 每端点 8s 硬超时；`llm/adapters-updated` 一律延后；`inject` 保持 `['llm','web']`；客户端缺 connection 软跳过，RPC 客户端超时降至 12s。已发布 npm：`dsh-grok-subscription@0.1.12`。

## v0.1.10

Fixes 0.1.9 live hang: Pull could still hit the 45s client timeout, and **Settings → Plugins** stuck on `Reading plugins…` (host Settings/RPC channel wedged). Root cause: `apply`/`boot` awaited untimed dynamic `import`s (`pi-ai` / `dsh-llm-pi-ai` / schemastery), and `inject` listed sticky `credentials`. Now `inject` is `['llm','web']`; `apply` synchronously registers a duck adapter and returns; schemastery / `session.pull` / pi-ai upgrade are deferred via `setImmediate`; every dynamic import has a hard timeout (default 2.5s) and falls back to duck. Keeps 0.1.9 memory-first Pull and 0.1.8 client fire-and-forget.

### v0.1.9

Fixes 0.1.8 live hang where the Pull RPC itself hit the client 45s timeout: zero-network Pull still awaited `storeToken` → `credentialRefOf()` (dynamic import of `@deepseek-ai/dsh-credentials`) with no timeout, so a credentials import/set deadlock stalled Pull. Session now keeps `memoryAccessToken`; success Pull writes memory and returns immediately, deferring credential persist/clear; `currentToken` / `status` prefer memory. Keeps 0.1.8 client fire-and-forget refresh behavior.

### v0.1.8

Fixes 0.1.7 live hang: after Pull the client no longer awaits `usage/refresh` while holding global busy (Working… / all buttons disabled). Pull/login clear busy and show success immediately; catalog + usage refresh are fire-and-forget. Only the Usage Refresh button uses local `usageBusy`. `fetchBillingUsage` has a hard Promise.race timeout (default 8s) independent of AbortSignal; empty `{}` and non-JSON Content-Type get clearer unavailable reasons.

### v0.1.7
Fixes Settings Pull hang after 0.1.6: zero-network Pull path, `storeToken` hard timeout (default 5s), returns cached catalog/usage immediately; background kick of `refreshCatalog` + `refreshUsage`; client follows up with `catalog/refresh` and `usage/refresh`. Catalog notify stays deferred.

## v0.1.6
Fixes Settings Pull hang (Working…) and stale Unavailable usage: Pull no longer awaits billing; `status()` returns cached usage only; client calls `usage/refresh` after successful Pull; catalog notify is deferred; client RPC has a safety timeout. Keeps 0.1.5 config.* parsing.

### v0.1.5
Fixes experimental usage parsing: live `/v1/billing?format=credits` nests `creditUsagePercent`, `currentPeriod`, and `productUsage` under `config` (not top-level). 0.1.4 failed QA with Unavailable. Parser now accepts `config.*` and top-level; unavailable reasons include top-level key names. Never invents percentages.

### v0.1.4
Experimental SuperGrok weekly usage in Settings: read-only `GET /v1/billing?format=credits` with the same OAuth + CLI fingerprint headers; shows used % and period end; RPC `usage` / `usage/refresh` never return tokens; fail closed to Unavailable. The billing API is undocumented and may change.

### v0.1.3
Fixes multi-turn Chat where assistant body text vanished from turn 2 onward: the custom Responses SSE mapper ended text/reasoning blocks with empty strings, so Harness `BlockAssembler` replaced streamed deltas with blanks (UI could show "Deep diving…" then no body). Also forces `include: reasoning.encrypted_content` for `grok-build` so encrypted reasoning can replay on later turns. This is unofficial, may fall into a vendor-ToS gray area, and the undocumented wire protocol can change. Use your own account only.

## 还需要实机验证的部分

单元测试覆盖 auth.json 解析、目录解析、请求头、RPC 脱敏、signed-out 空目录与 catalog-change 回调，不访问网络。以下需要本机已安装的 DSH + 已登录 SuperGrok 才能确认：

- Settings 页槽位、locale、connection.rpc 与 DSH web client 的实际装配
- Pull 后 Chat / New Session 是否出现 `grok-4.7` 等 `grok-build` 模型并可发起推理
- `PiAiAdapter` 对 `grok-build` 路由的流式映射（若宿主没有 `@deepseek-ai/dsh-llm-pi-ai` / `@earendil-works/pi-ai`，插件会降级到自带的 Responses SSE MVP adapter）
- 官方 CLI `grok login` / `grok login --device-auth` 从 Settings 按钮拉起后的终端交互
- 实时 `GET /v1/models-v2` 是否返回 `grok-4.7`（目录为空时使用静态回退）
- Settings「用量（实验性）」：登录后刷新是否显示已用 % 与周期结束时间；401/网络失败是否显示「不可用」且无假百分比；Chat 在用量失败时仍可正常对话

## 致谢 / Acknowledgments

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- [dsh-kimi-subscription](https://github.com/BaronCyrus/dsh-kimi-subscription)（插件形态与发布方式参考）
- [dsh-codex-subscription](https://github.com/WSL043/dsh-codex-subscription)

## License

[MIT](LICENSE)

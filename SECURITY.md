# 安全说明 / Security

- 插件只读取 `${GROK_HOME:-~/.grok}/auth.json`，从不写回；拒绝符号链接、非普通文件、非当前用户所有的文件，以及组/其他用户可读写执行的文件。Unix 下应为 `0600`。
- 只有短期 access token 会通过 DSH credentials 服务保存；refresh token 始终留在 Grok CLI 文件中。
- token 不会写入日志，也不会通过浏览器 RPC 返回。RPC 只返回脱敏账户、状态、模型与无敏感信息的错误摘要。
- 订阅 token 只发送到固定 HTTPS 主机 `cli-chat-proxy.grok.com`。
- 请勿在公开 issue、截图或诊断中粘贴 `auth.json`、token 或登录回调 URL。

This community plugin runs with DSH host privileges. Review the source before installation and use only your own account.

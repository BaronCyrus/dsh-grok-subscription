# 安全说明 / Security

- 插件读写 `${GROK_HOME:-~/.grok}/auth.json`。读取和写入都拒绝符号链接、非普通文件、非当前用户所有的文件。读取还拒绝组/其他用户可读写执行的文件；写入使用临时文件替换，并把结果设为 `0600`。Unix 下应为 `0600`。
- 写入只更新 OAuth 会话那一条，保留文件里的其他条目。
- 只有短期 access token 会通过 DSH credentials 服务保存；refresh token 始终留在 auth.json 中。
- token 不会写入日志，也不会通过浏览器 RPC 返回。RPC 只返回脱敏账户、状态、模型与无敏感信息的错误摘要。设备码（device code）只留在 Host 进程里。
- 订阅 token 只发送到固定 HTTPS 主机 `cli-chat-proxy.grok.com`。登录和续期只访问 `https://auth.x.ai`（以及它返回的 `https://*.x.ai` 授权链接）。
- 请勿在公开 issue、截图或诊断中粘贴 `auth.json`、token 或登录回调 URL。

This community plugin runs with DSH host privileges. Review the source before installation and use only your own account.

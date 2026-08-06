# 安全策略

## 支持范围

安全修复优先应用于最新 GitHub Release 和 `main` 分支。

## 私下报告漏洞

请不要为可能暴露凭据、任意文件覆盖、路径穿越、归档欺骗或加密缺陷的问题创建公开 Issue。

请使用仓库的 [Private vulnerability reporting](https://github.com/LHT02/CodexBackupManager/security/advisories/new) 提交安全报告，并尽量包含：

- 受影响版本；
- 复现步骤和最小测试文件；
- 潜在影响；
- 建议修复方式（如有）。

请勿在报告中附加真实的 Codex `auth.json`、Cookie、API Key 或完整会话备份。使用人工构造的最小样例即可。

## 安全边界

- 未加密 `.cxbak` 是 ZIP 兼容文件，任何获得文件的人都可以读取内容。
- 登录凭据备份强制要求 AES-256-GCM 加密，但密码强度和安全保管仍由用户负责。
- Windows DPAPI 保护的数据跨设备还原后可能失效，需要重新登录。
- 当前 Windows EXE 未使用商业代码签名证书；请从官方 Release 下载并核对 SHA-256。

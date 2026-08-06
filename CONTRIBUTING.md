# 参与贡献

感谢你愿意改进 Codex 备份管家。

## 开发环境

- Windows 10 或更高版本
- PowerShell 7
- Node.js 24 或更高版本

```powershell
git clone https://github.com/LHT02/CodexBackupManager.git
Set-Location CodexBackupManager
npm install
npm run check
```

需要检查真实 Electron 窗口时运行：

```powershell
npm run smoke:electron
```

## 提交要求

1. 不要提交任何真实 Codex 会话、凭据、Cookie、`.cxbak` 备份或用户路径下的数据。
2. 源码和文档使用 UTF-8（无 BOM）。
3. 新增备份范围时必须同时考虑路径令牌化、路径穿越防护、敏感数据提示和还原回滚。
4. 修改归档格式时应保留版本检测，并为加密、校验与跨用户还原补充测试。
5. UI 保持 Material Design 2 风格；主题色为 `#038387`，暗色模式不得自动提亮。
6. 提交前运行 `npm run check`，涉及窗口行为时再运行 `npm run smoke:electron`。

## Pull Request

请说明：

- 修改了什么以及原因；
- 对备份兼容性和用户数据安全的影响；
- 已执行的验证命令；
- UI 修改的亮色和暗色截图（如适用）。

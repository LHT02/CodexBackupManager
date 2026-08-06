# Codex 备份管家

[![CI](https://github.com/LHT02/CodexBackupManager/actions/workflows/ci.yml/badge.svg)](https://github.com/LHT02/CodexBackupManager/actions/workflows/ci.yml)
[![GitHub Release](https://img.shields.io/github/v/release/LHT02/CodexBackupManager)](https://github.com/LHT02/CodexBackupManager/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-038387.svg)](LICENSE)

Codex 备份管家是一款 Windows 本地离线工具，用于将 Codex 桌面端与 CLI 的配置、会话、技能等数据压缩为一个文件，并安全地迁移或还原到当前 Windows 用户。

## 下载

前往 [GitHub Releases](https://github.com/LHT02/CodexBackupManager/releases/latest) 下载 `Codex-Backup-Manager-*-Portable.exe`。软件为单文件便携版，无需安装。

当前发布版未使用商业代码签名证书，Windows SmartScreen 可能在首次运行时显示提示。请对照 Release 页面公布的 SHA-256。

## 功能

- 一键扫描本机真实 Codex 数据目录，显示文件数与原始体积。
- 三档范围：精简、推荐、完整，也可以逐项选择。
- 单文件 `.cxbak` 格式，使用 ZIP64 + Deflate 自身压缩，不依赖 7-Zip/WinRAR。
- 普通 `.cxbak` 与 ZIP 兼容；加密 `.cxbak` 使用自定义版本头封装。
- 可选 scrypt + AES-256-GCM 整包加密，能同时检测错误密码和密文损坏。
- 备份时先计算逐文件 SHA-256，写入后再完整解压复核。
- 还原时拦截路径穿越，逐文件校验后原子替换。
- 支持安全合并与覆盖同名文件两种策略。
- 覆盖前自动创建单文件回滚包，默认保存到“文档\Codex Backups”。
- 路径使用 `%USERPROFILE%`、`%APPDATA%`、`%LOCALAPPDATA%`、`%CODEX_HOME%` 令牌，支持换用户名迁移。
- Electron 42 单文件便携 EXE，无需安装。
- 自绘单行标题栏可切换“跟随系统 / 亮色 / 暗色”，同时切换 Electron 原生窗体背景并持久化，避免启动或调整大小时闪白。
- 自定义亮暗滚动条；主题色在暗色模式下仍严格保持 `#038387`。

## 可备份范围

1. 配置与全局状态：`config.toml`、模型缓存、全局 UI 状态等。
2. 会话、任务与运行状态：会话 JSONL、索引、State/Goals SQLite 数据库等。
3. 技能、规则、记忆与个性化：Skills、Rules、Memories、Pets、`AGENTS.md` 等。
4. 插件与本地扩展：已安装插件、插件缓存、浏览器原生主机配置。
5. 附件与生成内容：附件、生成图片、可视化、听写和转录历史。
6. MCP、浏览器与工具状态：浏览器控制、Computer Use、MCP OAuth、进程工具数据。
7. 登录凭据：`auth.json`，此项强制使用加密备份。
8. 桌面端用户资料：Roaming/Local Codex 与 OpenAI Codex 数据，排除可重建缓存。
9. 编辑器集成状态：VS Code、Cursor 的 OpenAI/Codex 扩展资料。
10. 日志、沙箱与缓存：诊断与临时数据，仅在完整备份中默认选用。

## 使用方法

### 备份

1. 运行 `Codex-Backup-Manager-1.0.0-Portable.exe`。
2. 选择“精简 / 推荐 / 完整”或手动勾选项目。
3. 如包含敏感数据，开启 AES-256 加密并设置至少 8 位密码。
4. 选择保存位置，点击“开始备份”。
5. 完成后保存界面显示的 SHA-256。

为获得一致的 SQLite 快照，建议先关闭 Codex 桌面端与 Codex CLI。若文件在压缩期间发生变化，最终解压复核会阻止生成不一致的备份。

### 还原

1. 关闭 Codex 桌面端和 Codex CLI。
2. 进入“还原”，选择 `.cxbak` 文件。
3. 加密备份需要先输入密码并检查清单。
4. 选择要还原的组件与合并/覆盖策略。
5. 保持“自动创建回滚包”开启，点击“开始还原”。

登录令牌、Cookie 等数据可能受 Windows DPAPI 和设备状态限制；完整复制到另一台电脑后仍可能需要重新登录。

## 开发

要求 PowerShell 7、Node.js 24。源码使用 UTF-8（无 BOM）。

```powershell
npm install
npm run check
npm run smoke:electron
npm run build
```

主要目录：

- `electron/services/`：发现、压缩、加密、校验、备份和还原引擎。
- `electron/`：主进程、安全 preload 与 IPC。
- `src/components/`：React + MUI 界面组件。
- `tests/`：单文件格式、加密和跨用户还原测试。
- `release/`：便携式单文件 EXE。

详细设计、验证结果与最终哈希见 `PROJECT.md`。

## 参与贡献

问题反馈和功能建议请使用 [GitHub Issues](https://github.com/LHT02/CodexBackupManager/issues)。提交代码前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。安全问题请按照 [SECURITY.md](SECURITY.md) 私下报告。
